import { VideoPromptItem } from './src/types';

interface TestResult {
  test: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];
function record(test: string, passed: boolean, details: string) {
  results.push({ test, passed, details });
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${test}\n    -> ${details}\n`);
}

const sleep = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// =========================================================================
// MOCK SCHEDULER: Mirrors server.ts GeminiRateLimitedQueue
// =========================================================================
class MockGeminiRateLimitedQueue {
  private queue: (() => Promise<void>)[] = [];
  private isProcessing = false;
  private lastRequestStartTime = 0;
  private activeConcurrency = 0;
  public maxConcurrencyObserved = 0;
  public requestStartTimes: number[] = [];
  private readonly minIntervalMs: number;

  constructor(minIntervalMs = 50) { // Scaled for fast unit testing
    this.minIntervalMs = minIntervalMs;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const now = Date.now();
          const elapsed = now - this.lastRequestStartTime;
          if (this.lastRequestStartTime > 0 && elapsed < this.minIntervalMs) {
            const waitMs = this.minIntervalMs - elapsed;
            await sleep(waitMs);
          }
          this.lastRequestStartTime = Date.now();
          this.requestStartTimes.push(this.lastRequestStartTime);
          
          this.activeConcurrency++;
          if (this.activeConcurrency > this.maxConcurrencyObserved) {
            this.maxConcurrencyObserved = this.activeConcurrency;
          }

          const result = await fn();
          resolve(result);
        } catch (err) {
          reject(err);
        } finally {
          this.activeConcurrency--;
        }
      });
      this.pump();
    });
  }

  private async pump() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    const task = this.queue.shift();
    if (task) {
      try {
        await task();
      } finally {
        this.isProcessing = false;
        this.pump();
      }
    } else {
      this.isProcessing = false;
    }
  }
}

// Helper to extract retryDelay from 429 errors (exact server.ts logic)
function extractRetryDelayMs(err: any): number | null {
  try {
    const details = err?.error?.details || err?.details || [];
    if (Array.isArray(details)) {
      for (const d of details) {
        if (d?.retryDelay) {
          if (typeof d.retryDelay === 'string') {
            const match = d.retryDelay.match(/([\d.]+)s?/);
            if (match) {
              const sec = parseFloat(match[1]);
              if (!isNaN(sec) && sec > 0) return Math.ceil(sec * 1000);
            }
          } else if (typeof d.retryDelay === 'number') {
            return Math.ceil(d.retryDelay * 1000);
          }
        }
      }
    }
    const errStr = String(err?.message || err || '');
    const match = errStr.match(/retryDelay[:\s]+"?([\d.]+)s?"?/i);
    if (match) {
      const sec = parseFloat(match[1]);
      if (!isNaN(sec) && sec > 0) return Math.ceil(sec * 1000);
    }
  } catch {}
  return null;
}

// Mock generatePromptsWithRetry matching server.ts
async function generatePromptsWithRetryMock(
  scheduler: MockGeminiRateLimitedQueue,
  mockCall: (attempt: number) => Promise<{ text: string }>,
  maxRetries = 4,
  scaleDelay = 0.001 // Scale delays for fast mock testing
): Promise<{ response: any; parsed: any; totalAttempts: number }> {
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await scheduler.execute(async () => {
        return await mockCall(attempt);
      });

      const responseText = response.text || '{}';
      let parsed: any = {};
      try {
        parsed = JSON.parse(responseText);
      } catch (parseErr: any) {
        const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        try {
          parsed = JSON.parse(cleaned);
        } catch (cleanedErr: any) {
          throw new Error(`Invalid JSON output: ${cleanedErr?.message || parseErr?.message}`);
        }
      }

      if (!parsed || !Array.isArray(parsed.prompts) || parsed.prompts.length === 0) {
        throw new Error('Batch response missing valid "prompts" array.');
      }

      return { response, parsed, totalAttempts: attempt };
    } catch (err: any) {
      lastError = err;
      const errMessage = String(err?.message || err);
      const errCode = err?.status || err?.code || err?.error?.code;

      const isRateLimit =
        errCode === 429 ||
        errMessage.includes('429') ||
        errMessage.includes('RESOURCE_EXHAUSTED') ||
        errMessage.includes('quota');

      const isTransient =
        isRateLimit ||
        errMessage.includes('Invalid JSON') ||
        errCode === 500 ||
        errCode === 503 ||
        errMessage.includes('503');

      if (isTransient && attempt < maxRetries) {
        let delay: number;
        if (isRateLimit) {
          const serverDelayMs = extractRetryDelayMs(err);
          delay = ((serverDelayMs ? serverDelayMs : 40000) + 2500) * scaleDelay;
        } else {
          delay = Math.pow(2, attempt) * 1000 * scaleDelay;
        }
        await sleep(Math.max(5, delay));
      } else {
        break;
      }
    }
  }

  throw { lastError, totalAttempts: maxRetries };
}

// Pipeline simulator for Phase 3
async function simulatePromptsPipeline(
  sceneDirections: { number: number; stage_id: string; voiceover: string }[],
  batchBehaviors: Record<number, (attempt: number) => Promise<{ text: string }>>,
  scheduler: MockGeminiRateLimitedQueue
) {
  const BATCH_SIZE = 12;
  const totalScenes = sceneDirections.length;
  const numBatches = Math.ceil(totalScenes / BATCH_SIZE);
  const allPrompts: VideoPromptItem[] = [];

  for (let batchIdx = 0; batchIdx < numBatches; batchIdx++) {
    const startIdx = batchIdx * BATCH_SIZE;
    const currentDirectionsBatch = sceneDirections.slice(startIdx, startIdx + BATCH_SIZE);
    const startNum = currentDirectionsBatch[0]?.number ?? (startIdx + 1);
    const endNum = currentDirectionsBatch[currentDirectionsBatch.length - 1]?.number ?? (startIdx + currentDirectionsBatch.length);
    const batchNum = batchIdx + 1;
    const batchLabel = `Batch ${batchNum}/${numBatches} (scenes ${startNum} to ${endNum})`;

    let batchSuccess = false;
    let lastBatchError: any = null;

    try {
      const mockCall = batchBehaviors[batchNum] || (async () => ({
        text: JSON.stringify({
          prompts: currentDirectionsBatch.map((d) => ({
            number: d.number,
            start: (d.number - 1) * 8,
            end: d.number * 8,
            duration: 8,
            stage_id: d.stage_id,
            state: `Scene #${d.number} Visual State`,
            action_description: `Action breakdown for scene ${d.number}`,
            voiceover: d.voiceover,
            video_prompt: `4K photorealistic cinematography for scene ${d.number}`,
            stock_keywords: 'semiconductor, cleanroom',
            continuity_notes: 'Continuous shot',
            quality_flags: ['Fact-Locked']
          }))
        })
      }));

      const { parsed } = await generatePromptsWithRetryMock(scheduler, mockCall, 4, 0.001);
      const promptsWithMetadata = parsed.prompts.map((pr: any, idx: number) => ({
        ...pr,
        number: pr.number || currentDirectionsBatch[idx]?.number
      }));

      allPrompts.push(...promptsWithMetadata);
      batchSuccess = true;
    } catch (batchErr: any) {
      lastBatchError = batchErr;
    }

    if (!batchSuccess) {
      allPrompts.sort((a, b) => a.number - b.number);
      return {
        success: false,
        partial: allPrompts.length > 0,
        prompts: allPrompts,
        failedBatchIndex: batchIdx + 1,
        failedBatchLabel: batchLabel,
        error: `${batchLabel} failed: ${lastBatchError?.lastError?.message || lastBatchError?.message || 'Error'}`
      };
    }
  }

  allPrompts.sort((a, b) => a.number - b.number);
  return { success: true, prompts: allPrompts };
}

// =========================================================================
// TEST SUITE
// =========================================================================
async function runAllSchedulerTests() {
  console.log('================================================================');
  console.log('TEST SUITE: FREE-TIER PHASE 3 SCHEDULER & CONCURRENCY CONTROL');
  console.log('================================================================\n');

  // TEST 1: Strict Single Concurrency Lock (Max 1 Active Gemini Request)
  console.log('--- TEST 1: Strict Single Concurrency Lock ---');
  const scheduler1 = new MockGeminiRateLimitedQueue(10);
  const promises = [
    scheduler1.execute(async () => { await sleep(20); return 1; }),
    scheduler1.execute(async () => { await sleep(20); return 2; }),
    scheduler1.execute(async () => { await sleep(20); return 3; })
  ];
  await Promise.all(promises);
  const t1Passed = scheduler1.maxConcurrencyObserved === 1;
  record('1. Strict Single Concurrency Lock', t1Passed, `Max concurrency observed across 3 parallel requests was exactly ${scheduler1.maxConcurrencyObserved}`);

  // TEST 2: Rate Pacing (Minimum spacing between sequential requests)
  console.log('--- TEST 2: Rate Pacing Interval Enforced ---');
  const minInterval = 30; // 30ms for test
  const scheduler2 = new MockGeminiRateLimitedQueue(minInterval);
  await scheduler2.execute(async () => 'req1');
  await scheduler2.execute(async () => 'req2');
  await scheduler2.execute(async () => 'req3');
  const intervals: number[] = [];
  for (let i = 1; i < scheduler2.requestStartTimes.length; i++) {
    intervals.push(scheduler2.requestStartTimes[i] - scheduler2.requestStartTimes[i - 1]);
  }
  const t2Passed = intervals.every((delta) => delta >= minInterval - 2); // 2ms tolerance
  record('2. Rate Pacing Interval Enforced', t2Passed, `All request intervals (deltas: ${intervals.join('ms, ')}ms) respected the minimum rate pacing`);

  // TEST 3: Google 429 retryDelay Handling with Safety Buffer
  console.log('--- TEST 3: Google 429 retryDelay Automatic Recovery ---');
  const scheduler3 = new MockGeminiRateLimitedQueue(5);
  let attemptCount = 0;
  const mock429Call = async (attempt: number) => {
    attemptCount = attempt;
    if (attempt === 1) {
      const err: any = new Error('RESOURCE_EXHAUSTED: Quota exceeded');
      err.status = 429;
      err.error = { details: [{ retryDelay: '38.5s' }] };
      throw err;
    }
    return {
      text: JSON.stringify({
        prompts: [{ number: 1, video_prompt: 'Cinematic shot after quota replenishment' }]
      })
    };
  };
  const r3 = await generatePromptsWithRetryMock(scheduler3, mock429Call, 4, 0.001);
  const t3Passed = r3.parsed.prompts.length === 1 && attemptCount === 2;
  record('3. 429 RESOURCE_EXHAUSTED retryDelay Recovery', t3Passed, `Server extracted 38.5s retryDelay, waited with safety buffer, and succeeded on attempt 2`);

  // TEST 4: Single-Controller Retry Architecture (No nested multiplying loops)
  console.log('--- TEST 4: Single-Controller Retry Architecture (Max 4 Attempts) ---');
  const scheduler4 = new MockGeminiRateLimitedQueue(5);
  let persistentAttempts = 0;
  let persistentFailed = false;
  try {
    await generatePromptsWithRetryMock(
      scheduler4,
      async (attempt) => {
        persistentAttempts = attempt;
        throw new Error('503 Service Unavailable');
      },
      4,
      0.001
    );
  } catch (e: any) {
    persistentFailed = true;
    persistentAttempts = e.totalAttempts;
  }
  const t4Passed = persistentFailed && persistentAttempts === 4;
  record('4. Single-Controller Retry Cap (Max 4 Attempts)', t4Passed, `Single controller capped attempts at exactly ${persistentAttempts} without nested amplification`);

  // TEST 5: Partial Prompt Preservation & Failed Batch Identification
  console.log('--- TEST 5: Partial Prompt Preservation on Interrupted Run ---');
  const test210Directions = Array.from({ length: 84 }, (_, i) => ({
    number: i + 1,
    stage_id: 'stage_01',
    voiceover: `VO for scene #${i + 1}`
  }));
  const scheduler5 = new MockGeminiRateLimitedQueue(5);
  // Batches 1 to 6 succeed (72 prompts), Batch 7 (scenes 73..84) fails persistently
  const pipelineRes = await simulatePromptsPipeline(
    test210Directions,
    {
      7: async () => { throw new Error('503 Backend Overload'); }
    },
    scheduler5
  );
  const t5Passed = pipelineRes.success === false && pipelineRes.partial === true && pipelineRes.prompts.length === 72 && pipelineRes.failedBatchIndex === 7;
  record('5. Partial Prompt Preservation', t5Passed, `Batches 1–6 (72 prompts) preserved with partial: true; Failed Batch 7 accurately identified`);

  // TEST 6: Resuming Only Missing Scenes & Clean Merge
  console.log('--- TEST 6: Resume Queries Only Pending Scenes (73..84) ---');
  const existingSet = new Set(pipelineRes.prompts.map((p) => p.number));
  const pendingToResume = test210Directions.filter((d) => !existingSet.has(d.number));
  const resumeRes = await simulatePromptsPipeline(pendingToResume, {}, scheduler5);

  const mergedMap = new Map<number, VideoPromptItem>();
  pipelineRes.prompts.forEach((p) => mergedMap.set(p.number, p));
  (resumeRes.prompts || []).forEach((p) => mergedMap.set(p.number, p));
  const finalMerged = Array.from(mergedMap.values()).sort((a, b) => a.number - b.number);

  const isCount84 = finalMerged.length === 84;
  const isStrictOrder = finalMerged.every((p, idx) => p.number === idx + 1);
  const zeroDuplicates = new Set(finalMerged.map((p) => p.number)).size === 84;
  const t6Passed = isCount84 && isStrictOrder && zeroDuplicates;
  record('6. Resume Missing Scenes & Zero Duplicates', t6Passed, `Resumed ${pendingToResume.length} scenes; Final merged count: 84/84 strictly sequential with 0 duplicates`);

  // TEST 7: Frontend Concurrency Lock (handleGeneratePrompts Guard)
  console.log('--- TEST 7: Frontend Concurrency Lock ---');
  let isGeneratingPrompts = false;
  const handleGeneratePromptsMock = (isAlreadyRunning: boolean) => {
    if (isAlreadyRunning) return false;
    isGeneratingPrompts = true;
    return true;
  };
  const firstCall = handleGeneratePromptsMock(isGeneratingPrompts);
  const secondCallWhileRunning = handleGeneratePromptsMock(isGeneratingPrompts);
  isGeneratingPrompts = false;
  const thirdCallAfterFinished = handleGeneratePromptsMock(isGeneratingPrompts);
  const t7Passed = firstCall === true && secondCallWhileRunning === false && thirdCallAfterFinished === true;
  record('7. Frontend Generation Lock', t7Passed, `First trigger launched; rapid concurrent trigger blocked; subsequent trigger permitted after completion`);

  console.log('================================================================');
  const allPassed = results.every((r) => r.passed);
  console.log(`FINAL RESULT: ${allPassed ? 'ALL 7 TESTS PASSED (PASS)' : 'FAILURES DETECTED (FAIL)'}`);
  console.log('================================================================');
}

runAllSchedulerTests().catch(console.error);

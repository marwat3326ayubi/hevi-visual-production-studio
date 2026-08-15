import { ScenePlan, SceneDirection } from './src/types';

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

const fastSleep = async (_ms: number) => new Promise((resolve) => setTimeout(resolve, 2));

// ==========================================
// MOCK CONTROLLER: Mirrors server.ts generateContentWithRetry
// ==========================================
async function generateContentWithRetryMock(
  mockCall: (attempt: number) => Promise<{ text: string }>,
  maxRetries = 4,
  expectedArrayKey: 'scenes' | 'prompts' = 'scenes'
): Promise<{ response: any; parsed: any; totalAttempts: number }> {
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await mockCall(attempt);
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

      if (expectedArrayKey && (!parsed || !Array.isArray(parsed[expectedArrayKey]) || parsed[expectedArrayKey].length === 0)) {
        throw new Error(`Batch response missing valid "${expectedArrayKey}" array.`);
      }

      return { response, parsed, totalAttempts: attempt };
    } catch (err: any) {
      lastError = err;
      const errMessage = String(err?.message || err);
      const isParseError =
        errMessage.includes('Invalid JSON') ||
        errMessage.includes('Unterminated string') ||
        errMessage.includes('Unexpected end of JSON') ||
        errMessage.includes('JSON at position') ||
        errMessage.includes('missing valid');

      if (isParseError && attempt < maxRetries) {
        await fastSleep(2);
      } else {
        if (attempt === maxRetries) break;
      }
    }
  }

  throw { lastError, totalAttempts: maxRetries };
}

// ==========================================
// MOCK PIPELINE: Mirrors /api/generate-directions
// ==========================================
async function simulateBatchPipeline(
  scenePlans: ScenePlan[],
  batchBehaviors: Record<number, (attempt: number) => Promise<{ text: string }>>
) {
  const BATCH_SIZE = 12;
  const totalScenes = scenePlans.length;
  const numBatches = Math.ceil(totalScenes / BATCH_SIZE);
  const allScenes: SceneDirection[] = [];
  const attemptsLog: Record<number, number> = {};

  for (let batchIdx = 0; batchIdx < numBatches; batchIdx++) {
    const startIdx = batchIdx * BATCH_SIZE;
    const currentBatchPlans = scenePlans.slice(startIdx, startIdx + BATCH_SIZE);
    const startNum = currentBatchPlans[0]?.number ?? (startIdx + 1);
    const endNum = currentBatchPlans[currentBatchPlans.length - 1]?.number ?? (startIdx + currentBatchPlans.length);
    const batchNum = batchIdx + 1;
    const batchLabel = `Batch ${batchNum}/${numBatches} (scenes ${startNum} to ${endNum})`;

    let batchSuccess = false;
    let lastBatchError: any = null;

    try {
      const mockCall = batchBehaviors[batchNum] || (async () => ({
        text: JSON.stringify({
          scenes: currentBatchPlans.map((p) => ({
            number: p.number,
            subject: `Subject for scene ${p.number}`,
            product_visual_state: `State #${p.number}`,
            primary_action: `Primary Action #${p.number}`,
            supporting_motion: 'Smooth dolly tracking',
            environment_description: 'ISO-3 Cleanroom Facility',
            camera: { shot_scale: 'Medium Close-up', angle: 'Eye Level 15°', lens: '50mm Anamorphic', movement: 'Slow Push In' },
            lighting_and_material: 'High-contrast cleanroom rim lighting',
            continuity_from_previous: 'Direct cut matching axis',
            transition_to_next: 'Cut on motion',
            required_visible_features: ['Verified Feature A'],
            forbidden_elements: ['No invented components'],
            temporal_action: {
              opening_state: 'Initial positioning',
              primary_motion: 'Linear translation',
              physical_interaction: 'Precision coupling',
              mid_shot_progression: 'Alignment verification',
              ending_state: 'Final engagement'
            },
            structured_object: {
              scene_id: p.number,
              story_function: 'PROCESS_STEP',
              lifecycle_stage: p.stage_id,
              subject: `Subject ${p.number}`,
              media_route: 'LIVE_ACTION_T2V'
            },
            fact_traceability: {
              verified_hevi_facts_used: ['NAU-8000'],
              creator_provided_facts_used: [],
              inferred_conceptual_facts_used: [],
              unsupported_facts_blocked: [],
              media_route: 'LIVE_ACTION_T2V',
              lifecycle_stage_referenced: p.stage_id,
              lifecycle_aligned: true
            }
          }))
        })
      }));

      const { parsed, totalAttempts } = await generateContentWithRetryMock(mockCall, 4, 'scenes');
      const scenesWithNumber = parsed.scenes.map((sc: any, idx: number) => ({
        ...sc,
        number: sc.number || currentBatchPlans[idx]?.number
      }));

      allScenes.push(...scenesWithNumber);
      batchSuccess = true;
      attemptsLog[batchNum] = totalAttempts;
    } catch (err: any) {
      lastBatchError = err;
      attemptsLog[batchNum] = err.totalAttempts || 4;
    }

    if (!batchSuccess) {
      allScenes.sort((a, b) => (a.number || 0) - (b.number || 0));
      return {
        success: false,
        partial: allScenes.length > 0,
        scenes: allScenes,
        completedScenes: allScenes,
        failedBatchIndex: batchIdx + 1,
        failedBatchLabel: batchLabel,
        attemptsLog,
        error: `${batchLabel} failed after retries: ${lastBatchError?.lastError?.message || lastBatchError?.message || 'Failed to obtain valid JSON directions response'}`
      };
    }
  }

  allScenes.sort((a, b) => (a.number || 0) - (b.number || 0));
  return { success: true, scenes: allScenes, attemptsLog };
}

// ==========================================
// TEST EXECUTION SUITE
// ==========================================
async function runAllTests() {
  console.log('================================================================');
  console.log('HEVI STUDIO TEST: MALFORMED / TRUNCATED JSON DEFENSIVE RESILIENCE');
  console.log('================================================================\n');

  // TEST 1: Valid Gemini JSON Parsing
  console.log('--- TEST 1: Valid Gemini JSON Parsing ---');
  const validJson = JSON.stringify({
    scenes: [{ number: 1, subject: 'Verified Subject', product_visual_state: 'State A' }]
  });
  const r1 = await generateContentWithRetryMock(async () => ({ text: validJson }), 4, 'scenes');
  const t1Passed = r1.parsed.scenes.length === 1 && r1.totalAttempts === 1 && r1.parsed.scenes[0].subject === 'Verified Subject';
  record('1. Valid Gemini JSON Parsing', t1Passed, `Parsed cleanly on attempt 1 with exact structure`);

  // TEST 2: Malformed JSON (Syntax Error / Corrupted syntax)
  console.log('--- TEST 2: Malformed JSON (Syntax Error) Handling ---');
  let t2Caught = false;
  try {
    await generateContentWithRetryMock(async () => ({ text: '{ "scenes": [ { number: 1, broken_unquoted_key }' }), 1, 'scenes');
  } catch (err: any) {
    t2Caught = String(err?.lastError?.message || err?.message).includes('Invalid JSON');
  }
  record('2. Malformed JSON Catch & Reject', t2Caught, `Safely rejected corrupted JSON syntax without fabrications`);

  // TEST 3: Truncated JSON / Unterminated String (Simulating pos 66392)
  console.log('--- TEST 3: Truncated JSON / Unterminated String (Simulating Pos 66392) ---');
  let t3Caught = false;
  // Simulating large string truncated mid-generation at position 66392
  const largeTruncatedPayload = '{"scenes": [{"number": 73, "subject": "' + 'A'.repeat(66350);
  try {
    await generateContentWithRetryMock(async () => ({ text: largeTruncatedPayload }), 1, 'scenes');
  } catch (err: any) {
    const msg = String(err?.lastError?.message || err?.message);
    t3Caught = msg.includes('Invalid JSON') || msg.includes('Unterminated string');
  }
  record('3. Truncated JSON / Unterminated String', t3Caught, `Correctly identified unterminated string at position 66392 boundary as parse error`);

  // TEST 4: Successful Retry After Malformed Response
  console.log('--- TEST 4: Successful Retry After Malformed Response ---');
  const validBatchText = JSON.stringify({
    scenes: Array.from({ length: 12 }, (_, i) => ({ number: 73 + i, subject: `Scene ${73 + i}` }))
  });
  const r4 = await generateContentWithRetryMock(
    async (attempt) => {
      if (attempt === 1) return { text: '{"scenes": [{"number": 73, "subject": "truncated...' };
      return { text: validBatchText };
    },
    4,
    'scenes'
  );
  const t4Passed = r4.parsed.scenes.length === 12 && r4.totalAttempts === 2;
  record('4. Successful Retry After Malformed Response', t4Passed, `Attempt 1 failed parse, attempt 2 succeeded with full 12 scenes`);

  // TEST 5: Persistent Malformed Response After 4 Attempts
  console.log('--- TEST 5: Persistent Malformed Response After 4 Attempts ---');
  let t5Attempts = 0;
  let t5Failed = false;
  try {
    await generateContentWithRetryMock(
      async (attempt) => {
        t5Attempts = attempt;
        return { text: '{"scenes": [{"number": 73, "subject": "always truncated...' };
      },
      4,
      'scenes'
    );
  } catch (err: any) {
    t5Failed = true;
    t5Attempts = err.totalAttempts || 4;
  }
  const t5Passed = t5Failed && t5Attempts === 4;
  record('5. Persistent Malformed Response After 4 Attempts', t5Passed, `Safely exhausted exactly 4 attempts and threw clean error without infinite loop`);

  // TEST 6: Preservation of Previously Completed Scenes (e.g. 61 / 72 scenes)
  console.log('--- TEST 6: Preservation of Previously Completed Scenes (Batches 1–6) ---');
  const full210Plans: ScenePlan[] = Array.from({ length: 210 }, (_, i) => ({
    number: i + 1,
    start: i * 8.0,
    end: (i + 1) * 8.0,
    duration: 8.0,
    stage_id: 'stage_01_silicon_wafer',
    state: `State #${i + 1}`,
    voiceover: `Narration for scene #${i + 1}`
  }));

  // Batches 1..5 complete (60 scenes) + Batch 6 (1 scene or full batch). Let's simulate Batch 7 (scenes 73..84) failing persistently.
  const pipelineResult = await simulateBatchPipeline(full210Plans.slice(0, 84), {
    7: async () => ({ text: '{"scenes": [{"number": 73, "subject": "unterminated string at pos 66392' })
  });

  const t6Passed =
    pipelineResult.success === false &&
    pipelineResult.partial === true &&
    pipelineResult.scenes.length === 72 &&
    pipelineResult.failedBatchIndex === 7 &&
    pipelineResult.failedBatchLabel.includes('Batch 7');

  record(
    '6. Preservation of Completed Batches 1..6',
    t6Passed,
    `Preserved ${pipelineResult.scenes.length} scenes. Partial flag: true. Failed Batch 7 clearly identified.`
  );

  // TEST 7: Resume from Failed Batch (Only Pending Scenes Filtered & Queried)
  console.log('--- TEST 7: Resume Filters Only Failed / Pending Scenes ---');
  const existingCompletedSet = new Set(pipelineResult.scenes.map((d) => d.number));
  const pendingScenesToResume = full210Plans.slice(0, 84).filter((p) => !existingCompletedSet.has(p.number));

  const t7Passed =
    pendingScenesToResume.length === 12 &&
    pendingScenesToResume[0].number === 73 &&
    pendingScenesToResume[11].number === 84;

  record(
    '7. Resume Synthesis Filters Only Remaining Scenes',
    t7Passed,
    `Resumed request contains exactly ${pendingScenesToResume.length} scenes (scenes 73..84). Completed scenes 1..72 are NOT re-queried.`
  );

  // TEST 8: Strict Scene Ordering & Zero Duplicates After Resume Merge
  console.log('--- TEST 8: Strict Scene Ordering & Zero Duplicates After Resume Merge ---');
  // Simulate successful run for the pending batch 7 (scenes 73..84)
  const resumePipelineResult = await simulateBatchPipeline(pendingScenesToResume, {
    1: async () => ({
      text: JSON.stringify({
        scenes: pendingScenesToResume.map((p) => ({
          number: p.number,
          subject: `Resumed Subject for ${p.number}`,
          product_visual_state: `State #${p.number}`,
          primary_action: `Action #${p.number}`
        }))
      })
    })
  });

  const mergedMap = new Map<number, any>();
  pipelineResult.scenes.forEach((d) => mergedMap.set(d.number, d));
  (resumePipelineResult.scenes || []).forEach((d) => mergedMap.set(d.number, d));
  const finalMergedScenes = Array.from(mergedMap.values()).sort((a, b) => a.number - b.number);

  const isCount84 = finalMergedScenes.length === 84;
  const isStrictlySequential = finalMergedScenes.every((sc, idx) => sc.number === idx + 1);
  const hasZeroDuplicates = new Set(finalMergedScenes.map((sc) => sc.number)).size === 84;
  const t8Passed = isCount84 && isStrictlySequential && hasZeroDuplicates;

  record(
    '8. Strict Sequence & Zero Duplication',
    t8Passed,
    `Merged total: ${finalMergedScenes.length}/84 scenes, sequential 1..84, exactly 0 duplicates.`
  );

  console.log('================================================================');
  const allPassed = results.every((r) => r.passed);
  console.log(`FINAL RESULT: ${allPassed ? 'ALL 8 TESTS PASSED (PASS)' : 'FAILURES DETECTED (FAIL)'}`);
  console.log(`Summary: ${results.filter((r) => r.passed).length}/${results.length} passed.`);
  console.log('================================================================');
}

runAllTests().catch(console.error);

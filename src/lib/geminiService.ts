import { GoogleGenAI, Type } from '@google/genai';
import { ProductionJson, ScenePlan, SceneDirection, VideoPromptItem, T2VProfile } from '../types';

export interface GenerateDirectionsParams {
  productionJson: ProductionJson;
  scenePlansBatch: ScenePlan[];
  modelName?: string;
  customApiKey?: string;
  creatorFacts?: string[];
}

export interface GenerateDirectionsResult {
  success: boolean;
  partial?: boolean;
  scenes: SceneDirection[];
  completedScenes?: SceneDirection[];
  failedBatchIndex?: number;
  failedBatchLabel?: string;
  error?: string;
}

export interface GeneratePromptsParams {
  productionJson: ProductionJson;
  sceneDirectionsBatch: SceneDirection[];
  scenePlansBatch: ScenePlan[];
  t2vProfile?: T2VProfile;
  modelName?: string;
  customApiKey?: string;
  creatorFacts?: string[];
}

export interface GeneratePromptsResult {
  success: boolean;
  partial?: boolean;
  prompts: VideoPromptItem[];
  completedPrompts?: VideoPromptItem[];
  failedBatchIndex?: number;
  failedBatchLabel?: string;
  error?: string;
}

/**
 * Server-Side GenAI Client Initializer
 * Uses server process.env.GEMINI_API_KEY or process.env.API_KEY, with optional customApiKey override.
 */
export function getGenAIClient(customKey?: string): GoogleGenAI {
  const apiKey =
    (customKey && typeof customKey === 'string' && customKey.trim()) ||
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY;

  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is missing in server environment. Please set GEMINI_API_KEY in Google AI Studio secrets or provide a custom API key in the request.'
    );
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

/**
 * Helper to extract retryDelay from Gemini 429 / RESOURCE_EXHAUSTED errors.
 */
export function extractRetryDelayMs(err: any): number | null {
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
          } else if (d.retryDelay?.seconds) {
            const sec = Number(d.retryDelay.seconds) + Number(d.retryDelay.nanos || 0) / 1e9;
            if (!isNaN(sec) && sec > 0) return Math.ceil(sec * 1000);
          }
        }
      }
    }

    const errStr = String(err?.message || err || '');
    const regexMatch =
      errStr.match(/retryDelay[:\s]+"?([\d.]+)s?"?/i) ||
      errStr.match(/retry\s+after[:\s]+([\d.]+)s?/i) ||
      errStr.match(/retry\s+in[:\s]+([\d.]+)s?/i);
    if (regexMatch) {
      const sec = parseFloat(regexMatch[1]);
      if (!isNaN(sec) && sec > 0) return Math.ceil(sec * 1000);
    }
  } catch {}
  return null;
}

/**
 * Global request queue enforcing strictly 1 active Gemini request at a time with ≥5000ms rate limiting (≤12 RPM for Free Tier).
 */
export class GeminiRateLimitedQueue {
  private queue: (() => Promise<void>)[] = [];
  private isProcessing = false;
  private lastRequestStartTime = 0;
  private readonly minIntervalMs: number;

  constructor(minIntervalMs = 5000) {
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
            console.log(`[Gemini Scheduler] Pacing request (waiting ${waitMs}ms to enforce ≤12 RPM Free-Tier budget)...`);
            await new Promise((r) => setTimeout(r, waitMs));
          }
          this.lastRequestStartTime = Date.now();
          const result = await fn();
          resolve(result);
        } catch (err) {
          reject(err);
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

export const geminiScheduler = new GeminiRateLimitedQueue(5000);

/**
 * Helper to execute Gemini content generation with retry, fallback, and robust JSON validation.
 */
export async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: {
    model: string;
    contents: any;
    config: any;
  },
  maxRetries = 4,
  expectedArrayKey?: 'scenes' | 'prompts'
): Promise<{ response: any; parsed: any }> {
  const modelCandidate = params.model || 'gemini-3.6-flash';
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Gemini Request] Model "${modelCandidate}" (Attempt ${attempt}/${maxRetries})...`);
      const response = await geminiScheduler.execute(async () => {
        return await ai.models.generateContent({
          ...params,
          model: modelCandidate,
          config: {
            ...params.config,
            maxOutputTokens: params.config?.maxOutputTokens || 65536
          }
        });
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

      if (expectedArrayKey && (!parsed || !Array.isArray(parsed[expectedArrayKey]) || parsed[expectedArrayKey].length === 0)) {
        throw new Error(`Batch response missing valid "${expectedArrayKey}" array.`);
      }

      return { response, parsed };
    } catch (err: any) {
      lastError = err;
      const errMessage = String(err?.message || err);
      const errCode = err?.status || err?.code || err?.error?.code;

      const isRateLimit =
        errCode === 429 ||
        errMessage.includes('429') ||
        errMessage.includes('RESOURCE_EXHAUSTED') ||
        errMessage.includes('rate limit') ||
        errMessage.includes('quota');

      const isParseError =
        errMessage.includes('Invalid JSON') ||
        errMessage.includes('Unterminated string') ||
        errMessage.includes('Unexpected end of JSON') ||
        errMessage.includes('JSON at position') ||
        errMessage.includes('missing valid');

      const isTransient =
        isRateLimit ||
        isParseError ||
        errCode === 500 ||
        errCode === 503 ||
        errMessage.includes('500') ||
        errMessage.includes('503') ||
        errMessage.includes('INTERNAL') ||
        errMessage.includes('Internal error') ||
        errMessage.includes('high demand') ||
        errMessage.includes('UNAVAILABLE') ||
        errMessage.includes('OVERLOADED') ||
        errMessage.includes('ECONNRESET') ||
        errMessage.includes('fetch failed') ||
        errMessage.includes('ETIMEDOUT') ||
        errMessage.includes('socket hang up');

      console.warn(`[Gemini API Warning] Model "${modelCandidate}" attempt ${attempt} failed: ${errMessage}`);

      if (isTransient && attempt < maxRetries) {
        let delay: number;
        if (isRateLimit) {
          const serverDelayMs = extractRetryDelayMs(err);
          delay = (serverDelayMs ? serverDelayMs : 40000) + 2500 + Math.floor(Math.random() * 1500);
          console.warn(
            `[Gemini 429 Quota Delay] Server requested retryDelay. Waiting ${Math.round(
              delay / 1000
            )}s for Free Tier quota recovery before attempt ${attempt + 1}/${maxRetries}...`
          );
        } else {
          delay = Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 1000);
          console.log(`[Gemini API Retry] Retrying in ${delay}ms...`);
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        break;
      }
    }
  }

  throw lastError;
}

/**
 * Phase 2: Generate Scene Directions via Gemini (Server-Side Handler)
 */
export async function generateDirectionsService({
  productionJson,
  scenePlansBatch,
  modelName = 'gemini-3.6-flash',
  customApiKey,
  creatorFacts = []
}: GenerateDirectionsParams): Promise<GenerateDirectionsResult> {
  if (!productionJson || !scenePlansBatch || !Array.isArray(scenePlansBatch)) {
    throw new Error('Missing productionJson or scenePlansBatch array.');
  }

  const ai = getGenAIClient(customApiKey);

  const systemInstruction = `You are HEVI VISUAL PRODUCTION STUDIO's master AI director operating under strict Fact-Lock and HEVI Engine V2 handoff contract rules.

STRICT FACT-LOCK & MEDIA ROUTING DIRECTIVES:
1. FACT-LOCK LAYER:
   - Every visual fact used in scene directions must be traceable to:
     a) imported HEVI JSON (${productionJson.product?.official_name || 'UNSPECIFIED Subject'}),
     b) imported reference assets / geometry modules,
     c) or explicitly creator-provided facts (${JSON.stringify(creatorFacts)}).
   - NEVER invent product components, materials, geometry, dimensions, manufacturing stages, facility identity, machinery, mechanisms, markings, or technical details.
   - Only CONFIRMED and CREATOR_PROVIDED facts may be presented as verified physical details.

2. NARRATION PRESERVATION:
   - Preserve the user's original narration/voiceover text attached to each scene EXACTLY as provided. Do NOT invent, complete, rewrite, summarize, or extrapolate missing or existing narration.
   - Normalize minor typos in model or brand names (such as "DeepSeq" -> "DeepSeek") while preserving the exact original narration text otherwise.

3. NUMERICAL & PARAMETER CLAIMS ATTRIBUTION (e.g. 1.6 trillion, 49 billion):
   - In all generated visual descriptions, scene directions, on-screen text concepts, and subjects, keep numerical claims explicitly attributed as reported, claimed, or narrated figures (e.g., "motion graphic illustrating reported parameter claim") rather than presenting them as independently verified physical hardware facts.

4. EMPTY FIELDS & ANTI-HALLUCINATION POLICY:
   - If fields (product identity, geometry_modules, reference_assets, environments, production_stages) are empty or missing, DO NOT SILENTLY INVENT THEM.
   - CRITICAL: You must NEVER compensate for missing facts by inventing a generic industrial object or physical product claim.
   - DO NOT turn missing data into: "industrial assembly line", "robotic gantry", "server rack", "factory", "automated facility", "machine", "chip", "module", "generic modular server assembly frame", or fictional facility interiors.
   - SOFTWARE / COMPUTING / PARAMETER CLAIMS: When the script discusses AI software, model parameters, algorithms, architecture claims, or software performance and no verified physical hardware identity exists, use safe conceptual visualization (MOTION_GRAPHIC or STATIC_GRAPHIC).
   - LIVE_ACTION_T2V is allowed only for generic non-specific contextual visuals (e.g., generic desk, abstract light studio, non-specific workspace).

5. MEDIA ROUTING LOGIC (Choose exactly one per scene in structured_object.media_route):
   - LIVE_ACTION_T2V: Safe generic contextual representation without unsupported product-specific physical claims.
   - REFERENCE_IMAGE_I2V: Exact geometry/configuration/component appearance/identity matters and reliable reference asset exists.
   - AUTHENTIC_REFERENCE_MEDIA: Specific authentic real events, certified tests, or historical moments.
   - STATIC_GRAPHIC: Diagrams, labels, maps, specs, comparisons, blueprints.
   - MOTION_GRAPHIC: Invisible mechanisms, conceptual systems, parameter relationships, computing relationships, process flows, energy/heat flow, supply chains.
   - EDITOR_ONLY: Requires manual multi-pass compositing.
   - NO_VALID_ROUTE: Scene demands exact product geometry/identity/facility truth but data is missing.

6. LIFECYCLE ROUTING & CONSISTENCY:
   - Every scene must inspect the imported HEVI lifecycle data.
   - If valid production stage exists: use that exact stage_id and only facts supported by that stage.
   - If no production stage exists: set lifecycle_stage = "UNSUPPORTED" and state = "NO VERIFIED LIFECYCLE STAGE".
   - NEVER invent a production stage, NEVER default to stage_01_assembly, and NEVER create fake manufacturing stages.

7. AUTOMATIC NEGATIVE CONSTRAINTS (Inject into forbidden_elements & must_not_show):
   "No invented components", "No geometry changes", "No product substitution", "No variant mixing", "No impossible mechanical motion", "No unsupported materials", "No invented facility identity", "No fictional logos", "No fake labels", "No random text", "No premature assembly", "No later lifecycle components appearing early", "No morphing", "No duplicate objects", "No unsupported dimensions".

8. VISUAL RHYTHM & CAMERA PACING DIRECTIVES:
   - Target preferred scene duration of 4–10 seconds (7 seconds optimal pacing).
   - Enforce maximum 2 consecutive scenes from the same visual family (e.g., macro detail, full product, CAD diagram, context scene).
   - Enforce maximum 2 consecutive full-product scenes to avoid visual monotony.
   - Vary camera angles (e.g., Eye Level, High Angle, 45° Quarter, Close-up) and camera movements (e.g., Slow Push In, Lateral Orbit, Stationary Locked, Slow Trucking) between adjacent scenes.
   - Use context → process → detail → payoff visual cycles where supported.

9. STRUCTURED-FIRST GENERATION:
   First construct the internal structured_object, then compile the final direction fields from it. Include fact_traceability for each scene.

10. CONCISE SPECIFICATIONS & OUTPUT BOUNDS:
   - Keep visual descriptions, action narratives, and temporal progression points concise and impactful (1-2 sentences per field).
   - Avoid verbose repetitive paragraphs or filler prose.
   - Provide 2-5 key items for required_visible_features and forbidden_elements to keep JSON compact and prevent output token buffer overrun.`;

  const directionsResponseSchema = {
    type: Type.OBJECT,
    properties: {
      scenes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            number: { type: Type.INTEGER },
            subject: { type: Type.STRING },
            product_visual_state: { type: Type.STRING },
            primary_action: { type: Type.STRING },
            supporting_motion: { type: Type.STRING },
            environment_description: { type: Type.STRING },
            camera: {
              type: Type.OBJECT,
              properties: {
                shot_scale: { type: Type.STRING },
                angle: { type: Type.STRING },
                lens: { type: Type.STRING },
                movement: { type: Type.STRING }
              },
              required: ['shot_scale', 'angle', 'lens', 'movement']
            },
            lighting_and_material: { type: Type.STRING },
            continuity_from_previous: { type: Type.STRING },
            transition_to_next: { type: Type.STRING },
            required_visible_features: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            forbidden_elements: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            temporal_action: {
              type: Type.OBJECT,
              properties: {
                opening_state: { type: Type.STRING },
                primary_motion: { type: Type.STRING },
                physical_interaction: { type: Type.STRING },
                mid_shot_progression: { type: Type.STRING },
                ending_state: { type: Type.STRING }
              },
              required: ['opening_state', 'primary_motion', 'physical_interaction', 'mid_shot_progression', 'ending_state']
            },
            structured_object: {
              type: Type.OBJECT,
              properties: {
                scene_id: { type: Type.INTEGER },
                story_function: { type: Type.STRING },
                lifecycle_stage: { type: Type.STRING },
                subject: { type: Type.STRING },
                subject_state: { type: Type.STRING },
                environment: { type: Type.STRING },
                visual_family: { type: Type.STRING },
                media_route: { type: Type.STRING },
                evidence_status: { type: Type.STRING },
                verified_features: { type: Type.ARRAY, items: { type: Type.STRING } },
                primary_action: { type: Type.STRING },
                supporting_motion: { type: Type.STRING },
                camera: {
                  type: Type.OBJECT,
                  properties: {
                    shot_scale: { type: Type.STRING },
                    angle: { type: Type.STRING },
                    lens: { type: Type.STRING },
                    movement: { type: Type.STRING }
                  }
                },
                lighting: { type: Type.STRING },
                continuity_from_previous: { type: Type.STRING },
                transition_to_next: { type: Type.STRING },
                must_show: { type: Type.ARRAY, items: { type: Type.STRING } },
                must_not_show: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            },
            fact_traceability: {
              type: Type.OBJECT,
              properties: {
                verified_hevi_facts_used: { type: Type.ARRAY, items: { type: Type.STRING } },
                creator_provided_facts_used: { type: Type.ARRAY, items: { type: Type.STRING } },
                inferred_conceptual_facts_used: { type: Type.ARRAY, items: { type: Type.STRING } },
                unsupported_facts_blocked: { type: Type.ARRAY, items: { type: Type.STRING } },
                media_route: { type: Type.STRING },
                lifecycle_stage_referenced: { type: Type.STRING },
                lifecycle_aligned: { type: Type.BOOLEAN }
              }
            }
          },
          required: [
            'number',
            'subject',
            'product_visual_state',
            'primary_action',
            'supporting_motion',
            'environment_description',
            'camera',
            'lighting_and_material',
            'continuity_from_previous',
            'transition_to_next',
            'required_visible_features',
            'forbidden_elements',
            'temporal_action'
          ]
        }
      }
    },
    required: ['scenes']
  };

  const BATCH_SIZE = 12;
  const totalScenes = scenePlansBatch.length;
  const numBatches = Math.ceil(totalScenes / BATCH_SIZE);
  const allScenes: SceneDirection[] = [];

  console.log(`[Directions Generation] Processing ${totalScenes} scenes across ${numBatches} batch(es)...`);

  for (let batchIdx = 0; batchIdx < numBatches; batchIdx++) {
    const startIdx = batchIdx * BATCH_SIZE;
    const currentBatchPlans = scenePlansBatch.slice(startIdx, startIdx + BATCH_SIZE);
    const startNum = currentBatchPlans[0]?.number ?? startIdx + 1;
    const endNum = currentBatchPlans[currentBatchPlans.length - 1]?.number ?? startIdx + currentBatchPlans.length;
    const batchLabel = `Batch ${batchIdx + 1}/${numBatches} (scenes ${startNum} to ${endNum})`;

    const userPrompt = `Generate Structured Scene Directions & Fact Traceability for ${currentBatchPlans.length} scene plans (${batchLabel}):

PRODUCTION CONTEXT (FACT-LOCK INDEX):
Product Identity: ${JSON.stringify(productionJson.product || { official_name: 'Unspecified' })}
Production Stages: ${JSON.stringify(productionJson.production_stages || [])}
Environments: ${JSON.stringify(productionJson.environments || [])}
Geometry Modules: ${JSON.stringify(productionJson.geometry_modules || [])}
Reference Assets: ${JSON.stringify(productionJson.reference_assets || [])}
Creator Facts: ${JSON.stringify(creatorFacts)}

SCENE PLANS TO PROCESS IN THIS BATCH:
${JSON.stringify(currentBatchPlans, null, 2)}

Return a structured JSON object containing a "scenes" array matching these ${currentBatchPlans.length} scenes in exact sequence.`;

    let batchSuccess = false;
    let lastBatchError: any = null;

    try {
      console.log(`[Directions Generation] Executing ${batchLabel}...`);
      const { parsed } = await generateContentWithRetry(
        ai,
        {
          model: modelName,
          contents: userPrompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: directionsResponseSchema,
            maxOutputTokens: 65536
          }
        },
        4,
        'scenes'
      );

      const scenesWithNumber = parsed.scenes.map((sc: any, idx: number) => {
        const expectedPlan = currentBatchPlans[idx];
        if (expectedPlan && expectedPlan.number) {
          return { ...sc, number: sc.number || expectedPlan.number };
        }
        return sc;
      });

      allScenes.push(...scenesWithNumber);
      batchSuccess = true;
      console.log(`[Directions Generation] Successfully completed ${batchLabel} (${parsed.scenes.length} scenes).`);

      const BATCH_PACING_MS = 5000;
      if (batchIdx < numBatches - 1) {
        console.log(`[Directions Pacing] Waiting ${BATCH_PACING_MS}ms before next batch to protect Free Tier RPM quota (≤12 RPM)...`);
        await new Promise((resolve) => setTimeout(resolve, BATCH_PACING_MS));
      }
    } catch (batchErr: any) {
      lastBatchError = batchErr;
      console.warn(`[Directions Batch Error] ${batchLabel} failed: ${batchErr.message || batchErr}`);
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
        error: `${batchLabel} failed after retries: ${lastBatchError?.message || 'Failed to obtain valid JSON directions response'}`
      };
    }
  }

  allScenes.sort((a, b) => (a.number || 0) - (b.number || 0));
  return { success: true, scenes: allScenes };
}

/**
 * Phase 3: Generate T2V Prompts via Gemini (Server-Side Handler)
 */
export async function generatePromptsService({
  productionJson,
  sceneDirectionsBatch,
  scenePlansBatch,
  t2vProfile = 'OMNI_FLASH',
  modelName = 'gemini-3.6-flash',
  customApiKey,
  creatorFacts = []
}: GeneratePromptsParams): Promise<GeneratePromptsResult> {
  if (!sceneDirectionsBatch || !Array.isArray(sceneDirectionsBatch)) {
    throw new Error('Missing sceneDirectionsBatch array.');
  }

  const ai = getGenAIClient(customApiKey);

  const profileRules =
    t2vProfile === 'OMNI_FLASH'
      ? `TARGET PROFILE: GEMINI OMNI FLASH
Focus on:
- Believable physical motion and weight dynamics
- Exact product geometry fidelity (${productionJson.product?.official_name || 'Generic Product'})
- Coherent continuous shot camera behavior
- Environmental lighting and material reflectance response`
      : `TARGET PROFILE: VEO / GOOGLE FLOW
Focus on:
- Highly specific, concise video-generation prompt structure
- One continuous shot with clear opening state, primary physical action, and ending state
- Physically plausible motion without visual clutter or impossible physics`;

  const systemInstruction = `You are HEVI VISUAL PRODUCTION STUDIO's prompt engineer enforcing strict FACT-LOCK rules.

${profileRules}

STRICT FACT-LOCK VALIDATION BEFORE PROMPT PROSE:
1. Validate every product-specific noun, component, material, mechanism, environment, and production stage claim against the imported HEVI JSON and creator facts.
2. REJECT or REPLACE any unsupported details. Never invent component names or uninstalled parts.
3. Automatically append negative constraints: "No invented components, no geometry changes, no product substitution, no variant mixing, no impossible mechanical motion, no unsupported materials, no invented facility identity, no fictional logos, no fake labels, no random text, no premature assembly, no morphing".
4. NARRATION PRESERVATION: Preserve the user's original imported voiceover text attached to each scene exactly. Do NOT invent, complete, rewrite, summarize, or extrapolate missing or existing narration. Normalize minor typos in model or brand names while preserving the exact narration text otherwise.
5. NUMERICAL CLAIMS ATTRIBUTION: In synthesized video prompts (video_prompt), keep numerical claims explicitly attributed as reported, claimed, or narrated figures (e.g., "motion graphic on-screen showing reported parameter claim" or "visualizing narrated figures") rather than independently verified physical facts.
6. Provide fact_traceability for each scene.
7. CONCISE PROMPT PROSE & BOUNDS:
   - Synthesize a dense, vivid, and continuous shot video prompt (2-4 sentences max per scene).
   - Keep action_description, continuity_notes, and quality_flags focused and concise to prevent token buffer overruns.`;

  const promptsResponseSchema = {
    type: Type.OBJECT,
    properties: {
      prompts: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            number: { type: Type.INTEGER },
            start: { type: Type.NUMBER },
            end: { type: Type.NUMBER },
            duration: { type: Type.NUMBER },
            stage_id: { type: Type.STRING },
            state: { type: Type.STRING },
            action_description: { type: Type.STRING },
            voiceover: { type: Type.STRING },
            video_prompt: { type: Type.STRING },
            stock_keywords: { type: Type.STRING },
            continuity_notes: { type: Type.STRING },
            quality_flags: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            fact_traceability: {
              type: Type.OBJECT,
              properties: {
                verified_hevi_facts_used: { type: Type.ARRAY, items: { type: Type.STRING } },
                creator_provided_facts_used: { type: Type.ARRAY, items: { type: Type.STRING } },
                inferred_conceptual_facts_used: { type: Type.ARRAY, items: { type: Type.STRING } },
                unsupported_facts_blocked: { type: Type.ARRAY, items: { type: Type.STRING } },
                media_route: { type: Type.STRING },
                lifecycle_stage_referenced: { type: Type.STRING },
                lifecycle_aligned: { type: Type.BOOLEAN }
              }
            }
          },
          required: [
            'number',
            'start',
            'end',
            'duration',
            'stage_id',
            'state',
            'action_description',
            'voiceover',
            'video_prompt',
            'stock_keywords',
            'continuity_notes',
            'quality_flags'
          ]
        }
      }
    },
    required: ['prompts']
  };

  const BATCH_SIZE = 12;
  const totalScenes = sceneDirectionsBatch.length;
  const numBatches = Math.ceil(totalScenes / BATCH_SIZE);
  const allPrompts: VideoPromptItem[] = [];

  console.log(`[Prompts Generation] Processing ${totalScenes} scenes across ${numBatches} batch(es)...`);

  for (let batchIdx = 0; batchIdx < numBatches; batchIdx++) {
    const startIdx = batchIdx * BATCH_SIZE;
    const currentDirectionsBatch = sceneDirectionsBatch.slice(startIdx, startIdx + BATCH_SIZE);
    const currentPlansBatch = scenePlansBatch ? scenePlansBatch.slice(startIdx, startIdx + BATCH_SIZE) : [];

    const startNum = currentDirectionsBatch[0]?.number ?? startIdx + 1;
    const endNum = currentDirectionsBatch[currentDirectionsBatch.length - 1]?.number ?? startIdx + currentDirectionsBatch.length;
    const batchLabel = `Batch ${batchIdx + 1}/${numBatches} (scenes ${startNum} to ${endNum})`;

    const userPrompt = `Synthesize T2V Video Prompts and Fact Traceability for scene directions (${batchLabel}):

PRODUCTION METADATA:
Product: ${productionJson.product?.official_name || 'Unspecified'} (${productionJson.product?.exact_variant || 'Base Variant'})
Creator Facts: ${JSON.stringify(creatorFacts)}
Global Negative constraints: ${JSON.stringify(productionJson.product?.global_negative_constraints || [])}

SCENE DATA TO PROCESS IN THIS BATCH:
${JSON.stringify(
  currentDirectionsBatch.map((sd: any, idx: number) => {
    const plan = (currentPlansBatch?.[idx] || {}) as Partial<ScenePlan>;
    return {
      direction: sd,
      plan_metadata: {
        number: sd.number || plan.number,
        start: plan.start,
        end: plan.end,
        duration: plan.duration,
        stage_id: plan.stage_id,
        voiceover: plan.voiceover
      }
    };
  }),
  null,
  2
)}

Return a structured JSON object containing a "prompts" array in exact sequence for these ${currentDirectionsBatch.length} scenes.`;

    let batchSuccess = false;
    let lastBatchError: any = null;

    try {
      console.log(`[Prompts Generation] Executing ${batchLabel}...`);
      const { parsed } = await generateContentWithRetry(
        ai,
        {
          model: modelName,
          contents: userPrompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: promptsResponseSchema,
            maxOutputTokens: 65536
          }
        },
        4,
        'prompts'
      );

      const promptsWithMetadata = parsed.prompts.map((pr: any, idx: number) => {
        const plan = currentPlansBatch?.[idx];
        const dir = currentDirectionsBatch?.[idx];
        return {
          ...pr,
          number: pr.number || dir?.number || plan?.number,
          start: pr.start ?? plan?.start,
          end: pr.end ?? plan?.end,
          duration: pr.duration ?? plan?.duration,
          voiceover: pr.voiceover || plan?.voiceover || ''
        };
      });

      allPrompts.push(...promptsWithMetadata);
      batchSuccess = true;
      console.log(`[Prompts Generation] Successfully completed ${batchLabel} (${parsed.prompts.length} prompts).`);

      const BATCH_PACING_MS = 5000;
      if (batchIdx < numBatches - 1) {
        console.log(`[Prompts Pacing] Waiting ${BATCH_PACING_MS}ms before next batch to protect Free Tier RPM quota (≤12 RPM)...`);
        await new Promise((resolve) => setTimeout(resolve, BATCH_PACING_MS));
      }
    } catch (batchErr: any) {
      lastBatchError = batchErr;
      console.warn(`[Prompts Batch Error] ${batchLabel} failed: ${batchErr.message || batchErr}`);
    }

    if (!batchSuccess) {
      allPrompts.sort((a, b) => (a.number || 0) - (b.number || 0));
      return {
        success: false,
        partial: allPrompts.length > 0,
        prompts: allPrompts,
        completedPrompts: allPrompts,
        failedBatchIndex: batchIdx + 1,
        failedBatchLabel: batchLabel,
        error: `${batchLabel} failed after retries: ${lastBatchError?.message || 'Failed to obtain valid JSON prompts response'}`
      };
    }
  }

  allPrompts.sort((a, b) => (a.number || 0) - (b.number || 0));
  return { success: true, prompts: allPrompts };
}

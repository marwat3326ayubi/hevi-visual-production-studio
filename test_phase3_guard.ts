import { ScenePlan, SceneDirection } from './src/types';

// Mocking the VoDirectionView button disabled & label calculation
function getPhase3ButtonState(scenePlans: ScenePlan[], sceneDirections: SceneDirection[]) {
  const disabled = scenePlans.length === 0 || sceneDirections.length < scenePlans.length;
  const label = sceneDirections.length < scenePlans.length
    ? `Complete All Directions (${sceneDirections.length}/${scenePlans.length})`
    : 'Proceed to 03 T2V PROMPTS';
  return { disabled, label };
}

// Mocking the handleGeneratePrompts guard
function handleGeneratePromptsGuard(
  scenePlans: ScenePlan[],
  sceneDirections: SceneDirection[],
  setErrorMessage: (msg: string) => void
): boolean {
  if (!sceneDirections || sceneDirections.length < scenePlans.length) {
    setErrorMessage(
      `Please complete all ${scenePlans.length} scene directions before generating T2V prompts (${sceneDirections.length}/${scenePlans.length} done).`
    );
    return false;
  }
  return true; // Passed completeness guard
}

function runVerification() {
  console.log('================================================================');
  console.log('PHASE 2 -> PHASE 3 TRANSITION COMPLETENESS GUARD VERIFICATION');
  console.log('================================================================\n');

  const plans210: ScenePlan[] = Array.from({ length: 210 }, (_, i) => ({
    number: i + 1,
    start: i * 8,
    end: (i + 1) * 8,
    duration: 8,
    stage_id: 'stage_01',
    state: `State ${i + 1}`,
    voiceover: `VO ${i + 1}`
  }));

  const dirs200: SceneDirection[] = Array.from({ length: 200 }, (_, i) => ({
    number: i + 1,
    subject: `Subject ${i + 1}`,
    product_visual_state: `State ${i + 1}`,
    primary_action: `Action ${i + 1}`,
    supporting_motion: '',
    environment_description: '',
    camera: { shot_scale: '', angle: '', lens: '', movement: '' },
    lighting_and_material: '',
    continuity_from_previous: '',
    transition_to_next: '',
    required_visible_features: [],
    forbidden_elements: [],
    temporal_action: { opening_state: '', primary_motion: '', physical_interaction: '', mid_shot_progression: '', ending_state: '' }
  }));

  const dirs210: SceneDirection[] = Array.from({ length: 210 }, (_, i) => ({
    ...dirs200[0],
    number: i + 1
  }));

  let lastErrorMessage = '';
  const setErrorMessage = (msg: string) => { lastErrorMessage = msg; };

  // TEST 1: At 200/210 directions, Phase 3 button is disabled with dynamic progress label
  const btn200 = getPhase3ButtonState(plans210, dirs200);
  const t1Passed = btn200.disabled === true && btn200.label === 'Complete All Directions (200/210)';
  console.log(`[${t1Passed ? 'PASS' : 'FAIL'}] 1. At 200/210 directions: Phase 3 button disabled`);
  console.log(`    -> disabled: ${btn200.disabled}, label: "${btn200.label}"\n`);

  // TEST 2: At 210/210 directions, Phase 3 button is enabled with Proceed label
  const btn210 = getPhase3ButtonState(plans210, dirs210);
  const t2Passed = btn210.disabled === false && btn210.label === 'Proceed to 03 T2V PROMPTS';
  console.log(`[${t2Passed ? 'PASS' : 'FAIL'}] 2. At 210/210 directions: Phase 3 button enabled`);
  console.log(`    -> disabled: ${btn210.disabled}, label: "${btn210.label}"\n`);

  // TEST 3: Calling handleGeneratePrompts at 200/210 is rejected
  lastErrorMessage = '';
  const res200 = handleGeneratePromptsGuard(plans210, dirs200, setErrorMessage);
  const t3Passed = res200 === false && lastErrorMessage === 'Please complete all 210 scene directions before generating T2V prompts (200/210 done).';
  console.log(`[${t3Passed ? 'PASS' : 'FAIL'}] 3. Calling handleGeneratePrompts at 200/210 rejected`);
  console.log(`    -> result: ${res200}, error: "${lastErrorMessage}"\n`);

  // TEST 4: Calling handleGeneratePrompts at 210/210 passes
  lastErrorMessage = '';
  const res210 = handleGeneratePromptsGuard(plans210, dirs210, setErrorMessage);
  const t4Passed = res210 === true && lastErrorMessage === '';
  console.log(`[${t4Passed ? 'PASS' : 'FAIL'}] 4. Calling handleGeneratePrompts at 210/210 passes guard`);
  console.log(`    -> result: ${res210}, error: "${lastErrorMessage}"\n`);

  const allPassed = t1Passed && t2Passed && t3Passed && t4Passed;
  console.log('================================================================');
  console.log(`FINAL RESULT: ${allPassed ? 'ALL VERIFICATIONS PASSED (PASS)' : 'FAILURES DETECTED (FAIL)'}`);
  console.log('================================================================');
}

runVerification();

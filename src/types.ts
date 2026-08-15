export interface HeviProduct {
  official_name: string;
  exact_variant?: string;
  category?: string;
  description?: string;
  global_negative_constraints?: string[];
}

export interface ProductionStage {
  id: string;
  name: string;
  description: string;
  verified_components?: string[];
}

export interface Environment {
  id: string;
  name: string;
  description: string;
  lighting_profile?: string;
}

export interface GeometryModule {
  id: string;
  name: string;
  type: string;
  specifications?: string;
}

export interface ReferenceAsset {
  id: string;
  name: string;
  type: string;
  url?: string;
  notes?: string;
}

export interface ProductionJson {
  product: HeviProduct;
  production_stages?: ProductionStage[];
  environments?: Environment[];
  geometry_modules?: GeometryModule[];
  reference_assets?: ReferenceAsset[];
  [key: string]: any;
}

export interface ScenePlan {
  number: number;
  start: number;
  end: number;
  duration: number;
  stage_id: string;
  state: string;
  voiceover: string;
}

export interface CameraDirections {
  shot_scale: string;
  angle: string;
  lens: string;
  movement: string;
}

export interface TemporalAction {
  opening_state: string;
  primary_motion: string;
  physical_interaction: string;
  mid_shot_progression: string;
  ending_state: string;
}

export interface FactTraceability {
  verified_hevi_facts_used: string[];
  creator_provided_facts_used: string[];
  inferred_conceptual_facts_used: string[];
  unsupported_facts_blocked: string[];
  media_route: string;
  lifecycle_stage_referenced: string;
  lifecycle_aligned: boolean;
}

export interface StructuredSceneObject {
  scene_id?: number;
  story_function?: string;
  lifecycle_stage?: string;
  subject?: string;
  subject_state?: string;
  environment?: string;
  visual_family?: string;
  media_route?: string;
  evidence_status?: string;
  verified_features?: string[];
  primary_action?: string;
  supporting_motion?: string;
  camera?: CameraDirections;
  lighting?: string;
  continuity_from_previous?: string;
  transition_to_next?: string;
  must_show?: string[];
  must_not_show?: string[];
}

export interface SceneDirection {
  number: number;
  subject: string;
  product_visual_state: string;
  primary_action: string;
  supporting_motion: string;
  environment_description: string;
  camera: CameraDirections;
  lighting_and_material: string;
  continuity_from_previous: string;
  transition_to_next: string;
  required_visible_features: string[];
  forbidden_elements: string[];
  temporal_action: TemporalAction;
  structured_object?: StructuredSceneObject;
  fact_traceability?: FactTraceability;
}

export interface VideoPromptItem {
  number: number;
  start: number;
  end: number;
  duration: number;
  stage_id: string;
  state: string;
  action_description: string;
  voiceover: string;
  video_prompt: string;
  stock_keywords: string;
  continuity_notes: string;
  quality_flags: string[];
  fact_traceability?: FactTraceability;
}

export type T2VProfile = 'OMNI_FLASH' | 'VEO_FLOW';

export interface GenerationSettings {
  modelName: string;
  t2vProfile: T2VProfile;
  customApiKey: string;
  channelProfile?: string;
}

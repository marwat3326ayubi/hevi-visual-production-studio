import { ProductionJson } from '../types';

export interface ContractValidationResult {
  isValid: boolean;
  statusType: 'VALID_CONTRACT' | 'VALID_CONTRACT_WITH_EMPTY_OPTIONAL_DATA' | 'INVALID_CONTRACT';
  errors: string[];
  warnings: string[];
  normalizedJson: ProductionJson;
  extractedFacts: string[];
}

/**
 * Validates and normalizes client-uploaded JSON against the HEVI V2 Production Handoff Contract.
 */
export function validateHeviV2Contract(rawData: any): ContractValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
    return {
      isValid: false,
      statusType: 'INVALID_CONTRACT',
      errors: ['Root document must be a valid JSON object.'],
      warnings: [],
      normalizedJson: {
        schema: { version: '2.0.0', contract_type: 'VISUAL_ONLY_ENGINE_TO_APP_HANDOFF' },
        product: { official_name: '' }
      },
      extractedFacts: []
    };
  }

  // Schema Validation
  const rawSchema = rawData.schema || {};
  const schemaVersion = String(rawSchema.version || '2.0.0').trim();

  if (schemaVersion !== '2.0.0') {
    warnings.push(`Expected HEVI V2 schema.version "2.0.0", received "${schemaVersion}". Normalizing schema version to "2.0.0".`);
  }

  const schema = {
    version: '2.0.0',
    contract_type: 'VISUAL_ONLY_ENGINE_TO_APP_HANDOFF',
    ...rawSchema
  };

  // Required 10 top-level keys check
  const requiredContractKeys = [
    'schema',
    'product',
    'dimensions_and_proportions',
    'geometry_modules',
    'reference_assets',
    'environments',
    'production_stages',
    'stage_transitions',
    'visual_story_plan',
    'global_prompt_rules'
  ];

  requiredContractKeys.forEach((key) => {
    if (rawData[key] === undefined) {
      warnings.push(`Contract field "${key}" not found in handoff JSON. Initializing empty structure.`);
    }
  });

  // Normalize Product Identity
  let product = rawData.product;
  if (!product && typeof rawData.official_name === 'string') {
    product = {
      official_name: rawData.official_name,
      exact_variant: rawData.exact_variant || '',
      category: rawData.category || '',
      description: rawData.description || ''
    };
  }

  if (!product) {
    errors.push('Missing required "product" specification object in HEVI V2 contract JSON.');
  } else if (!product.official_name || typeof product.official_name !== 'string' || !product.official_name.trim()) {
    errors.push('"product.official_name" is required and must be a non-empty string.');
  }

  // Normalize Production Stages
  let productionStages: any[] = [];
  if (Array.isArray(rawData.production_stages)) {
    productionStages = rawData.production_stages.map((stage: any, idx: number) => {
      if (!stage.id || typeof stage.id !== 'string') {
        warnings.push(`Production stage at index ${idx} missing string "id". Generated fallback ID.`);
      }
      return {
        id: stage.id || `stage_${idx + 1}`,
        name: stage.name || `Stage ${idx + 1}`,
        description: stage.description || '',
        verified_components: Array.isArray(stage.verified_components) ? stage.verified_components : []
      };
    });
  } else if (rawData.production_stages) {
    warnings.push('"production_stages" field present but not an array.');
  }

  if (productionStages.length === 0) {
    warnings.push('VALID CONTRACT WITH EMPTY OPTIONAL DATA: "production_stages" array is empty. Pipeline will operate without pre-defined manufacturing stages.');
  }

  // Normalize Environments
  let environments: any[] = [];
  if (Array.isArray(rawData.environments)) {
    environments = rawData.environments.map((env: any, idx: number) => ({
      id: env.id || `env_${idx + 1}`,
      name: env.name || `Environment ${idx + 1}`,
      description: env.description || '',
      lighting_profile: env.lighting_profile || ''
    }));
  }

  // Normalize Geometry Modules
  let geometryModules: any[] = [];
  if (Array.isArray(rawData.geometry_modules)) {
    geometryModules = rawData.geometry_modules.map((mod: any, idx: number) => ({
      id: mod.id || `geom_${idx + 1}`,
      name: mod.name || `Module ${idx + 1}`,
      type: mod.type || 'Subsystem',
      specifications: mod.specifications || ''
    }));
  }

  // Normalize Reference Assets
  let referenceAssets: any[] = [];
  if (Array.isArray(rawData.reference_assets)) {
    referenceAssets = rawData.reference_assets.map((asset: any, idx: number) => ({
      id: asset.id || `ref_${idx + 1}`,
      name: asset.name || `Asset ${idx + 1}`,
      type: asset.type || 'Reference Document',
      notes: asset.notes || ''
    }));
  }

  // Extract Creator Facts if present
  let extractedFacts: string[] = [];
  const rawFacts = rawData.creator_facts || rawData.creatorFacts || rawData.facts;
  if (Array.isArray(rawFacts)) {
    extractedFacts = rawFacts.filter((f: any) => typeof f === 'string' && f.trim().length > 0);
  }

  const hasEmptyOptionalData =
    productionStages.length === 0 ||
    geometryModules.length === 0 ||
    environments.length === 0 ||
    referenceAssets.length === 0;

  const statusType = errors.length > 0
    ? 'INVALID_CONTRACT'
    : hasEmptyOptionalData
    ? 'VALID_CONTRACT_WITH_EMPTY_OPTIONAL_DATA'
    : 'VALID_CONTRACT';

  const normalizedJson: ProductionJson = {
    schema,
    product: {
      official_name: product?.official_name?.trim() || '',
      exact_variant: product?.exact_variant?.trim() || '',
      category: product?.category?.trim() || '',
      description: product?.description?.trim() || '',
      global_negative_constraints: Array.isArray(product?.global_negative_constraints)
        ? product.global_negative_constraints
        : [
            "No invented components",
            "No geometry changes",
            "No product substitution",
            "No variant mixing",
            "No impossible mechanical motion",
            "No unsupported materials",
            "No invented facility identity",
            "No fictional logos",
            "No fake labels",
            "No random text",
            "No premature assembly",
            "No morphing"
          ]
    },
    dimensions_and_proportions: rawData.dimensions_and_proportions || {},
    geometry_modules: geometryModules,
    reference_assets: referenceAssets,
    environments: environments,
    production_stages: productionStages,
    stage_transitions: Array.isArray(rawData.stage_transitions) ? rawData.stage_transitions : [],
    visual_story_plan: rawData.visual_story_plan || {},
    global_prompt_rules: rawData.global_prompt_rules || {}
  };

  return {
    isValid: errors.length === 0,
    statusType,
    errors,
    warnings,
    normalizedJson,
    extractedFacts
  };
}


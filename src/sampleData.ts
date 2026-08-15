import { ProductionJson, ScenePlan } from './types';

export const SAMPLE_PRODUCTION_JSON: ProductionJson = {
  schema: {
    version: "2.0.0",
    contract_type: "VISUAL_ONLY_ENGINE_TO_APP_HANDOFF"
  },
  product: {
    official_name: "HEVI-V2 Neural Acceleration Unit (NAU-8000)",
    exact_variant: "Liquid-Cooled Enterprise Edition",
    category: "AI Semiconductor Subsystem",
    description: "Next-generation high-density neural processing accelerator designed for enterprise datacenters with integrated die-to-die optical interconnects.",
    global_negative_constraints: [
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
  dimensions_and_proportions: {
    form_factor: "2U PCIe Server Blade Module",
    dimensions_mm: "440mm x 220mm x 88mm",
    weight_kg: 8.5
  },
  production_stages: [
    {
      id: "stage_01_silicon_wafer",
      name: "Stage 01: Photolithography & Wafer Inspection",
      description: "Monolithic 3nm EUV lithography etched silicon wafer being inspected under darkfield ultraviolet automated optical inspection.",
      verified_components: ["300mm Silicon Wafer", "EUV Reticle Pattern", "AOI Alignment Notch"]
    },
    {
      id: "stage_02_interposer_die_attach",
      name: "Stage 02: 2.5D/3D Chiplet Die-Attach & Micro-Bumping",
      description: "Precision automated pickup arm placing high-bandwidth memory chiplets onto micro-bump copper interposer substrate.",
      verified_components: ["High Bandwidth Memory Chiplets", "Silicon Interposer", "Thermal Interface Material (TIM-1)"]
    },
    {
      id: "stage_03_vapor_chamber_coldplate",
      name: "Stage 03: Liquid Cooling Vapor Chamber Sealing",
      description: "Nickel-plated copper micro-channel coldplate vacuum sealed directly onto the primary processor package.",
      verified_components: ["Micro-channel Copper Coldplate", "Dual Barb Quick-Disconnect Fittings", "Laser Welded Perimeter Seal"]
    },
    {
      id: "stage_04_datacenter_rack_deployment",
      name: "Stage 04: Server Node Rack Insertion & Active Fluid Flow",
      description: "Dual-socket 2U accelerator blade inserted into 42U datacenter server cabinet with active coolant circulation.",
      verified_components: ["2U Stainless Steel Blade Enclosure", "Blind-mate Quick Connectors", "Status LED Array"]
    }
  ],
  environments: [
    {
      id: "env_cleanroom_iso3",
      name: "Class 10 ISO-3 Cleanroom",
      description: "Ultra-clean semiconductor fabrication cleanroom with yellow ultraviolet-filtered laminar air flow lighting.",
      lighting_profile: "589nm Monochromatic Amber Cleanroom Glow"
    },
    {
      id: "env_assembly_robotic_bay",
      name: "Advanced Automation Assembly Bay",
      description: "High-precision robotic assembly cell with matte dark slate ESD flooring and crisp 5600K diffused overhead panels.",
      lighting_profile: "5600K Neutral Industrial Daylight"
    },
    {
      id: "env_datacenter_cold_aisle",
      name: "Datacenter Hyperscale Cold Aisle",
      description: "High-density server corridor with brushed steel rack cabinets, dark perforated floor tiles, and blue status LED illumination.",
      lighting_profile: "Cool White Rim Lighting with Accent Blue LED Beams"
    }
  ],
  geometry_modules: [
    {
      id: "geom_interposer_substrate",
      name: "65mm x 65mm Organic Interposer Substrate",
      type: "Package Substrate",
      specifications: "12-layer high-density organic interposer with 55µm micro-bump pitch"
    },
    {
      id: "geom_liquid_coldplate",
      name: "Vapor Chamber Liquid Coldplate",
      type: "Thermal Subsystem",
      specifications: "50-micron internal fin copper micro-channel structure with nickel plating"
    }
  ],
  reference_assets: [
    {
      id: "ref_cad_assembly_exploded",
      name: "NAU-8000 Exploded Assembly CAD Model",
      type: "CAD / STEP File",
      notes: "Official mechanical CAD reference confirming coldplate screw torque points and fluid inlet geometry."
    },
    {
      id: "ref_fab_spec_doc",
      name: "Fab Packaging Datasheet v2.4",
      type: "PDF Technical Spec",
      notes: "Verified silicon stack height 3.12mm including die-attach TIM."
    }
  ],
  stage_transitions: [
    { from: "stage_01_silicon_wafer", to: "stage_02_interposer_die_attach", mode: "Precision robotic pick and place" },
    { from: "stage_02_interposer_die_attach", to: "stage_03_vapor_chamber_coldplate", mode: "Thermal interface material application and laser sealing" },
    { from: "stage_03_vapor_chamber_coldplate", to: "stage_04_datacenter_rack_deployment", mode: "Server blade rack insertion and fluid quick-connect" }
  ],
  visual_story_plan: {
    target_pacing: "8-10s scenes",
    primary_theme: "Industrial Precision Semiconductor Engineering"
  },
  global_prompt_rules: {
    resolution: "4K Cinema Quality",
    lighting: "Industrial Studio / Photorealistic Photolithography Lighting"
  }
};

export const SAMPLE_CREATOR_FACTS: string[] = [
  "Official product name is NAU-8000 Enterprise Liquid Edition.",
  "Coolant fluid is non-conductive dielectric engineered fluorinert liquid.",
  "Uses dual quick-disconnect fittings color-coded blue (inlet) and orange (outlet).",
  "No exposed wiring harness or ribbon cables on the exterior coldplate assembly."
];

export const SAMPLE_SCENE_PLANS: ScenePlan[] = [
  {
    number: 1,
    start: 0.0,
    end: 4.5,
    duration: 4.5,
    stage_id: "stage_01_silicon_wafer",
    state: "EUV Photolithography Inspection",
    voiceover: "At the atomic frontier of silicon engineering, the HEVI-V2 Neural Acceleration Unit begins on a single 300-millimeter monocrystalline wafer."
  },
  {
    number: 2,
    start: 4.5,
    end: 9.0,
    duration: 4.5,
    stage_id: "stage_02_interposer_die_attach",
    state: "High-Precision 2.5D Die Attachment",
    voiceover: "Utilizing sub-micron 3D chiplet packaging, high-bandwidth memory dies are bonded directly onto an organic micro-bump interposer."
  },
  {
    number: 3,
    start: 9.0,
    end: 14.0,
    duration: 5.0,
    stage_id: "stage_03_vapor_chamber_coldplate",
    state: "Micro-Channel Coldplate Laser Sealing",
    voiceover: "To dissipate extreme thermal loads during deep learning training, a nickel-plated copper micro-channel coldplate is vacuum laser-welded onto the module."
  },
  {
    number: 4,
    start: 14.0,
    end: 19.5,
    duration: 5.5,
    stage_id: "stage_04_datacenter_rack_deployment",
    state: "Datacenter Rack Blade Insertion & Fluid Flow",
    voiceover: "Slotted seamlessly into hyperscale server nodes, dielectric coolant circulates at peak efficiency to power the world's most demanding generative AI workloads."
  }
];

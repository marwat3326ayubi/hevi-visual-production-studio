import React, { useState, useEffect } from 'react';
import {
  ProductionJson,
  ScenePlan,
  SceneDirection,
  VideoPromptItem,
  GenerationSettings
} from './types';
import {
  SAMPLE_PRODUCTION_JSON,
  SAMPLE_CREATOR_FACTS,
  SAMPLE_SCENE_PLANS
} from './sampleData';
import { Header } from './components/Header';
import { HeviJsonEditor } from './components/HeviJsonEditor';
import { VoDirectionView } from './components/VoDirectionView';
import { PromptsView } from './components/PromptsView';
import { ExportModal } from './components/ExportModal';
import { AlertCircle, X } from 'lucide-react';

const EMPTY_PRODUCTION_JSON: ProductionJson = {
  schema: {
    version: "2.0.0",
    contract_type: "VISUAL_ONLY_ENGINE_TO_APP_HANDOFF"
  },
  product: {
    official_name: "",
    exact_variant: "",
    category: "",
    description: "",
    global_negative_constraints: []
  },
  dimensions_and_proportions: {},
  geometry_modules: [],
  reference_assets: [],
  environments: [],
  production_stages: [],
  stage_transitions: [],
  visual_story_plan: {},
  global_prompt_rules: {}
};

function getProjectKey(prodJson: ProductionJson, plans: ScenePlan[]): string {
  const prodName = (prodJson.product?.official_name || 'unnamed_product').replace(/\s+/g, '_');
  const planCount = plans.length;
  const firstVo = plans[0]?.voiceover ? plans[0].voiceover.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_') : 'empty';
  return `hevi_v2_${prodName}_${planCount}_${firstVo}`;
}

export function App() {
  const [productionJson, setProductionJson] = useState<ProductionJson>(EMPTY_PRODUCTION_JSON);
  const [creatorFacts, setCreatorFacts] = useState<string[]>([]);
  const [scenePlans, setScenePlans] = useState<ScenePlan[]>([]);
  const [sceneDirections, setSceneDirections] = useState<SceneDirection[]>([]);
  const [videoPrompts, setVideoPrompts] = useState<VideoPromptItem[]>([]);

  // Safe localStorage restoration when project/transcript is active
  useEffect(() => {
    if (scenePlans.length === 0) return;
    const key = getProjectKey(productionJson, scenePlans);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const cachedDirs = localStorage.getItem(`${key}_directions`);
        if (cachedDirs && sceneDirections.length === 0) {
          const parsed = JSON.parse(cachedDirs);
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log(`[LocalStorage] Restored ${parsed.length} cached directions for project "${key}"`);
            setSceneDirections(parsed);
          }
        }
        const cachedPrompts = localStorage.getItem(`${key}_prompts`);
        if (cachedPrompts && videoPrompts.length === 0) {
          const parsed = JSON.parse(cachedPrompts);
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log(`[LocalStorage] Restored ${parsed.length} cached prompts for project "${key}"`);
            setVideoPrompts(parsed);
          }
        }
      }
    } catch (e) {
      console.warn('[LocalStorage] Failed to restore cached state:', e);
    }
  }, [productionJson.product?.official_name, scenePlans.length]);

  const [activeTab, setActiveTab] = useState<'json' | 'vo_direction' | 'prompts'>('json');

  const handleTabChange = (tab: 'json' | 'vo_direction' | 'prompts') => {
    setErrorMessage(null);
    setActiveTab(tab);
  };
  const [settings, setSettings] = useState<GenerationSettings>({
    modelName: 'gemini-3.6-flash',
    t2vProfile: 'OMNI_FLASH',
    customApiKey: '',
    channelProfile: 'Channel 1'
  });

  const [isGeneratingDirections, setIsGeneratingDirections] = useState(false);
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const handleResetSample = () => {
    const key = getProjectKey(SAMPLE_PRODUCTION_JSON, SAMPLE_SCENE_PLANS);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(`${key}_directions`);
        localStorage.removeItem(`${key}_prompts`);
      }
    } catch {}
    setProductionJson(SAMPLE_PRODUCTION_JSON);
    setCreatorFacts(SAMPLE_CREATOR_FACTS);
    setScenePlans(SAMPLE_SCENE_PLANS);
    setSceneDirections([]);
    setVideoPrompts([]);
    setErrorMessage(null);
  };

  const handleClearData = () => {
    const key = getProjectKey(productionJson, scenePlans);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(`${key}_directions`);
        localStorage.removeItem(`${key}_prompts`);
      }
    } catch {}
    setProductionJson(EMPTY_PRODUCTION_JSON);
    setCreatorFacts([]);
    setScenePlans([]);
    setSceneDirections([]);
    setVideoPrompts([]);
    setErrorMessage(null);
  };

  const handleGenerateDirections = async (forceRegenerateAll = false): Promise<boolean> => {
    if (!scenePlans || scenePlans.length === 0) {
      setErrorMessage('Please add or upload VO transcript scene plans before generating directions.');
      return false;
    }

    const key = getProjectKey(productionJson, scenePlans);
    if (forceRegenerateAll) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.removeItem(`${key}_directions`);
        }
      } catch {}
    }

    // Determine pending scene plans that still need directions
    const existingDirs = forceRegenerateAll ? [] : sceneDirections;
    const existingSceneNums = new Set(existingDirs.map((d) => d.number));
    const pendingPlans = scenePlans.filter((p) => !existingSceneNums.has(p.number));

    if (pendingPlans.length === 0 && !forceRegenerateAll) {
      return true;
    }

    setIsGeneratingDirections(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/generate-directions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productionJson,
          scenePlansBatch: pendingPlans.length > 0 ? pendingPlans : scenePlans,
          modelName: settings.modelName,
          customApiKey: settings.customApiKey,
          creatorFacts
        })
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(`Server returned unexpected response (${res.status} ${res.statusText || 'Error'}): ${text.slice(0, 150)}`);
      }

      // Merge newly completed scenes with existing scenes without duplicate numbers
      const newlyCompleted: SceneDirection[] = data.scenes || data.completedScenes || [];
      if (newlyCompleted.length > 0) {
        const mergedMap = new Map<number, SceneDirection>();
        existingDirs.forEach((d) => mergedMap.set(d.number, d));
        newlyCompleted.forEach((d) => mergedMap.set(d.number, d));
        const merged = Array.from(mergedMap.values()).sort((a, b) => a.number - b.number);
        setSceneDirections(merged);
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem(`${key}_directions`, JSON.stringify(merged));
          }
        } catch (storageErr) {
          console.warn('[LocalStorage] Could not save directions:', storageErr);
        }
      }

      if (!res.ok || !data.success) {
        const currentCount = existingDirs.length + newlyCompleted.length;
        const baseErr = data.error || 'Failed to generate all scene directions.';
        const hint = currentCount > 0
          ? ` (${currentCount}/${scenePlans.length} scenes preserved. Click "Synthesize Phase 2 Directions" to resume remaining ${scenePlans.length - currentCount} scenes)`
          : '';
        throw new Error(`${baseErr}${hint}`);
      }

      return true;
    } catch (err: any) {
      console.error('Directions Generation Error:', err);
      setErrorMessage(err.message || 'An error occurred while generating scene directions.');
      return false;
    } finally {
      setIsGeneratingDirections(false);
    }
  };

  const handleGeneratePrompts = async (forceRegenerateAll = false): Promise<boolean> => {
    if (isGeneratingPrompts) {
      console.warn('[Phase 3] Prompt generation is already running. Ignoring duplicate trigger.');
      return false;
    }

    if (!sceneDirections || sceneDirections.length < scenePlans.length) {
      setErrorMessage(
        `Please complete all ${scenePlans.length} scene directions before generating T2V prompts (${sceneDirections.length}/${scenePlans.length} done).`
      );
      return false;
    }

    const key = getProjectKey(productionJson, scenePlans);
    if (forceRegenerateAll) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.removeItem(`${key}_prompts`);
        }
      } catch {}
    }

    const existingP = forceRegenerateAll ? [] : videoPrompts;
    const existingPromptNums = new Set(existingP.map((p) => p.number));
    const pendingDirections = sceneDirections.filter((d) => !existingPromptNums.has(d.number));
    const pendingPlans = scenePlans.filter((p) => !existingPromptNums.has(p.number));

    if (pendingDirections.length === 0 && !forceRegenerateAll) {
      setActiveTab('prompts');
      return true;
    }

    setIsGeneratingPrompts(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/generate-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productionJson,
          sceneDirectionsBatch: pendingDirections.length > 0 ? pendingDirections : sceneDirections,
          scenePlansBatch: pendingPlans.length > 0 ? pendingPlans : scenePlans,
          t2vProfile: settings.t2vProfile,
          modelName: settings.modelName,
          customApiKey: settings.customApiKey,
          creatorFacts
        })
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(`Server returned unexpected response (${res.status} ${res.statusText || 'Error'}): ${text.slice(0, 150)}`);
      }

      const newlyCompleted: VideoPromptItem[] = data.prompts || data.completedPrompts || [];
      if (newlyCompleted.length > 0) {
        const mergedMap = new Map<number, VideoPromptItem>();
        existingP.forEach((p) => mergedMap.set(p.number, p));
        newlyCompleted.forEach((p) => mergedMap.set(p.number, p));
        const merged = Array.from(mergedMap.values()).sort((a, b) => a.number - b.number);
        setVideoPrompts(merged);
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem(`${key}_prompts`, JSON.stringify(merged));
          }
        } catch (storageErr) {
          console.warn('[LocalStorage] Could not save prompts:', storageErr);
        }
      }

      if (!res.ok || !data.success) {
        const currentCount = existingP.length + newlyCompleted.length;
        const baseErr = data.error || 'Failed to generate all T2V prompts.';
        const hint = currentCount > 0
          ? ` (${currentCount}/${sceneDirections.length} prompts preserved. Click to resume remaining ${sceneDirections.length - currentCount} prompts)`
          : '';
        throw new Error(`${baseErr}${hint}`);
      }

      setActiveTab('prompts');
      return true;
    } catch (err: any) {
      console.error('Prompts Generation Error:', err);
      setErrorMessage(err.message || 'An error occurred while generating video prompts.');
      return false;
    } finally {
      setIsGeneratingPrompts(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col">
      
      {/* Top Application Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        settings={settings}
        setSettings={setSettings}
        hasDirections={sceneDirections.length > 0}
        hasPrompts={videoPrompts.length > 0}
        onResetSample={handleResetSample}
        onClearData={handleClearData}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Error Notification Banner */}
        {errorMessage && (
          <div className="mb-6 bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 text-rose-300 text-xs flex items-start justify-between gap-3 shadow-lg font-mono">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-rose-200">Execution Error</div>
                <div className="mt-0.5 leading-relaxed">{errorMessage}</div>
              </div>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="p-1 text-rose-400 hover:text-rose-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Phase 1: HEVI JSON */}
        {activeTab === 'json' && (
          <HeviJsonEditor
            productionJson={productionJson}
            setProductionJson={setProductionJson}
            creatorFacts={creatorFacts}
            setCreatorFacts={setCreatorFacts}
            onContinueToTimeline={() => handleTabChange('vo_direction')}
            onClearData={handleClearData}
          />
        )}

        {/* Phase 2: VO & Direction */}
        {activeTab === 'vo_direction' && (
          <VoDirectionView
            scenePlans={scenePlans}
            setScenePlans={setScenePlans}
            sceneDirections={sceneDirections}
            productionStages={productionJson.production_stages || []}
            settings={settings}
            onGenerateDirections={handleGenerateDirections}
            isGeneratingDirections={isGeneratingDirections}
            onContinueToPrompts={handleGeneratePrompts}
            isGeneratingPrompts={isGeneratingPrompts}
          />
        )}

        {/* Phase 3: T2V Prompts */}
        {activeTab === 'prompts' && (
          <PromptsView
            prompts={videoPrompts}
            settings={settings}
            setSettings={setSettings}
            onOpenExport={() => setIsExportOpen(true)}
            onBackToDirections={() => handleTabChange('vo_direction')}
            onRegeneratePrompts={handleGeneratePrompts}
            isGeneratingPrompts={isGeneratingPrompts}
            totalExpectedPrompts={sceneDirections.length || scenePlans.length}
          />
        )}

      </main>

      {/* Export Package Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        productionJson={productionJson}
        creatorFacts={creatorFacts}
        scenePlans={scenePlans}
        sceneDirections={sceneDirections}
        videoPrompts={videoPrompts}
      />

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-4 text-center text-[11px] text-zinc-500 font-mono">
        <p>HEVI VISUAL PRODUCTION STUDIO v2.1 • FACT-LOCK ANTI-HALLUCINATION ENGINE</p>
      </footer>

    </div>
  );
}

export default App;

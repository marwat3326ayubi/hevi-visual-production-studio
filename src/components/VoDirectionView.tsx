import React, { useState, useRef } from 'react';
import { ScenePlan, SceneDirection, ProductionStage, GenerationSettings } from '../types';
import {
  Layers,
  Clock,
  Mic,
  Plus,
  Trash2,
  Sparkles,
  Loader2,
  ArrowRight,
  Upload,
  Camera,
  ShieldCheck,
  EyeOff,
  Check,
  Video,
  FileText,
  Sliders,
  Compass
} from 'lucide-react';

interface VoDirectionViewProps {
  scenePlans: ScenePlan[];
  setScenePlans: (plans: ScenePlan[]) => void;
  sceneDirections: SceneDirection[];
  productionStages: ProductionStage[];
  settings: GenerationSettings;
  onGenerateDirections: () => Promise<boolean> | void;
  isGeneratingDirections: boolean;
  onContinueToPrompts: () => void;
  isGeneratingPrompts?: boolean;
}

export const VoDirectionView: React.FC<VoDirectionViewProps> = ({
  scenePlans,
  setScenePlans,
  sceneDirections,
  productionStages,
  settings,
  onGenerateDirections,
  isGeneratingDirections,
  onContinueToPrompts,
  isGeneratingPrompts = false
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'timeline' | 'directions'>('timeline');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddScene = () => {
    const lastScene = scenePlans[scenePlans.length - 1];
    const newStart = lastScene ? lastScene.end : 0.0;
    const newEnd = newStart + 8.0;
    const newPlan: ScenePlan = {
      number: scenePlans.length + 1,
      start: newStart,
      end: newEnd,
      duration: 8.0,
      stage_id: productionStages[0]?.id || 'UNSUPPORTED',
      state: `Scene #${scenePlans.length + 1} State`,
      voiceover: ''
    };
    setScenePlans([...scenePlans, newPlan]);
  };

  const handleRemoveScene = (index: number) => {
    const updated = scenePlans.filter((_, i) => i !== index).map((p, idx) => ({
      ...p,
      number: idx + 1
    }));
    setScenePlans(updated);
  };

  const handleUpdateScene = (index: number, field: keyof ScenePlan, val: any) => {
    const updated = [...scenePlans];
    const current = { ...updated[index], [field]: val };

    if (field === 'start' || field === 'end') {
      const s = Number(field === 'start' ? val : current.start);
      const e = Number(field === 'end' ? val : current.end);
      current.duration = Math.max(0.01, Number((e - s).toFixed(2)));
    }

    updated[index] = current;
    setScenePlans(updated);
  };

  // Batch Fixed Windows Preset (8s or 10s)
  const applyFixedWindowBatch = (windowSeconds: number) => {
    if (scenePlans.length === 0) return;
    let currentTime = 0.0;
    const updated = scenePlans.map((plan, idx) => {
      const start = Number(currentTime.toFixed(1));
      const end = Number((currentTime + windowSeconds).toFixed(1));
      currentTime += windowSeconds;
      return {
        ...plan,
        number: idx + 1,
        start,
        end,
        duration: windowSeconds
      };
    });
    setScenePlans(updated);
  };

  // Helper to extract structured transcript scenes from any valid JSON object or array
  const extractTranscriptScenes = (parsedData: any): ScenePlan[] | null => {
    if (!parsedData) return null;

    // Recursive helper to locate segment array across any nesting level
    const findSegmentArray = (obj: any, depth = 0): any[] | null => {
      if (!obj || depth > 6) return null;

      if (Array.isArray(obj)) {
        if (obj.length > 0) {
          const first = obj[0];
          if (typeof first === 'object' && first !== null) {
            if (
              'text' in first ||
              'narration' in first ||
              'voiceover' in first ||
              'transcript' in first ||
              'sentence' in first ||
              'dialogue' in first ||
              'content' in first ||
              'start' in first ||
              'end' in first
            ) {
              return obj;
            }
          } else if (typeof first === 'string' && first.trim().length > 0) {
            return obj;
          }
        }
        return obj;
      }

      if (typeof obj === 'object') {
        const priorityKeys = [
          'segments',
          'scenes',
          'scenePlans',
          'transcript',
          'transcription',
          'transcripts',
          'lines',
          'utterances',
          'sentences',
          'phrases',
          'chunks',
          'items',
          'data',
          'results',
          'output',
          'response'
        ];

        for (const key of priorityKeys) {
          if (obj[key] !== undefined) {
            const found = findSegmentArray(obj[key], depth + 1);
            if (found && found.length > 0) return found;
          }
        }

        for (const key of Object.keys(obj)) {
          if (!priorityKeys.includes(key) && typeof obj[key] === 'object' && obj[key] !== null) {
            const found = findSegmentArray(obj[key], depth + 1);
            if (found && found.length > 0) return found;
          }
        }
      }

      return null;
    };

    const rawArray = findSegmentArray(parsedData);

    if (Array.isArray(rawArray) && rawArray.length > 0) {
      let rollingStart = 0.0;

      return rawArray.map((item: any, idx: number) => {
        if (typeof item === 'string') {
          const num = idx + 1;
          const durVal = 8.0;
          const s = rollingStart;
          const e = s + durVal;
          rollingStart = e;
          return {
            number: num,
            start: Number(s.toFixed(2)),
            end: Number(e.toFixed(2)),
            duration: durVal,
            stage_id: productionStages[idx % (productionStages.length || 1)]?.id || 'UNSUPPORTED',
            state: `Transcript Shot ${num}`,
            voiceover: item.replace(/\bDeepSeq\b/gi, 'DeepSeek').trim()
          };
        }

        const num = Number(item.number ?? item.scene ?? item.scene_id ?? item.id ?? (idx + 1));

        const startVal = typeof item.start === 'number'
          ? item.start
          : (parseFloat(item.start) || rollingStart);

        const endVal = typeof item.end === 'number'
          ? item.end
          : (parseFloat(item.end) || (startVal + (typeof item.duration === 'number' ? item.duration : 8)));

        let durVal: number;
        if (typeof item.duration === 'number') {
          durVal = item.duration;
        } else {
          durVal = Number((endVal - startVal).toFixed(2));
        }
        if (durVal <= 0) durVal = 8.0;
        rollingStart = endVal;

        let narrationText = String(
          item.narration ??
          item.voiceover ??
          item.transcript ??
          item.text ??
          item.sentence ??
          item.dialogue ??
          item.content ??
          ''
        ).trim();

        narrationText = narrationText.replace(/\bDeepSeq\b/gi, 'DeepSeek');

        const stageId = item.stage_id || item.stage || productionStages[idx % (productionStages.length || 1)]?.id || 'UNSUPPORTED';
        const stateText = item.state || item.title || item.name || item.subject || `Scene #${num} State`;

        return {
          number: num,
          start: Number(startVal.toFixed(2)),
          end: Number(endVal.toFixed(2)),
          duration: Number(durVal.toFixed(2)),
          stage_id: stageId,
          state: stateText,
          voiceover: narrationText
        };
      });
    }

    // If JSON object has a single long text field, split into sentences
    if (typeof parsedData.text === 'string' && parsedData.text.trim()) {
      const sentences = parsedData.text.split(/(?<=[.?!])\s+/).filter((s: string) => s.trim().length > 0);
      let time = 0.0;
      const windowSec = 8.0;
      return sentences.map((line: string, idx: number) => {
        const start = Number(time.toFixed(2));
        const end = Number((time + windowSec).toFixed(2));
        time += windowSec;
        return {
          number: idx + 1,
          start,
          end,
          duration: windowSec,
          stage_id: productionStages[idx % (productionStages.length || 1)]?.id || 'UNSUPPORTED',
          state: `Transcript Shot ${idx + 1}`,
          voiceover: line.trim().replace(/\bDeepSeq\b/gi, 'DeepSeek')
        };
      });
    }

    return null;
  };

  // Transcript File Import Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        // Try parsing as JSON first
        let isJson = false;
        try {
          const parsed = JSON.parse(text);
          isJson = true;
          const newPlans = extractTranscriptScenes(parsed);
          if (newPlans && newPlans.length > 0) {
            setScenePlans(newPlans);
            return;
          }
        } catch {
          isJson = false;
        }

        // If file was valid JSON, do NOT fall back to splitting raw JSON syntax characters into lines
        if (isJson) {
          console.warn('Uploaded JSON did not contain recognizable transcript segments.');
          return;
        }

        // Plain text transcript (.txt) split line by line
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        let time = 0.0;
        const windowSec = 8.0;
        const newPlans: ScenePlan[] = lines.map((line, idx) => {
          const start = Number(time.toFixed(2));
          const end = Number((time + windowSec).toFixed(2));
          time += windowSec;
          return {
            number: idx + 1,
            start,
            end,
            duration: windowSec,
            stage_id: productionStages[idx % (productionStages.length || 1)]?.id || 'UNSUPPORTED',
            state: `Transcript Shot ${idx + 1}`,
            voiceover: line.replace(/\bDeepSeq\b/gi, 'DeepSeek')
          };
        });
        setScenePlans(newPlans);
      } catch (err) {
        console.error('File import error:', err);
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const totalDuration = scenePlans.reduce((acc, curr) => acc + (curr.duration || 0), 0);

  const getMediaRouteBadge = (route?: string) => {
    switch (route) {
      case 'LIVE_ACTION_T2V':
        return { label: 'LIVE_ACTION_T2V', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
      case 'REFERENCE_IMAGE_I2V':
        return { label: 'REFERENCE_IMAGE_I2V', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' };
      case 'AUTHENTIC_REFERENCE_MEDIA':
        return { label: 'AUTHENTIC_REFERENCE_MEDIA', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
      case 'STATIC_GRAPHIC':
        return { label: 'STATIC_GRAPHIC', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' };
      case 'MOTION_GRAPHIC':
        return { label: 'MOTION_GRAPHIC', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' };
      case 'EDITOR_ONLY':
        return { label: 'EDITOR_ONLY', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
      case 'NO_VALID_ROUTE':
        return { label: 'NO_VALID_ROUTE', color: 'bg-rose-500/10 text-rose-400 border-rose-500/30' };
      default:
        return { label: route || 'LIVE_ACTION_T2V', color: 'bg-zinc-800 text-zinc-300 border-zinc-700' };
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Sub-tab Switcher */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold text-zinc-100 font-mono">02 VO TRANSCRIPT & SCENE DIRECTION SYNTHESIZER</h2>
          </div>
          <p className="text-xs text-zinc-400 mt-1 font-mono">
            {scenePlans.length} Scenes Total | Timeline Duration: <span className="text-blue-400 font-bold">{Number(totalDuration.toFixed(2))}s</span>
            {sceneDirections.length > 0 && ` | ${sceneDirections.length} Scene Directions Synthesized`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          
          {/* Sub-tab Switcher */}
          <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs font-mono">
            <button
              onClick={() => setActiveSubTab('timeline')}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeSubTab === 'timeline' ? 'bg-blue-600 text-zinc-950 shadow' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              VO & Timeline ({scenePlans.length})
            </button>
            <button
              onClick={() => setActiveSubTab('directions')}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeSubTab === 'directions' ? 'bg-blue-600 text-zinc-950 shadow' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Scene Directions ({sceneDirections.length})
            </button>
          </div>

          {/* Action Trigger Button */}
          {activeSubTab === 'timeline' ? (
            <button
              id="btn-generate-directions"
              onClick={async () => {
                const res = await onGenerateDirections();
                if (res !== false) {
                  setActiveSubTab('directions');
                }
              }}
              disabled={isGeneratingDirections || scenePlans.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-zinc-950 font-bold font-mono text-xs rounded-xl shadow-lg shadow-blue-950 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isGeneratingDirections ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {sceneDirections.length === 0
                      ? 'Synthesize Phase 2 Directions'
                      : sceneDirections.length < scenePlans.length
                      ? `Resume Synthesis (${sceneDirections.length}/${scenePlans.length} Done)`
                      : 'Regenerate All Directions'}
                  </span>
                </>
              )}
            </button>
          ) : (
            <button
              id="btn-goto-prompts"
              onClick={onContinueToPrompts}
              disabled={isGeneratingPrompts || scenePlans.length === 0 || sceneDirections.length < scenePlans.length}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-sky-500 text-zinc-950 font-bold font-mono text-xs rounded-xl shadow-lg shadow-blue-950 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isGeneratingPrompts ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Prompts... (Rate-Limit Safe)</span>
                </>
              ) : (
                <>
                  <Video className="w-4 h-4" />
                  <span>
                    {sceneDirections.length < scenePlans.length
                      ? `Complete All Directions (${sceneDirections.length}/${scenePlans.length})`
                      : 'Proceed to 03 T2V PROMPTS'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}

        </div>
      </div>

      {activeSubTab === 'timeline' ? (
        <div className="space-y-6">
          
          {/* Quick Toolbar: Import Transcript & Batch Presets */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/80 p-3 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                id="btn-import-transcript"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono font-medium rounded-lg border border-zinc-700 transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-blue-400" />
                <span>Import Transcript / Script (.txt / .json)</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-zinc-400">Batch Windows:</span>
              <button
                onClick={() => applyFixedWindowBatch(8.0)}
                className="px-2.5 py-1 bg-zinc-950 hover:bg-zinc-800 text-zinc-300 text-xs font-mono rounded border border-zinc-800 cursor-pointer"
                title="Batch assign 8.0 second fixed scene windows"
              >
                8s Windows
              </button>
              <button
                onClick={() => applyFixedWindowBatch(10.0)}
                className="px-2.5 py-1 bg-zinc-950 hover:bg-zinc-800 text-zinc-300 text-xs font-mono rounded border border-zinc-800 cursor-pointer"
                title="Batch assign 10.0 second fixed scene windows"
              >
                10s Windows
              </button>

              <button
                id="btn-add-scene"
                onClick={handleAddScene}
                className="flex items-center gap-1 px-3 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-mono font-semibold rounded border border-blue-500/30 transition-colors ml-2 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Scene</span>
              </button>
            </div>
          </div>

          {/* Visual Timeline Bar */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono px-1">
              <span>0.0s</span>
              <span>Timeline Sequence Overview</span>
              <span>{Number(totalDuration.toFixed(2))}s</span>
            </div>
            <div className="h-6 bg-zinc-950 rounded-lg overflow-hidden flex border border-zinc-800 p-0.5 gap-0.5">
              {scenePlans.map((plan, idx) => {
                const widthPct = totalDuration > 0 ? (plan.duration / totalDuration) * 100 : 100 / scenePlans.length;
                const colors = ['bg-blue-600/40 border-blue-500/50', 'bg-sky-600/40 border-sky-500/50', 'bg-indigo-600/40 border-indigo-500/50', 'bg-cyan-600/40 border-cyan-500/50'];
                const color = colors[idx % colors.length];

                return (
                  <div
                    key={plan.number || idx}
                    style={{ width: `${Math.max(4, widthPct)}%` }}
                    className={`h-full ${color} border rounded flex items-center justify-center text-[10px] font-mono font-bold text-zinc-200 truncate px-1 hover:brightness-125 transition-all cursor-pointer`}
                    title={`Scene #${plan.number}: ${plan.duration}s`}
                  >
                    #{plan.number}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scene Cards List */}
          <div className="space-y-4">
            {scenePlans.map((plan, index) => (
              <div
                key={plan.number || index}
                className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 transition-all hover:border-zinc-700 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-800">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono font-bold text-xs flex items-center justify-center">
                      #{plan.number}
                    </span>
                    <input
                      type="text"
                      value={plan.state || ''}
                      onChange={(e) => handleUpdateScene(index, 'state', e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1 text-xs text-zinc-100 font-semibold focus:outline-none focus:border-blue-500 min-w-[200px]"
                      placeholder="Scene State / Visual Title"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    
                    {/* Time range */}
                    <div className="flex items-center gap-1.5 bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800 text-xs font-mono">
                      <Clock className="w-3.5 h-3.5 text-blue-400" />
                      <input
                        type="number"
                        step="0.1"
                        value={plan.start}
                        onChange={(e) => handleUpdateScene(index, 'start', parseFloat(e.target.value) || 0)}
                        className="w-12 bg-transparent text-zinc-200 text-center focus:outline-none"
                      />
                      <span className="text-zinc-500">→</span>
                      <input
                        type="number"
                        step="0.1"
                        value={plan.end}
                        onChange={(e) => handleUpdateScene(index, 'end', parseFloat(e.target.value) || 0)}
                        className="w-12 bg-transparent text-zinc-200 text-center focus:outline-none"
                      />
                      <span className="text-blue-400 text-[11px] font-bold">({plan.duration}s)</span>
                    </div>

                    {/* Stage Linkage Selector */}
                    <select
                      value={plan.stage_id || 'UNSUPPORTED'}
                      onChange={(e) => handleUpdateScene(index, 'stage_id', e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 text-xs text-blue-300 font-mono rounded-lg px-2.5 py-1 focus:outline-none focus:border-blue-500 cursor-pointer max-w-[180px] truncate"
                    >
                      <option value="UNSUPPORTED">Stage: UNSUPPORTED</option>
                      {productionStages.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.id}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => handleRemoveScene(index)}
                      className="text-zinc-500 hover:text-rose-400 p-1 rounded-lg transition-colors cursor-pointer"
                      title="Delete Scene"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Voiceover Transcript Input */}
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-zinc-400 flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-blue-400" />
                    <span>Voiceover Narration / Audio Transcript Text</span>
                  </label>
                  <textarea
                    rows={2}
                    value={plan.voiceover || ''}
                    onChange={(e) => handleUpdateScene(index, 'voiceover', e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 leading-relaxed font-sans"
                    placeholder="Enter narration transcript for this scene..."
                  />
                </div>

              </div>
            ))}

            {scenePlans.length === 0 && (
              <div className="text-center py-12 bg-zinc-900/40 rounded-2xl border border-dashed border-zinc-800 space-y-3 font-mono">
                <p className="text-xs text-zinc-400">No scene plans in timeline. Import a transcript or click below to start.</p>
                <button
                  onClick={handleAddScene}
                  className="px-4 py-2 bg-zinc-800 text-blue-400 text-xs font-semibold rounded-xl border border-zinc-700 cursor-pointer"
                >
                  Add First Scene
                </button>
              </div>
            )}
          </div>

        </div>
      ) : (
        /* Directions Subtab View */
        <div className="space-y-6">
          {sceneDirections.length === 0 ? (
            <div className="text-center py-16 bg-zinc-900/60 rounded-2xl border border-zinc-800 space-y-4 font-mono">
              <Sparkles className="w-10 h-10 text-blue-400 mx-auto opacity-80" />
              <h3 className="text-sm font-bold text-zinc-200">No Phase 2 Scene Directions Synthesized Yet</h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                Click "Synthesize Phase 2 Directions" above to synthesize camera parameters, action breakdowns, and Fact-Lock traceability.
              </p>
              <button
                onClick={onGenerateDirections}
                disabled={isGeneratingDirections}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-zinc-950 font-bold text-xs rounded-xl shadow transition-all cursor-pointer"
              >
                Synthesize Now
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {sceneDirections.map((dir, idx) => {
                const mediaRoute = getMediaRouteBadge(
                  dir.fact_traceability?.media_route || dir.structured_object?.media_route
                );

                return (
                  <div
                    key={dir.number || idx}
                    className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-4 hover:border-zinc-700 transition-colors"
                  >
                    
                    {/* Card Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono font-bold text-sm flex items-center justify-center">
                          #{dir.number || idx + 1}
                        </span>
                        <div>
                          <h3 className="text-sm font-semibold text-zinc-100">{dir.subject || 'Scene Direction'}</h3>
                          <p className="text-xs text-zinc-400 font-mono mt-0.5">
                            Visual State: <span className="text-zinc-200">{dir.product_visual_state}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-1 text-[11px] font-mono font-semibold rounded-lg border ${mediaRoute.color}`}>
                          Media Route: {mediaRoute.label}
                        </span>

                        {dir.fact_traceability?.lifecycle_aligned && (
                          <span className="px-2.5 py-1 text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg flex items-center gap-1 font-mono font-medium">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Lifecycle Aligned
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Grid Layout: Camera Specs & Actions */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      
                      {/* Camera Directions Box */}
                      <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 space-y-2">
                        <div className="flex items-center gap-2 text-blue-400 text-xs font-mono font-bold uppercase tracking-wider">
                          <Camera className="w-4 h-4" />
                          <span>Camera Specification</span>
                        </div>
                        <div className="space-y-1 text-xs font-mono text-zinc-300">
                          <div><span className="text-zinc-500">Scale:</span> {dir.camera?.shot_scale || 'Medium Close-up'}</div>
                          <div><span className="text-zinc-500">Angle:</span> {dir.camera?.angle || 'Eye Level 15°'}</div>
                          <div><span className="text-zinc-500">Lens:</span> {dir.camera?.lens || '50mm Anamorphic'}</div>
                          <div><span className="text-zinc-500">Motion:</span> {dir.camera?.movement || 'Slow Push In'}</div>
                        </div>
                      </div>

                      {/* Primary & Supporting Motion */}
                      <div className="md:col-span-2 bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 space-y-2">
                        <div className="text-xs font-mono font-bold text-zinc-200 uppercase tracking-wider">
                          Action & Environment
                        </div>
                        <div className="text-xs text-zinc-300 leading-relaxed space-y-1">
                          <div><strong className="text-blue-400 font-medium">Primary Action:</strong> {dir.primary_action}</div>
                          {dir.supporting_motion && <div><strong className="text-zinc-400 font-medium">Supporting Motion:</strong> {dir.supporting_motion}</div>}
                          {dir.environment_description && <div><strong className="text-zinc-400 font-medium">Environment:</strong> {dir.environment_description}</div>}
                          {dir.lighting_and_material && <div><strong className="text-zinc-400 font-medium">Lighting:</strong> {dir.lighting_and_material}</div>}
                        </div>
                      </div>

                    </div>

                    {/* Temporal Action Timeline Progression */}
                    {dir.temporal_action && (
                      <div className="bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-800 space-y-2 font-mono">
                        <div className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                          <Compass className="w-4 h-4 text-blue-400" />
                          <span>Temporal Action Progression</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-[11px]">
                          <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                            <div className="text-zinc-500 text-[10px]">Opening State</div>
                            <div className="text-zinc-200 mt-0.5">{dir.temporal_action.opening_state}</div>
                          </div>
                          <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                            <div className="text-zinc-500 text-[10px]">Primary Motion</div>
                            <div className="text-zinc-200 mt-0.5">{dir.temporal_action.primary_motion}</div>
                          </div>
                          <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                            <div className="text-zinc-500 text-[10px]">Interaction</div>
                            <div className="text-zinc-200 mt-0.5">{dir.temporal_action.physical_interaction}</div>
                          </div>
                          <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                            <div className="text-zinc-500 text-[10px]">Mid Progression</div>
                            <div className="text-zinc-200 mt-0.5">{dir.temporal_action.mid_shot_progression}</div>
                          </div>
                          <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                            <div className="text-zinc-500 text-[10px]">Ending State</div>
                            <div className="text-zinc-200 mt-0.5">{dir.temporal_action.ending_state}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Fact Traceability & Forbidden Elements */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 font-mono">
                      
                      {/* Verified Facts Used */}
                      <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3 space-y-2 text-xs">
                        <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                          <ShieldCheck className="w-4 h-4" />
                          <span>Fact Traceability (Verified)</span>
                        </div>
                        <div className="space-y-1 text-zinc-300">
                          {dir.fact_traceability?.verified_hevi_facts_used?.map((f, i) => (
                            <div key={i} className="flex items-start gap-1.5">
                              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                              <span>{f}</span>
                            </div>
                          ))}
                          {dir.fact_traceability?.creator_provided_facts_used?.map((f, i) => (
                            <div key={i} className="flex items-start gap-1.5">
                              <Check className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                              <span className="text-blue-200 font-medium">[Creator Fact] {f}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Forbidden Elements (Injected Negative Constraints) */}
                      <div className="bg-rose-950/20 border border-rose-500/20 rounded-xl p-3 space-y-2 text-xs">
                        <div className="flex items-center gap-1.5 text-rose-400 font-bold">
                          <EyeOff className="w-4 h-4" />
                          <span>Forbidden Elements (Anti-Hallucination)</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {dir.forbidden_elements?.slice(0, 8).map((elem, i) => (
                            <span key={i} className="text-[10px] bg-rose-500/10 text-rose-300 px-2 py-0.5 rounded border border-rose-500/20">
                              ✕ {elem}
                            </span>
                          ))}
                        </div>
                      </div>

                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

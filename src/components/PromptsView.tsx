import React, { useState } from 'react';
import { VideoPromptItem, GenerationSettings } from '../types';
import { Video, Copy, Check, Download, Mic, ShieldCheck, Tag, Loader2, Sparkles } from 'lucide-react';

interface PromptsViewProps {
  prompts: VideoPromptItem[];
  settings: GenerationSettings;
  setSettings: React.Dispatch<React.SetStateAction<GenerationSettings>>;
  onOpenExport: () => void;
  onBackToDirections: () => void;
  onRegeneratePrompts: () => void;
  isGeneratingPrompts?: boolean;
  totalExpectedPrompts?: number;
}

export const PromptsView: React.FC<PromptsViewProps> = ({
  prompts,
  settings,
  setSettings,
  onOpenExport,
  onBackToDirections,
  onRegeneratePrompts,
  isGeneratingPrompts = false,
  totalExpectedPrompts = 210
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  if (!prompts || prompts.length === 0) {
    if (isGeneratingPrompts) {
      return (
        <div className="text-center py-16 bg-zinc-900/60 rounded-2xl border border-zinc-800 space-y-4 font-mono">
          <Loader2 className="w-10 h-10 text-blue-400 mx-auto animate-spin" />
          <h3 className="text-sm font-bold text-zinc-200">Synthesizing Phase 3 T2V Video Prompts...</h3>
          <p className="text-xs text-blue-300 max-w-md mx-auto leading-relaxed">
            Free-Tier Safe Scheduler active • Processing batches with sequential lock &amp; ≤12 RPM rate pacing.
          </p>
        </div>
      );
    }
    return (
      <div className="text-center py-16 bg-zinc-900/60 rounded-2xl border border-zinc-800 space-y-4 font-mono">
        <Video className="w-10 h-10 text-blue-400 mx-auto opacity-80" />
        <h3 className="text-sm font-bold text-zinc-200">No 03 T2V Video Prompts Synthesized Yet</h3>
        <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
          Synthesize Phase 2 Scene Directions first, then click "Synthesize Phase 3 T2V Prompts".
        </p>
        <button
          onClick={onBackToDirections}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-zinc-950 font-bold text-xs rounded-xl shadow transition-all cursor-pointer"
        >
          Go to 02 VO & DIRECTION
        </button>
      </div>
    );
  }

  const handleCopySingle = (text: string, index: number) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
      }
    } catch {
      // Safe fallback for restricted iframe clipboard permissions
    }
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleCopyAll = () => {
    const fullText = prompts
      .map(
        (p) =>
          `SCENE #${p.number} (${p.duration}s | Stage: ${p.stage_id})\n` +
          `VOICEOVER: "${p.voiceover}"\n` +
          `VIDEO PROMPT:\n${p.video_prompt}\n` +
          `KEYWORDS: ${p.stock_keywords}\n` +
          `--------------------------------------------------`
      )
      .join('\n\n');

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(fullText).catch(() => {});
      }
    } catch {
      // Safe fallback for restricted iframe clipboard permissions
    }
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Profile Toggle */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold text-zinc-100 font-mono">03 T2V VIDEO PROMPTS SYNTHESIZER</h2>
          </div>
          <p className="text-xs text-zinc-400 mt-1 font-mono">
            {prompts.length} Production-ready prompts optimized for AI video generators under Fact-Lock rules.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          
          {/* T2V Generator Profile Switcher */}
          <div className="flex items-center bg-zinc-950 rounded-xl p-1 border border-zinc-800 text-xs font-mono">
            <button
              onClick={() => {
                setSettings((s) => ({ ...s, t2vProfile: 'OMNI_FLASH' }));
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                settings.t2vProfile === 'OMNI_FLASH'
                  ? 'bg-blue-600 text-zinc-950 shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Omni Flash
            </button>
            <button
              onClick={() => {
                setSettings((s) => ({ ...s, t2vProfile: 'VEO_FLOW' }));
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                settings.t2vProfile === 'VEO_FLOW'
                  ? 'bg-blue-600 text-zinc-950 shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Veo / Flow
            </button>
          </div>

          {/* Copy All Prompts Button */}
          <button
            id="btn-copy-all-prompts"
            onClick={handleCopyAll}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono font-medium rounded-xl border border-zinc-700 transition-colors cursor-pointer"
          >
            {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedAll ? 'Copied Batch!' : 'Copy All Prompts'}</span>
          </button>

          {/* Regenerate / Resume Prompts Button */}
          {prompts.length < totalExpectedPrompts ? (
            <button
              id="btn-resume-prompts"
              onClick={onRegeneratePrompts}
              disabled={isGeneratingPrompts}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-zinc-950 font-bold font-mono text-xs rounded-xl shadow-lg transition-all disabled:opacity-50 cursor-pointer"
            >
              {isGeneratingPrompts ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Resume Synthesis ({prompts.length}/{totalExpectedPrompts})</span>
                </>
              )}
            </button>
          ) : (
            <button
              id="btn-regenerate-all-prompts"
              onClick={onRegeneratePrompts}
              disabled={isGeneratingPrompts}
              className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono font-medium rounded-xl border border-zinc-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isGeneratingPrompts ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>Regenerate All Prompts</span>
                </>
              )}
            </button>
          )}

          {/* Export Package Modal */}
          <button
            id="btn-open-export-modal"
            onClick={onOpenExport}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-zinc-950 font-bold font-mono text-xs rounded-xl shadow-lg transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Package</span>
          </button>

        </div>
      </div>

      {/* Generation Cooldown / Status Banner */}
      {isGeneratingPrompts && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 text-xs font-mono flex items-center justify-between gap-3 text-blue-300">
          <div className="flex items-center gap-2.5">
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
            <div>
              <span className="font-bold text-blue-200">Free-Tier Paced Synthesis Active: </span>
              <span>Processing batches sequentially with rate-limit pacing (≤12 RPM, automated quota delay protection).</span>
            </div>
          </div>
          <span className="font-bold text-blue-400 shrink-0">
            {prompts.length}/{totalExpectedPrompts} Prompts Ready
          </span>
        </div>
      )}

      {/* Prompts List */}
      <div className="space-y-6">
        {prompts.map((p, index) => (
          <div
            key={p.number || index}
            className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-4 hover:border-zinc-700 transition-colors relative"
          >
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono font-bold text-sm flex items-center justify-center">
                  #{p.number || index + 1}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-zinc-100">
                      Scene #{p.number}
                    </span>
                    <span className="text-[11px] font-mono font-semibold text-blue-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                      {p.duration}s
                    </span>
                    <span className="text-[11px] font-mono text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                      Stage: {p.stage_id}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">{p.state}</p>
                </div>
              </div>

              <button
                onClick={() => handleCopySingle(p.video_prompt, index)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 hover:bg-zinc-800 text-zinc-200 text-xs font-mono rounded-lg border border-zinc-800 transition-colors self-start sm:self-center cursor-pointer"
              >
                {copiedIndex === index ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-blue-400" />
                    <span>Copy Prompt</span>
                  </>
                )}
              </button>
            </div>

            {/* Voiceover Script Box */}
            <div className="bg-zinc-950/80 p-3 rounded-xl border border-zinc-800 flex items-start gap-2 text-xs">
              <Mic className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-mono font-bold text-zinc-400 mr-2">VO Transcript:</span>
                <span className="text-zinc-200 italic font-serif">"{p.voiceover}"</span>
              </div>
            </div>

            {/* Primary Synthesized Video Prompt */}
            <div className="space-y-1">
              <label className="text-[11px] font-mono font-bold text-blue-400 uppercase tracking-wider block">
                Synthesized T2V Video Prompt ({settings.t2vProfile})
              </label>
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 font-mono text-xs text-zinc-100 leading-relaxed select-all whitespace-pre-wrap">
                {p.video_prompt}
              </div>
            </div>

            {/* Bottom Metadata Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
              
              {/* Stock Keywords */}
              <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800 space-y-1 font-mono">
                <div className="flex items-center gap-1 text-zinc-400 font-bold">
                  <Tag className="w-3.5 h-3.5 text-blue-400" />
                  <span>Stock & B-Roll Keywords:</span>
                </div>
                <div className="text-zinc-300 text-[11px]">{p.stock_keywords || 'N/A'}</div>
              </div>

              {/* Quality Flags & Continuity */}
              <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800 space-y-1 font-mono">
                <div className="flex items-center gap-1 text-zinc-400 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Quality Flags & Continuity:</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {p.quality_flags?.map((flag, idx) => (
                    <span key={idx} className="text-[10px] bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
                      ✓ {flag}
                    </span>
                  ))}
                  <span className="text-[10px] bg-zinc-900 text-zinc-400 px-2 py-0.5 rounded border border-zinc-800">
                    {p.continuity_notes || 'Continuous shot flow'}
                  </span>
                </div>
              </div>

            </div>

          </div>
        ))}
      </div>

    </div>
  );
};

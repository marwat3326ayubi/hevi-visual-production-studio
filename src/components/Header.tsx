import React, { useState } from 'react';
import { Layers, Sparkles, Key, FileJson, Clapperboard, Video, ShieldCheck, RefreshCw, Cpu, Trash2 } from 'lucide-react';
import { GenerationSettings } from '../types';

interface HeaderProps {
  activeTab: 'json' | 'vo_direction' | 'prompts';
  setActiveTab: (tab: 'json' | 'vo_direction' | 'prompts') => void;
  settings: GenerationSettings;
  setSettings: React.Dispatch<React.SetStateAction<GenerationSettings>>;
  hasDirections: boolean;
  hasPrompts: boolean;
  onResetSample: () => void;
  onClearData: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  settings,
  setSettings,
  hasDirections,
  hasPrompts,
  onResetSample,
  onClearData
}) => {
  const [showKeyInput, setShowKeyInput] = useState(false);

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/95 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Branding */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-sky-500 to-cyan-400 p-0.5 shadow-lg shadow-blue-950/60">
              <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
                <Clapperboard className="w-5 h-5 text-blue-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-zinc-100 tracking-tight font-mono">
                  HEVI VISUAL PRODUCTION STUDIO <span className="text-blue-400">v2.1</span>
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-md">
                  <ShieldCheck className="w-3 h-3 text-blue-400" />
                  FACT-LOCK ENGINE
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">Anti-Hallucination AI Video Planning & T2V Prompt Synthesizer</p>
            </div>
          </div>

          {/* User Workflow Navigation Labels */}
          <nav className="hidden md:flex items-center bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
            
            <button
              id="tab-json"
              onClick={() => setActiveTab('json')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                activeTab === 'json'
                  ? 'bg-blue-600 text-zinc-950 shadow-md shadow-blue-950'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
              }`}
            >
              <FileJson className="w-3.5 h-3.5" />
              <span>01 HEVI JSON</span>
            </button>

            <button
              id="tab-vo-direction"
              onClick={() => setActiveTab('vo_direction')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                activeTab === 'vo_direction'
                  ? 'bg-blue-600 text-zinc-950 shadow-md shadow-blue-950'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>02 VO & DIRECTION</span>
              {hasDirections && (
                <span className="w-2 h-2 rounded-full bg-blue-300 animate-pulse" />
              )}
            </button>

            <button
              id="tab-prompts"
              onClick={() => setActiveTab('prompts')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                activeTab === 'prompts'
                  ? 'bg-blue-600 text-zinc-950 shadow-md shadow-blue-950'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>03 T2V PROMPTS</span>
              {hasPrompts && (
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
              )}
            </button>

          </nav>

          {/* Right Action Bar */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Channel Profile Selector */}
            <div className="hidden xl:flex items-center gap-2 bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-800 text-xs">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider font-semibold">Profile:</span>
              <select
                id="channel-profile-selector"
                value={settings.channelProfile || 'Channel 1'}
                onChange={(e) => setSettings((s) => ({ ...s, channelProfile: e.target.value }))}
                className="bg-transparent text-xs text-blue-400 font-mono font-semibold focus:outline-none cursor-pointer"
                title="Organizational Channel Profile (Does not override HEVI JSON contract facts)"
              >
                <option value="Channel 1" className="bg-zinc-900 text-zinc-200">Channel 1</option>
                <option value="Channel 2" className="bg-zinc-900 text-zinc-200">Channel 2</option>
                <option value="Channel 3" className="bg-zinc-900 text-zinc-200">Channel 3</option>
              </select>
            </div>

            {/* Model Selector */}
            <div className="hidden lg:flex items-center gap-2 bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-800 text-xs">
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
              <select
                id="model-selector"
                value={settings.modelName}
                onChange={(e) => setSettings((s) => ({ ...s, modelName: e.target.value }))}
                className="bg-transparent text-xs text-zinc-200 font-mono focus:outline-none cursor-pointer"
              >
                <option value="gemini-3.6-flash" className="bg-zinc-900 text-zinc-200">gemini-3.6-flash</option>
              </select>
            </div>

            {/* Custom API Key Button */}
            <button
              id="btn-key-toggle"
              onClick={() => setShowKeyInput(!showKeyInput)}
              className={`p-2 rounded-lg text-xs transition-colors border cursor-pointer ${
                settings.customApiKey
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
              title="Custom Gemini API Key override"
            >
              <Key className="w-4 h-4" />
            </button>

            {/* Clear & Load Sample Controls */}
            <div className="flex items-center gap-1.5">
              <button
                id="btn-clear-data"
                onClick={onClearData}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 font-mono transition-colors border border-zinc-800 flex items-center gap-1 cursor-pointer"
                title="Start empty project without sample data"
              >
                <Trash2 className="w-3 h-3" />
                <span className="hidden sm:inline">Clear</span>
              </button>
              <button
                id="btn-reset-sample"
                onClick={onResetSample}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-blue-400 font-mono font-medium transition-colors border border-zinc-800 flex items-center gap-1 cursor-pointer"
                title="Load NAU-8000 Demo Sample Data"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Load Sample</span>
              </button>
            </div>

          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="flex md:hidden items-center justify-around py-2 border-t border-zinc-800">
          <button
            onClick={() => setActiveTab('json')}
            className={`text-xs font-mono flex items-center gap-1.5 py-1 px-2.5 rounded ${
              activeTab === 'json' ? 'text-blue-400 bg-zinc-900 font-bold' : 'text-zinc-400'
            }`}
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>01 HEVI JSON</span>
          </button>
          <button
            onClick={() => setActiveTab('vo_direction')}
            className={`text-xs font-mono flex items-center gap-1.5 py-1 px-2.5 rounded ${
              activeTab === 'vo_direction' ? 'text-blue-400 bg-zinc-900 font-bold' : 'text-zinc-400'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>02 VO & Direction</span>
          </button>
          <button
            onClick={() => setActiveTab('prompts')}
            className={`text-xs font-mono flex items-center gap-1.5 py-1 px-2.5 rounded ${
              activeTab === 'prompts' ? 'text-blue-400 bg-zinc-900 font-bold' : 'text-zinc-400'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>03 T2V Prompts</span>
          </button>
        </div>

        {/* Custom API Key Input Strip */}
        {showKeyInput && (
          <div className="py-2.5 px-4 bg-zinc-900 border-t border-zinc-800 flex items-center gap-3">
            <Key className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs text-zinc-300 shrink-0 font-mono">Custom GEMINI_API_KEY:</span>
            <input
              id="input-custom-api-key"
              type="password"
              placeholder="Paste custom GEMINI_API_KEY (optional, uses server default if empty)"
              value={settings.customApiKey}
              onChange={(e) => setSettings((s) => ({ ...s, customApiKey: e.target.value }))}
              className="flex-1 bg-zinc-950 text-xs text-zinc-100 px-3 py-1.5 rounded border border-zinc-800 focus:outline-none focus:border-blue-500 font-mono"
            />
            {settings.customApiKey && (
              <button
                onClick={() => setSettings((s) => ({ ...s, customApiKey: '' }))}
                className="text-xs text-rose-400 hover:underline font-mono"
              >
                Clear
              </button>
            )}
          </div>
        )}

      </div>
    </header>
  );
};

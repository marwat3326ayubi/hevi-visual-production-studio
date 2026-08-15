import React, { useState, useRef, useEffect } from 'react';
import { ProductionJson } from '../types';
import { validateHeviV2Contract } from '../lib/heviContractValidator';
import {
  FileJson,
  ShieldAlert,
  Plus,
  Trash2,
  CheckCircle2,
  Code,
  Layers,
  Box,
  Cpu,
  AlertTriangle,
  ArrowRight,
  UploadCloud,
  FileUp
} from 'lucide-react';

interface HeviJsonEditorProps {
  productionJson: ProductionJson;
  setProductionJson: (json: ProductionJson) => void;
  creatorFacts: string[];
  setCreatorFacts: (facts: string[]) => void;
  onContinueToTimeline: () => void;
  onClearData?: () => void;
}

export const HeviJsonEditor: React.FC<HeviJsonEditorProps> = ({
  productionJson,
  setProductionJson,
  creatorFacts,
  setCreatorFacts,
  onContinueToTimeline,
  onClearData
}) => {
  const [jsonText, setJsonText] = useState(() => JSON.stringify(productionJson, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [validationSuccessMsg, setValidationSuccessMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [newFact, setNewFact] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'visual' | 'raw'>('visual');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize jsonText state when productionJson prop updates
  useEffect(() => {
    setJsonText(JSON.stringify(productionJson, null, 2));
  }, [productionJson]);

  const handleProcessJsonText = (text: string, filename?: string) => {
    try {
      const rawParsed = JSON.parse(text);
      const result = validateHeviV2Contract(rawParsed);

      if (!result.isValid) {
        setJsonError(`HEVI V2 Contract Validation Error: ${result.errors.join(' | ')}`);
        setValidationSuccessMsg(null);
        return false;
      }

      setProductionJson(result.normalizedJson);
      setJsonText(JSON.stringify(result.normalizedJson, null, 2));

      if (result.extractedFacts && result.extractedFacts.length > 0) {
        setCreatorFacts(result.extractedFacts);
      }

      setJsonError(null);
      const productTitle = result.normalizedJson.product.official_name || 'HEVI Product';
      const stagesCount = result.normalizedJson.production_stages?.length || 0;
      const geomCount = result.normalizedJson.geometry_modules?.length || 0;
      const refCount = result.normalizedJson.reference_assets?.length || 0;
      const statusBadge = result.statusType === 'VALID_CONTRACT_WITH_EMPTY_OPTIONAL_DATA'
        ? '[VALID CONTRACT WITH EMPTY OPTIONAL DATA]'
        : '[VALID HEVI V2 CONTRACT]';

      let msg = `${statusBadge} ${filename ? `(${filename})` : ''}: Loaded "${productTitle}" (${stagesCount} stages, ${geomCount} geometry modules, ${refCount} references).`;
      if (result.warnings && result.warnings.length > 0) {
        msg += ` Warnings: ${result.warnings.slice(0, 2).join(' | ')}`;
      }

      setValidationSuccessMsg(msg);
      return true;
    } catch (err: any) {
      setJsonError(`JSON Syntax Error: ${err.message || 'Malformed JSON file structure'}`);
      setValidationSuccessMsg(null);
      return false;
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleProcessJsonText(content, file.name);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setJsonError('Invalid file format: Please upload a valid .json file.');
      setValidationSuccessMsg(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleProcessJsonText(content, file.name);
    };
    reader.readAsText(file);
  };

  const handleJsonChange = (val: string) => {
    setJsonText(val);
    handleProcessJsonText(val);
  };

  const handleAddFact = () => {
    if (!newFact.trim()) return;
    setCreatorFacts([...creatorFacts, newFact.trim()]);
    setNewFact('');
  };

  const handleRemoveFact = (index: number) => {
    setCreatorFacts(creatorFacts.filter((_, i) => i !== index));
  };

  const updateProductField = (field: string, val: string) => {
    const updated = {
      ...productionJson,
      product: {
        ...(productionJson.product || {
          official_name: '',
          exact_variant: '',
          category: '',
          description: '',
          global_negative_constraints: []
        }),
        [field]: val
      }
    };
    setProductionJson(updated);
    setJsonText(JSON.stringify(updated, null, 2));
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Fact-Lock Intro */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-blue-400" />
              <h2 className="text-base font-bold text-zinc-100 font-mono">01 HEVI V2 PRODUCTION INDEX & FACT-LOCK LAYER</h2>
            </div>
            <p className="text-xs text-zinc-400 mt-1 max-w-3xl leading-relaxed">
              Import exact physical specs, verified manufacturing stages, CAD geometry, and explicit creator facts.
              Gemini enforces Fact-Lock rules, blocking hallucinated components or unsupported physical claims.
            </p>
          </div>
          <button
            id="btn-goto-timeline"
            onClick={onContinueToTimeline}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-zinc-950 font-bold font-mono text-xs rounded-xl shadow-lg shadow-blue-950/50 transition-all shrink-0 cursor-pointer"
          >
            <span>Proceed to 02 VO & DIRECTION</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Prominent HEVI V2 JSON File Upload & Drag-and-Drop Dropzone */}
      <div
        id="hevi-json-dropzone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center relative ${
          isDragging
            ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-950/50 scale-[1.005]'
            : 'border-zinc-800 bg-zinc-900/80 hover:border-blue-500/50 hover:bg-zinc-900'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileInputChange}
          className="hidden"
          id="hevi-v2-json-file-input"
        />

        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <UploadCloud className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-sm font-bold text-zinc-100 font-mono">
              Upload or Drag & Drop HEVI V2 Production Handoff JSON
            </h3>
            <p className="text-xs text-zinc-400 mt-1 font-mono">
              Select a <code className="text-blue-400 font-bold bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">.json</code> file from your device to populate specs & lifecycle data
            </p>
          </div>

          <div className="pt-2">
            <span className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-zinc-950 font-bold font-mono text-xs rounded-xl shadow-md transition-all inline-flex items-center gap-2">
              <FileUp className="w-4 h-4" />
              <span>Browse HEVI JSON File</span>
            </span>
          </div>
        </div>
      </div>

      {/* Validation Status / Error Banners */}
      {validationSuccessMsg && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl font-mono flex items-start justify-between gap-3 shadow-md">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{validationSuccessMsg}</span>
          </div>
          <button
            onClick={() => setValidationSuccessMsg(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs shrink-0 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {jsonError && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl font-mono flex items-start justify-between gap-3 shadow-md">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{jsonError}</span>
          </div>
          <button
            onClick={() => setJsonError(null)}
            className="text-rose-400 hover:text-rose-200 text-xs shrink-0 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Main JSON Structure */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between bg-zinc-900 p-2 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-2 px-2">
              <FileJson className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold font-mono text-zinc-200">HEVI V2 Product Specs</span>
            </div>
            
            <div className="flex items-center bg-zinc-950 rounded-lg p-1 border border-zinc-800 text-xs">
              <button
                onClick={() => setActiveSubTab('visual')}
                className={`px-3 py-1 rounded-md font-mono text-xs font-semibold transition-colors cursor-pointer ${
                  activeSubTab === 'visual' ? 'bg-zinc-800 text-blue-400' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Visual Inspector
              </button>
              <button
                onClick={() => setActiveSubTab('raw')}
                className={`px-3 py-1 rounded-md font-mono text-xs font-semibold transition-colors cursor-pointer ${
                  activeSubTab === 'raw' ? 'bg-zinc-800 text-blue-400' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Raw JSON
              </button>
            </div>
          </div>

          {activeSubTab === 'visual' ? (
            <div className="space-y-4">
              
              {/* Product Info Card */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
                  <Box className="w-4 h-4 text-blue-400" />
                  <h3 className="text-xs font-mono font-bold text-zinc-200 uppercase tracking-wider">Product Identity</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-mono text-zinc-400 block mb-1">Official Product Name</label>
                    <input
                      type="text"
                      value={productionJson.product?.official_name || ''}
                      onChange={(e) => updateProductField('official_name', e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 font-medium font-mono"
                      placeholder="e.g. HEVI-V2 Neural Processor"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-mono text-zinc-400 block mb-1">Exact Variant</label>
                    <input
                      type="text"
                      value={productionJson.product?.exact_variant || ''}
                      onChange={(e) => updateProductField('exact_variant', e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 font-mono"
                      placeholder="e.g. Enterprise Liquid Edition"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-mono text-zinc-400 block mb-1">Technical Summary</label>
                  <textarea
                    rows={2}
                    value={productionJson.product?.description || ''}
                    onChange={(e) => updateProductField('description', e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-300 focus:outline-none focus:border-blue-500 font-sans"
                    placeholder="Brief architectural overview"
                  />
                </div>
              </div>

              {/* Verified Production Stages */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-400" />
                    <h3 className="text-xs font-mono font-bold text-zinc-200 uppercase tracking-wider">
                      Lifecycle Production Stages ({productionJson.production_stages?.length || 0})
                    </h3>
                  </div>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {productionJson.production_stages?.map((stage, i) => (
                    <div key={stage.id || i} className="p-3 bg-zinc-950/80 rounded-lg border border-zinc-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-blue-400">{stage.id}</span>
                        <span className="text-[10px] text-zinc-400 font-medium">{stage.name}</span>
                      </div>
                      <p className="text-xs text-zinc-300">{stage.description}</p>
                      {stage.verified_components && stage.verified_components.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {stage.verified_components.map((c, idx) => (
                            <span key={idx} className="text-[10px] bg-zinc-900 text-zinc-300 px-2 py-0.5 rounded border border-zinc-800 font-mono">
                              ✓ {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {(!productionJson.production_stages || productionJson.production_stages.length === 0) && (
                    <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20 text-xs text-amber-300 font-mono">
                      No production stages defined in HEVI JSON yet. Upload a .json file or load sample data.
                    </div>
                  )}
                </div>
              </div>

              {/* Geometry Modules & Reference Assets */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2 pb-1 border-b border-zinc-800">
                    <Cpu className="w-3.5 h-3.5 text-blue-400" />
                    <h4 className="text-xs font-mono font-bold text-zinc-200">Geometry Modules</h4>
                  </div>
                  {productionJson.geometry_modules?.map((m, i) => (
                    <div key={i} className="text-xs p-2 bg-zinc-950 rounded border border-zinc-800">
                      <div className="font-medium text-zinc-200">{m.name}</div>
                      <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{m.specifications || m.type}</div>
                    </div>
                  ))}
                  {(!productionJson.geometry_modules || productionJson.geometry_modules.length === 0) && (
                    <p className="text-xs text-zinc-500 italic p-2 font-mono">None specified</p>
                  )}
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2 pb-1 border-b border-zinc-800">
                    <Code className="w-3.5 h-3.5 text-blue-400" />
                    <h4 className="text-xs font-mono font-bold text-zinc-200">Reference CAD/Docs</h4>
                  </div>
                  {productionJson.reference_assets?.map((a, i) => (
                    <div key={i} className="text-xs p-2 bg-zinc-950 rounded border border-zinc-800">
                      <div className="font-medium text-zinc-200">{a.name}</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">{a.notes || a.type}</div>
                    </div>
                  ))}
                  {(!productionJson.reference_assets || productionJson.reference_assets.length === 0) && (
                    <p className="text-xs text-zinc-500 italic p-2 font-mono">None specified</p>
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                id="raw-json-textarea"
                rows={22}
                value={jsonText}
                onChange={(e) => handleJsonChange(e.target.value)}
                className="w-full bg-zinc-950 font-mono text-xs text-zinc-200 p-4 rounded-xl border border-zinc-800 focus:outline-none focus:border-blue-500 leading-relaxed"
                placeholder="Paste HEVI Production JSON structure here..."
              />
            </div>
          )}

        </div>

        {/* Right Col: Creator Facts (Fact-Lock Layer) */}
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-mono font-bold text-zinc-100 uppercase tracking-wider">Creator Facts Index</h3>
              </div>
              <span className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full font-mono">
                {creatorFacts.length} Facts
              </span>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Add specific physical truths provided directly by the engineering or media team. These supersede generic defaults.
            </p>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {creatorFacts.map((fact, index) => (
                <div key={index} className="flex items-start justify-between gap-2 p-2.5 bg-zinc-950 rounded-lg border border-zinc-800 text-xs text-zinc-200 group">
                  <span className="leading-tight text-zinc-300 font-sans">
                    <span className="text-blue-400 font-mono font-bold mr-1.5">[{index + 1}]</span>
                    {fact}
                  </span>
                  <button
                    onClick={() => handleRemoveFact(index)}
                    className="text-zinc-500 hover:text-rose-400 p-0.5 rounded opacity-80 group-hover:opacity-100 transition-opacity shrink-0 cursor-pointer"
                    title="Remove Fact"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {creatorFacts.length === 0 && (
                <p className="text-xs text-zinc-500 italic text-center py-4 font-mono">No creator facts added yet.</p>
              )}
            </div>

            {/* Add Fact Input */}
            <div className="pt-2 border-t border-zinc-800 space-y-2">
              <input
                id="input-new-creator-fact"
                type="text"
                placeholder="e.g. Dielectric fluid flows from bottom left to top right"
                value={newFact}
                onChange={(e) => setNewFact(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddFact()}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 font-mono"
              />
              <button
                id="btn-add-creator-fact"
                onClick={handleAddFact}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-blue-400 text-xs font-mono font-semibold rounded-lg transition-colors border border-zinc-700 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Verified Creator Fact</span>
              </button>
            </div>
          </div>

          {/* Fact-Lock Policy Checklist */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-2 text-xs text-zinc-400 font-mono">
            <div className="font-bold text-zinc-200 mb-1">Strict HEVI Rules Enforced:</div>
            <div className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">•</span>
              <span>No fictional gantry, assembly line, or factory invention if missing in specs.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">•</span>
              <span>AI software & parameter claims fallback to MOTION_GRAPHIC / STATIC_GRAPHIC if hardware missing.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">•</span>
              <span>Automatic injection of negative constraints against morphing & unauthorized substitutes.</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

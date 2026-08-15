import React, { useState } from 'react';
import { ProductionJson, ScenePlan, SceneDirection, VideoPromptItem } from '../types';
import { Download, Copy, Check, X, FileCode, FileText, Video } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  productionJson: ProductionJson;
  creatorFacts: string[];
  scenePlans: ScenePlan[];
  sceneDirections: SceneDirection[];
  videoPrompts: VideoPromptItem[];
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  productionJson,
  creatorFacts,
  scenePlans,
  sceneDirections,
  videoPrompts
}) => {
  const [format, setFormat] = useState<'json' | 'markdown' | 'prompts'>('json');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const exportPackage = {
    hevi_schema_version: "2.0.0",
    generated_at: new Date().toISOString(),
    product: productionJson.product,
    creator_facts: creatorFacts,
    production_stages: productionJson.production_stages,
    environments: productionJson.environments,
    geometry_modules: productionJson.geometry_modules,
    reference_assets: productionJson.reference_assets,
    scene_plans: scenePlans,
    scene_directions: sceneDirections,
    synthesized_t2v_prompts: videoPrompts
  };

  const getExportText = () => {
    if (format === 'json') {
      return JSON.stringify(exportPackage, null, 2);
    }

    if (format === 'prompts') {
      return videoPrompts
        .map(
          (p) =>
            `SCENE #${p.number} (${p.duration}s | Stage: ${p.stage_id})\n` +
            `PROMPT: ${p.video_prompt}\n` +
            `STOCK KEYWORDS: ${p.stock_keywords}`
        )
        .join('\n\n--------------------------------------------------\n\n');
    }

    // Markdown Production Brief
    return `# HEVI V2 PRODUCTION PACKAGE: ${productionJson.product?.official_name || 'UNTITLED PRODUCT'}
**Variant:** ${productionJson.product?.exact_variant || 'Standard'}
**Export Date:** ${new Date().toLocaleDateString()}

---

## 1. PRODUCT & FACT-LOCK INDEX
- **Official Name:** ${productionJson.product?.official_name}
- **Description:** ${productionJson.product?.description}
- **Creator Facts Count:** ${creatorFacts.length}
- **Production Stages:** ${productionJson.production_stages?.map((s) => s.id).join(', ')}

---

## 2. SCENE TIMELINE & DIRECTIONS SUMMARY
${scenePlans
  .map((plan, i) => {
    const dir = sceneDirections[i];
    const prompt = videoPrompts[i];
    return `### Scene #${plan.number}: ${plan.state} (${plan.duration}s)
- **VO Script:** "${plan.voiceover}"
- **Stage ID:** ${plan.stage_id}
- **Camera:** ${dir?.camera?.shot_scale || 'N/A'}, ${dir?.camera?.angle || 'N/A'}, ${dir?.camera?.movement || 'N/A'}
- **Media Route:** ${dir?.fact_traceability?.media_route || 'LIVE_ACTION_T2V'}
- **Synthesized Prompt:**
\`\`\`
${prompt?.video_prompt || 'N/A'}
\`\`\`
`;
  })
  .join('\n')}
`;
  };

  const exportContent = getExportText();

  const handleCopy = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(exportContent).catch(() => {});
      }
    } catch {
      // Safe fallback for restricted iframe clipboard permissions
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = () => {
    const ext = format === 'json' ? 'json' : format === 'markdown' ? 'md' : 'txt';
    const filename = `HEVI_V2_Package_${productionJson.product?.official_name?.replace(/\s+/g, '_') || 'Export'}.${ext}`;
    const blob = new Blob([exportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-semibold text-zinc-100 font-mono">Export HEVI V2 Production Package</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Selector Bar */}
        <div className="p-4 bg-zinc-950/60 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center bg-zinc-900 rounded-xl p-1 border border-zinc-800 text-xs font-mono">
            <button
              onClick={() => setFormat('json')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                format === 'json' ? 'bg-blue-600 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>HEVI Package (JSON)</span>
            </button>
            <button
              onClick={() => setFormat('markdown')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                format === 'markdown' ? 'bg-blue-600 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Production Brief (MD)</span>
            </button>
            <button
              onClick={() => setFormat('prompts')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                format === 'prompts' ? 'bg-blue-600 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Prompts List (TXT)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono font-medium rounded-lg border border-zinc-700 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Text'}</span>
            </button>

            <button
              onClick={handleDownloadFile}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-zinc-950 font-bold font-mono text-xs rounded-lg transition-colors shadow cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download File</span>
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        <div className="flex-1 p-4 overflow-y-auto bg-zinc-950 font-mono text-xs text-zinc-200 leading-relaxed">
          <pre className="whitespace-pre-wrap select-all">{exportContent}</pre>
        </div>

      </div>
    </div>
  );
};

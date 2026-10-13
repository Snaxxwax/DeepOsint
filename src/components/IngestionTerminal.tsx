import { readFileBase64 } from '../utils/files';
import React, { useState } from 'react';
import { IngestedArtifact, SourceType } from '../types/osint';
import { PRELOADED_DATASETS, PreloadedDataset } from '../utils/sampleData';
import { Play, Sparkles, FileText, Globe, GitBranch, Camera, Terminal, CheckCircle2, ChevronRight, Hash, UserCheck } from 'lucide-react';

interface IngestionTerminalProps {
  artifacts: IngestedArtifact[];
  onIngestNew: (payload: {
    title: string;
    sourceType: SourceType;
    sourceUri: string;
    classificationLevel: IngestedArtifact['classificationLevel'];
    rawContent: string;
    useGeminiNlp: boolean;
    fileBase64?: string;
  }) => Promise<void>;
  onSelectArtifact: (art: IngestedArtifact) => void;
  selectedArtifactId?: string;
  isProcessing: boolean;
  activeProcessingStage?: string;
}

export const IngestionTerminal: React.FC<IngestionTerminalProps> = ({
  artifacts,
  onIngestNew,
  onSelectArtifact,
  selectedArtifactId,
  isProcessing,
  activeProcessingStage,
}) => {
  const [activeTab, setActiveTab] = useState<'scenarios' | 'custom'>('custom');
  const [customTitle, setCustomTitle] = useState('');
  const [customSourceType, setCustomSourceType] = useState<SourceType>('corporate_registry');
  const [customUri, setCustomUri] = useState('');
  const [customClass, setCustomClass] = useState<IngestedArtifact['classificationLevel']>('CONFIDENTIAL');
  const [customText, setCustomText] = useState('');
  const [useGeminiNlp, setUseGeminiNlp] = useState(true);

  const handlePreloadIngest = async (dataset: PreloadedDataset) => {
    await onIngestNew({
      title: dataset.title,
      sourceType: dataset.sourceType,
      sourceUri: dataset.sourceUri,
      classificationLevel: dataset.classificationLevel,
      rawContent: dataset.rawContent,
      useGeminiNlp,
    });
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customText.trim()) return;

    await onIngestNew({
      title: customTitle.trim() || `Ad-Hoc Subject Dossier ${new Date().toLocaleTimeString()}`,
      sourceType: customSourceType,
      sourceUri: customUri.trim() || 'adhoc://investigator-terminal/manual-feed',
      classificationLevel: customClass,
      rawContent: customText,
      useGeminiNlp,
    });

    setCustomTitle('');
    setCustomText('');
  };

  const getSourceIcon = (type: SourceType) => {
    switch (type) {
      case 'corporate_registry': return <FileText className="w-4 h-4 text-cyan-400" />;
      case 'public_profile': return <Globe className="w-4 h-4 text-emerald-400" />;
      case 'forum_leak': return <Terminal className="w-4 h-4 text-rose-400" />;
      case 'git_repo': return <GitBranch className="w-4 h-4 text-teal-400" />;
      case 'media_exif': return <Camera className="w-4 h-4 text-sky-400" />;
      case 'resume_cv': return <FileText className="w-4 h-4 text-amber-400" />;
      case 'social_media': return <Globe className="w-4 h-4 text-purple-400" />;
      default: return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Processing Pipeline Stage Banner */}
      {isProcessing && (
        <div className="p-4 bg-slate-900 border border-cyan-500/30 rounded-lg animate-pulse">
          <div className="flex items-center justify-between text-xs text-cyan-300 font-medium mb-2">
            <span>Executing Persona Intelligence Extraction</span>
            <span className="font-mono tabular-nums">Identity Correlator Cluster</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-white">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="font-semibold">{activeProcessingStage || 'Stage 1: Intake & SHA-256 Hashing...'}</span>
          </div>
          <div className="mt-3 grid grid-cols-5 gap-1.5 text-xs text-slate-400">
            <div className="h-1 bg-cyan-500 rounded-full" />
            <div className="h-1 bg-cyan-500 rounded-full" />
            <div className="h-1 bg-cyan-500 rounded-full" />
            <div className="h-1 bg-cyan-500/50 rounded-full" />
            <div className="h-1 bg-slate-700 rounded-full" />
          </div>
        </div>
      )}

      {/* Ingestion Source Selector & Creator */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-white">People OSINT Ingestion Dispatcher</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Multi-source parser supporting corporate registries, faculty bios, developer commits, and EXIF imagery
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Engine Selection Toggle */}
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={useGeminiNlp}
                onChange={(e) => setUseGeminiNlp(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-0"
              />
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Gemini Persona NER
              </span>
            </label>

            {/* Segmented Control Buttons */}
            <div className="flex items-center p-0.5 bg-slate-800/80 rounded-md">
              <button
                type="button"
                onClick={() => setActiveTab('scenarios')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  activeTab === 'scenarios' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Sample Scenarios
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('custom')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  activeTab === 'custom' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Custom Dossier
              </button>
            </div>
          </div>
        </div>

        <label className="block mt-4 text-xs text-slate-300">
          Upload text, code, PDF, JPEG or PNG evidence (maximum 10 MiB)
          <input type="file" className="block mt-2" disabled={isProcessing} accept=".txt,.log,.json,.csv,.md,.py,.ts,.js,.pdf,.jpg,.jpeg,.png" onChange={async event=>{
            const file=event.target.files?.[0]; if(!file)return;
            try { const fileBase64=await readFileBase64(file); await onIngestNew({title:file.name,sourceType:customSourceType,sourceUri:`upload://${encodeURIComponent(file.name)}`,classificationLevel:customClass,rawContent:'',useGeminiNlp,fileBase64}); }
            catch(err:any) {window.alert(err.message);}
            event.target.value='';
          }} />
        </label>

        {/* Tab 1: Pre-loaded Multi-source Intelligence Scenarios */}
        {activeTab === 'scenarios' && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {PRELOADED_DATASETS.map((dataset) => (
              <div
                key={dataset.id}
                className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-lg hover:border-slate-700 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      {getSourceIcon(dataset.sourceType)}
                      <span className="text-xs font-medium text-slate-400 capitalize">
                        {dataset.sourceType.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-slate-400 uppercase">
                      {dataset.classificationLevel}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-white line-clamp-1">{dataset.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {dataset.description}
                  </p>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                  <div className="text-xs text-slate-400 font-mono tabular-nums">
                    {dataset.rawContent.length} bytes
                  </div>
                  <button
                    onClick={() => handlePreloadIngest(dataset)}
                    disabled={isProcessing}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-cyan-300 hover:text-cyan-200 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-800/50 rounded transition-colors disabled:opacity-50"
                  >
                    <Play className="w-3 h-3" />
                    <span>Run Ingestion</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 2: Custom Text / File Drop Ingestion */}
        {activeTab === 'custom' && (
          <form onSubmit={handleCustomSubmit} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Subject / Dossier Title</label>
                <input
                  type="text"
                  placeholder="e.g. Executive Background Check - Marcus Vance"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Source Record Type</label>
                <select
                  value={customSourceType}
                  onChange={(e) => setCustomSourceType(e.target.value as SourceType)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="corporate_registry">Corporate Registry / Companies House</option>
                  <option value="public_profile">Public Bio / Faculty Directory</option>
                  <option value="forum_leak">Forum Leak / User Dossier Paste</option>
                  <option value="git_repo">Developer Repository (.git / author log)</option>
                  <option value="media_exif">Media File (EXIF GPS & OCR)</option>
                  <option value="social_media">Social Media Thread / Public Profile</option>
                  <option value="resume_cv">Curriculum Vitae / Resume</option>
                  <option value="court_filing">Court Filing / Regulatory Disclosure</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Source URI / Origin</label>
                <input
                  type="text"
                  placeholder="e.g. https://companieshouse.gov.uk/officers/..."
                  value={customUri}
                  onChange={(e) => setCustomUri(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-300">
                  Raw Unstructured Subject Content (Paste public bio, resume, registry records, or EXIF metadata)
                </label>
                <span className="text-xs text-slate-400 font-mono tabular-nums">
                  {customText.length} characters
                </span>
              </div>
              <textarea
                rows={6}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Paste raw unstructured text containing subject names, aliases, emails, phone numbers, corporate affiliations, Telegram handles, cryptocurrency addresses, or EXIF coordinates..."
                className="w-full p-3 text-xs font-mono bg-slate-950 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-cyan-500"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={isProcessing || !customText.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Ingest & Extract Persona</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Ingested Artifacts Feed Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Ingestion Queue & Processed Dossiers</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Cryptographically sealed chain-of-custody hashes and persona entity counts
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400 tabular-nums">
            {artifacts.length} Ingested Dossiers
          </span>
        </div>

        <div className="divide-y divide-slate-800/80">
          {artifacts.map((art) => {
            const isSelected = art.id === selectedArtifactId;
            return (
              <div
                key={art.id}
                onClick={() => onSelectArtifact(art)}
                className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer transition-colors ${
                  isSelected ? 'bg-slate-800/80 border-l-2 border-cyan-400' : 'hover:bg-slate-850'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5">{getSourceIcon(art.sourceType)}</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="capitalize">{art.sourceType.replace(/_/g, ' ')}</span>
                      <span>·</span>
                      <span className="font-mono">{art.classificationLevel}</span>
                      <span>·</span>
                      <span className="font-mono tabular-nums">{new Date(art.ingestedAt).toLocaleTimeString()}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-white mt-0.5 truncate">{art.title}</h4>
                    <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-xl">
                      {art.sourceUri}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0 text-xs">
                  {/* Cryptographic SHA-256 Stamp */}
                  <div className="hidden sm:block text-right">
                    <div className="text-slate-400 flex items-center gap-1 justify-end">
                      <Hash className="w-3 h-3 text-cyan-400" />
                      <span>SHA-256 Seal</span>
                    </div>
                    <div className="text-slate-300 font-mono tabular-nums mt-0.5">
                      {art.sha256Hash.substring(0, 16)}...
                    </div>
                  </div>

                  {/* Processing Duration */}
                  <div className="text-right">
                    <div className="text-slate-400">Latency</div>
                    <div className="text-slate-300 font-mono tabular-nums mt-0.5">
                      {art.processingTimeMs}ms
                    </div>
                  </div>

                  {/* Entities Extracted */}
                  <div className="text-right">
                    <div className="text-slate-400">Attributes</div>
                    <div className="text-cyan-400 font-semibold font-mono tabular-nums mt-0.5">
                      {art.entitiesExtracted}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Sealed</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

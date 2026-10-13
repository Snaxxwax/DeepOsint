import React from 'react';
import { ShieldCheck, Plus, Sparkles } from 'lucide-react';

interface TopBarProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  onOpenNewIngest: () => void;
  onExportStix?: () => void;
  isAiEnabled: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  onOpenNewIngest,
  onExportStix,
  isAiEnabled,
}) => {
  return (
    <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-slate-900 border-b border-slate-800 shrink-0">
      {/* Zone 1: Brand Wordmark (Single text element) */}
      <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
        <ShieldCheck className="w-5 h-5 text-cyan-400" />
        <a 
          href="#dashboard" 
          onClick={(e) => { e.preventDefault(); onSelectTab('investigation'); }}
          className="text-base font-semibold tracking-tight text-white hover:text-cyan-300 transition-colors"
        >
          Remix IntelFlow OSINT
        </a>
      </div>

      {/* Zone 2: Concise Single-Line Navigation Links */}
      <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-slate-400">
        <button
          onClick={() => onSelectTab('investigation')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            activeTab === 'investigation' ? 'text-cyan-400 font-bold' : ''
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          <span>Investigation Console</span>
        </button>
        <button
          onClick={() => onSelectTab('research_loop')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            activeTab === 'research_loop' ? 'text-cyan-400 font-bold' : ''
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>The Research Loop</span>
        </button>
        <button
          onClick={() => onSelectTab('ingestion')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'ingestion' ? 'text-cyan-400 font-semibold' : ''
          }`}
        >
          Dossier & Ingest
        </button>
        <button
          onClick={() => onSelectTab('entities')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'entities' ? 'text-cyan-400 font-semibold' : ''
          }`}
        >
          Persons & Identifiers
        </button>
        <button
          onClick={() => onSelectTab('graph')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'graph' ? 'text-cyan-400 font-semibold' : ''
          }`}
        >
          Identity Graph
        </button>
        <button
          onClick={() => onSelectTab('geospatial')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'geospatial' ? 'text-cyan-400 font-semibold' : ''
          }`}
        >
          Geospatial & EXIF
        </button>
        <button
          onClick={() => onSelectTab('provenance')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'provenance' ? 'text-cyan-400 font-semibold' : ''
          }`}
        >
          Evidence & Custody
        </button>
      </nav>

      {/* Zone 3: 1 Primary Action */}
      <div className="flex items-center gap-3 shrink-0">
        {isAiEnabled && (
          <span className="hidden lg:inline-flex items-center gap-1.5 text-xs text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Semantic NER</span>
          </span>
        )}
        <button
          onClick={onOpenNewIngest}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-cyan-400"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Ingest Data</span>
        </button>
      </div>
    </header>
  );
};

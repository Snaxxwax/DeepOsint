import React, { useState } from 'react';
import { 
  Search, Plus, X, Sparkles, Shield, Terminal, ArrowRight, 
  FileText, Camera, Upload, CheckCircle2, AlertTriangle, 
  Copy, Check, ExternalLink, Globe, Car, User, Mail, Phone, 
  AtSign, MapPin, Hash, RefreshCw, Eye, ShieldAlert
} from 'lucide-react';
import { SeedIdentifier, SeedIdentifierType, InvestigationDossier, ExtractedEntity, RelationalEdge } from '../types/osint';

interface InvestigationConsoleProps {
  onInvestigationComplete: (dossier: InvestigationDossier) => void;
  onNavigateToGraph: () => void;
  onNavigateToLedger: () => void;
  isAiEnabled: boolean;
}

const PRESET_SCENARIOS: {
  title: string;
  badge: string;
  identifiers: { value: string; type: SeedIdentifierType }[];
  description: string;
}[] = [
  {
    title: 'Subject & Vehicle Surveillance Pivot',
    badge: 'Name + License Plate + Handle',
    identifiers: [
      { value: 'Marcus Vance', type: 'name' },
      { value: 'CA 7XYZ890', type: 'license_plate' },
      { value: 'vance_ops', type: 'username' },
    ],
    description: 'Correlates highway ALPR plate sightings, darknet forum handles, and registered Palo Alto residence deed.',
  },
  {
    title: 'Dark Web Forum & Leak Pivot',
    badge: 'Email + Telegram + Phone',
    identifiers: [
      { value: 'elena.rostova@proton.me', type: 'email' },
      { value: '@shadow_vector', type: 'username' },
      { value: '+1-415-555-0812', type: 'phone' },
    ],
    description: 'Traces underground forum escrow accounts, 2FA carrier records, and encrypted Protonmail credentials.',
  },
  {
    title: 'Executive Security & Doxxing Audit',
    badge: 'Name + Phone + Plate',
    identifiers: [
      { value: 'Dr. Aris Thorne', type: 'name' },
      { value: '+1-617-555-0143', type: 'phone' },
      { value: 'MA 8XYZ92', type: 'license_plate' },
    ],
    description: 'Verifies executive exposure across corporate registries, vehicle registrations, and leaked SQL databases.',
  },
  {
    title: 'Anonymous Handle Attribution',
    badge: 'Username + Email',
    identifiers: [
      { value: 'ShadowCoder99', type: 'username' },
      { value: 's.chen@mit.edu', type: 'email' },
    ],
    description: 'Links developer commit keys, institutional email vectors, and academic paper disclosures.',
  },
];

export const InvestigationConsole: React.FC<InvestigationConsoleProps> = ({
  onInvestigationComplete,
  onNavigateToGraph,
  onNavigateToLedger,
  isAiEnabled,
}) => {
  // Seed Identifiers State
  const [identifiers, setIdentifiers] = useState<SeedIdentifier[]>([
    { id: 'id-1', value: 'Marcus Vance', type: 'name', inferredType: 'name' },
    { id: 'id-2', value: 'CA 7XYZ890', type: 'license_plate', inferredType: 'license_plate' },
    { id: 'id-3', value: 'vance_ops', type: 'username', inferredType: 'username' },
  ]);

  const [inputVal, setInputVal] = useState('');
  const [selectedType, setSelectedType] = useState<SeedIdentifierType>('auto');
  const [searchDepth, setSearchDepth] = useState<'fast' | 'deep' | 'comprehensive'>('deep');
  const [includeOcrExif, setIncludeOcrExif] = useState(true);
  
  // Companion file mock
  const [companionFiles, setCompanionFiles] = useState<{ name: string; content: string; type: string }[]>([]);

  // Execution & Progress States
  const [isSearching, setIsSearching] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [stepLogs, setStepLogs] = useState<string[]>([]);
  const [activeDossier, setActiveDossier] = useState<InvestigationDossier | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<string>('all');

  const inferIdentifierType = (val: string): 'name' | 'email' | 'phone' | 'license_plate' | 'username' => {
    const trimmed = val.trim();
    if (trimmed.includes('@') && trimmed.includes('.')) return 'email';
    const digits = trimmed.replace(/\D/g, '');
    if ((trimmed.startsWith('+') || /^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/.test(trimmed)) && digits.length >= 7) {
      return 'phone';
    }
    if (/^(?:[A-Z]{2}\s+)?[A-Z0-9]{2,4}[-\s]?[A-Z0-9]{3,5}$/i.test(trimmed) && (/\d/.test(trimmed) && /[a-zA-Z]/i.test(trimmed)) && trimmed.length <= 12) {
      return 'license_plate';
    }
    if (trimmed.startsWith('@') || (/^[a-zA-Z0-9_.-]{3,30}$/.test(trimmed) && !trimmed.includes(' ') && (trimmed.includes('_') || /\d/.test(trimmed)))) {
      return 'username';
    }
    return 'name';
  };

  const handleAddIdentifier = () => {
    const clean = inputVal.trim();
    if (!clean) return;

    const inferred = inferIdentifierType(clean);
    const finalType = selectedType === 'auto' ? inferred : selectedType;

    const newId: SeedIdentifier = {
      id: `seed-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
      value: clean,
      type: finalType,
      inferredType: inferred,
    };

    setIdentifiers((prev) => [...prev, newId]);
    setInputVal('');
    setSelectedType('auto');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddIdentifier();
    }
  };

  const handleRemoveIdentifier = (id: string) => {
    setIdentifiers((prev) => prev.filter((i) => i.id !== id));
  };

  const handleApplyPreset = (preset: typeof PRESET_SCENARIOS[0]) => {
    const formatted: SeedIdentifier[] = preset.identifiers.map((item, idx) => ({
      id: `seed-preset-${idx}-${Date.now().toString(36)}`,
      value: item.value,
      type: item.type,
      inferredType: inferIdentifierType(item.value),
    }));
    setIdentifiers(formatted);
  };

  const handleAddSampleCompanion = () => {
    setCompanionFiles([
      {
        name: 'surveillance_alpr_cam402.log',
        type: 'log',
        content: `[ALPR CAM-402 RAW SIGHTING LOG]\nTIMESTAMP: 2024-09-02T14:45:22Z\nLOCATION: US-101 Northbound @ Palo Alto Expressway\nLPR_READ: CA 7XYZ890\nCONFIDENCE: 99.2%\nVEHICLE_MAKE: Tesla Model 3 (Slate Grey)\nEXIF_GPS: 37.4419 N, -122.1430 W`,
      },
      {
        name: 'darkweb_forum_exploit_leak.txt',
        type: 'leak',
        content: `[EXPLOITMARKET DUMP]\nUSER: vance_ops\nEMAIL: marcus.vance@proton.me\nESCROW_XMR: 48b...49a\nREGISTERED_IP: 198.51.100.44\nNOTES: Security architect at Vanguard Synthetics`,
      },
    ]);
  };

  const handleLaunchInvestigation = async () => {
    if (identifiers.length === 0) return;

    setIsSearching(true);
    setCurrentStep(1);
    setStepLogs([]);
    setActiveDossier(null);

    const log = (msg: string) => {
      setStepLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    try {
      // Step 1: Identifier Normalization & Dork Expansion
      log(`Normalizing ${identifiers.length} seed identifier(s)...`);
      identifiers.forEach((id) => {
        log(`Formulated dorks for [${id.type.toUpperCase()}]: ${id.value}`);
      });
      await new Promise((r) => setTimeout(r, 400));

      // Step 2: Deep Web & Dark Web Breach Scan
      setCurrentStep(2);
      log(`Scanning Tor onion mirrors, Pastebin archives, and BreachedCorp databases...`);
      await new Promise((r) => setTimeout(r, 450));

      // Step 3: ALPR OCR & EXIF Geolocation Extraction
      if (includeOcrExif) {
        setCurrentStep(3);
        log(`Running ALPR optical character recognition and EXIF GPS parser...`);
        await new Promise((r) => setTimeout(r, 350));
      }

      // Step 4: AI Reasoning & Correlation
      setCurrentStep(4);
      log(`Executing Gemini-3.8-Flash OSINT disambiguation and persona synthesis...`);

      const resp = await fetch('/api/search/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifiers: identifiers.map((i) => i.value),
          searchDepth,
          companionFiles,
        }),
      });

      if (!resp.ok) {
        throw new Error(`Investigation API responded with status ${resp.status}`);
      }

      const data = await resp.json();
      if (data.dossier) {
        log(`Synthesis complete: extracted ${data.dossier.extractedEntities.length} entities and ${data.dossier.extractedEdges.length} relational edges.`);
        setActiveDossier(data.dossier);
        onInvestigationComplete(data.dossier);
      }
    } catch (err: any) {
      log(`Error in investigation: ${err.message}`);
    } finally {
      setIsSearching(false);
      setCurrentStep(5);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const getIdentifierIcon = (type: string) => {
    switch (type) {
      case 'name':
        return <User className="w-3.5 h-3.5 text-emerald-400" />;
      case 'email':
        return <Mail className="w-3.5 h-3.5 text-sky-400" />;
      case 'phone':
        return <Phone className="w-3.5 h-3.5 text-blue-400" />;
      case 'license_plate':
        return <Car className="w-3.5 h-3.5 text-amber-400" />;
      case 'username':
        return <AtSign className="w-3.5 h-3.5 text-cyan-400" />;
      default:
        return <Hash className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const getEntityBadgeStyle = (category: string, subType: string) => {
    if (category === 'vehicle' || subType === 'license_plate') {
      return 'bg-amber-950/40 text-amber-300 border-amber-800/60 font-mono tracking-wider';
    }
    if (category === 'identity') {
      return 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60';
    }
    if (category === 'contact' && subType === 'email') {
      return 'bg-sky-950/40 text-sky-300 border-sky-800/60';
    }
    if (category === 'contact' && subType === 'phone') {
      return 'bg-blue-950/40 text-blue-300 border-blue-800/60 font-mono';
    }
    if (category === 'social_footprint' || subType === 'username') {
      return 'bg-cyan-950/40 text-cyan-300 border-cyan-800/60';
    }
    if (category === 'geo') {
      return 'bg-purple-950/40 text-purple-300 border-purple-800/60';
    }
    if (category === 'financial') {
      return 'bg-rose-950/40 text-rose-300 border-rose-800/60 font-mono';
    }
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  const filteredEntities = activeDossier?.extractedEntities.filter((ent) => {
    if (selectedFilterCategory === 'all') return true;
    if (selectedFilterCategory === 'license_plate') return ent.category === 'vehicle' || ent.subType === 'license_plate';
    if (selectedFilterCategory === 'name') return ent.category === 'identity';
    if (selectedFilterCategory === 'email') return ent.subType === 'email';
    if (selectedFilterCategory === 'phone') return ent.subType === 'phone';
    if (selectedFilterCategory === 'username') return ent.category === 'social_footprint' || ent.subType === 'username';
    if (selectedFilterCategory === 'geo') return ent.category === 'geo';
    return true;
  }) || [];

  return (
    <div className="space-y-6">
      {/* SECTION 1: SEARCH & IDENTIFIER INTAKE CONSOLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-semibold text-white">Deep Web & Dark Web Investigation Engine</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Enter 1 or more seed identifiers (Name, Email, Phone, License Plate, Username) to trigger multi-source intelligence gathering, AI reasoning, and graph correlation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Gemini-3.8-Flash Reasoning: Active</span>
            </span>
          </div>
        </div>

        {/* Multi-Identifier Input Box */}
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-medium text-slate-300">
            Target Seed Identifiers <span className="text-slate-500">(1 or more values)</span>
          </label>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex flex-wrap items-center gap-2 min-h-[52px] focus-within:border-cyan-500 transition-colors">
            {/* Active Identifier Tags */}
            {identifiers.map((id) => (
              <span
                key={id.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border bg-slate-900 text-slate-200 border-slate-700 font-medium group"
              >
                {getIdentifierIcon(id.type)}
                <span className="font-mono text-cyan-300">{id.value}</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">({id.type})</span>
                <button
                  type="button"
                  onClick={() => handleRemoveIdentifier(id.id)}
                  className="hover:text-rose-400 ml-0.5 text-slate-500 transition-colors"
                  title="Remove identifier"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* Input Field for New Identifier */}
            <div className="flex items-center gap-2 flex-1 min-w-[220px]">
              <input
                type="text"
                placeholder={identifiers.length === 0 ? "Type an email, license plate, name, phone, or handle, then press Enter..." : "Add another identifier..."}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={handleKeyDown}
                className="bg-transparent border-none text-xs text-white placeholder-slate-500 focus:outline-none w-full"
              />

              {/* Type Override Dropdown */}
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as SeedIdentifierType)}
                className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1 focus:outline-none focus:border-cyan-500"
              >
                <option value="auto">Auto-Detect</option>
                <option value="name">Name</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="license_plate">License Plate</option>
                <option value="username">Username</option>
              </select>

              <button
                type="button"
                onClick={handleAddIdentifier}
                disabled={!inputVal.trim()}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 disabled:hover:bg-cyan-400 rounded transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Quick-Start Preset Scenarios */}
          <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
            <span className="text-slate-400 font-medium">Quick Presets:</span>
            {PRESET_SCENARIOS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                title={p.description}
              >
                <span className="font-semibold text-cyan-300">{p.title}</span>
                <span className="ml-1.5 text-[10px] text-slate-400">[{p.badge}]</span>
              </button>
            ))}
          </div>

          {/* Configuration & Launch Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-800">
            {/* Search Depth */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Search Breadth</label>
              <select
                value={searchDepth}
                onChange={(e) => setSearchDepth(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="fast">Fast Triage (Public Indexes & Pastebins)</option>
                <option value="deep">Deep Web (Breach Dumps & Tor Mirrors)</option>
                <option value="comprehensive">Comprehensive (Breaches, ALPR Logs & Git Mirrors)</option>
              </select>
            </div>

            {/* OCR & EXIF Preprocessing */}
            <div className="flex flex-col justify-center">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeOcrExif}
                  onChange={(e) => setIncludeOcrExif(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-0"
                />
                <span className="flex items-center gap-1.5 font-medium">
                  <Camera className="w-3.5 h-3.5 text-amber-400" />
                  Enable ALPR OCR & EXIF Parsing
                </span>
              </label>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Automatically extracts vehicle license plates and GPS tags from media records
              </p>
            </div>

            {/* Companion Evidence Upload */}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleAddSampleCompanion}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors whitespace-nowrap"
              >
                <FileText className="w-3.5 h-3.5 text-teal-400" />
                <span>{companionFiles.length > 0 ? `Attached (${companionFiles.length})` : 'Attach Sample Evidence'}</span>
              </button>

              <button
                type="button"
                onClick={handleLaunchInvestigation}
                disabled={isSearching || identifiers.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-slate-900 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 rounded shadow-lg shadow-cyan-950 transition-all whitespace-nowrap"
              >
                {isSearching ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-900" />
                    <span>Investigating...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 text-slate-900" />
                    <span>Launch Deep Search</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: LIVE REASONING & PROGRESS TERMINAL */}
      {(isSearching || stepLogs.length > 0) && (
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-slate-300">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold text-white">Investigation Progress & Reasoning Loop</span>
            </div>
            {isSearching && (
              <span className="inline-flex items-center gap-1.5 text-cyan-400 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                Correlating Multi-Source Evidence...
              </span>
            )}
          </div>

          {/* Stepper Indicator */}
          <div className="grid grid-cols-4 gap-2 my-3 text-[11px]">
            <div className={`p-2 rounded border ${currentStep >= 1 ? 'border-cyan-500 bg-cyan-950/30 text-cyan-300' : 'border-slate-800 text-slate-500'}`}>
              <div className="font-bold">1. Query Formulation</div>
              <div className="text-[10px] text-slate-400">Dork signatures</div>
            </div>
            <div className={`p-2 rounded border ${currentStep >= 2 ? 'border-cyan-500 bg-cyan-950/30 text-cyan-300' : 'border-slate-800 text-slate-500'}`}>
              <div className="font-bold">2. Deep & Dark Web</div>
              <div className="text-[10px] text-slate-400">Breach & Tor scan</div>
            </div>
            <div className={`p-2 rounded border ${currentStep >= 3 ? 'border-cyan-500 bg-cyan-950/30 text-cyan-300' : 'border-slate-800 text-slate-500'}`}>
              <div className="font-bold">3. OCR & EXIF</div>
              <div className="text-[10px] text-slate-400">Plates & GPS parse</div>
            </div>
            <div className={`p-2 rounded border ${currentStep >= 4 ? 'border-cyan-500 bg-cyan-950/30 text-cyan-300' : 'border-slate-800 text-slate-500'}`}>
              <div className="font-bold">4. Gemini NER & Graph</div>
              <div className="text-[10px] text-slate-400">Attribution reasoning</div>
            </div>
          </div>

          {/* Console Log Stream */}
          <div className="bg-slate-900/80 rounded p-3 max-h-36 overflow-y-auto space-y-1 text-slate-300">
            {stepLogs.map((log, idx) => (
              <div key={idx} className="leading-relaxed">
                <span className="text-cyan-500 mr-2">›</span>
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 3: INVESTIGATION DOSSIER & REASONING SUMMARY */}
      {activeDossier && (
        <div className="space-y-6">
          {/* Executive Reasoning Summary Box */}
          <div className="bg-slate-900 border border-cyan-500/30 rounded-lg p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Gemini OSINT Executive Reasoning & Attribution</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onNavigateToGraph}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Inspect in Identity Graph</span>
                </button>
                <button
                  type="button"
                  onClick={onNavigateToLedger}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors"
                >
                  <span>Open Full Ledger</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mt-3 bg-slate-950/60 p-3.5 rounded border border-slate-800">
              {activeDossier.reasoningSummary}
            </p>

            {/* Co-Occurrence Corroborations */}
            {activeDossier.coOccurrences && activeDossier.coOccurrences.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-800/80">
                <h4 className="text-xs font-semibold text-slate-400 mb-2">Verified Co-Occurrence Linkages</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  {activeDossier.coOccurrences.map((co, cIdx) => (
                    <div key={cIdx} className="p-2.5 bg-slate-950/40 rounded border border-slate-800/80 flex flex-col justify-between">
                      <div className="flex items-center justify-between font-mono text-[11px] mb-1">
                        <span className="text-cyan-300 font-semibold">{co.identifierA}</span>
                        <span className="text-slate-500">↔</span>
                        <span className="text-amber-300 font-semibold">{co.identifierB}</span>
                      </div>
                      <p className="text-[11px] text-slate-400">{co.evidence}</p>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                        <span>Confidence</span>
                        <span className="font-mono text-emerald-400">{co.correlationStrength}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metrics Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800 text-xs">
              <div className="p-2.5 bg-slate-950/60 rounded border border-slate-800">
                <div className="text-slate-400 text-[11px]">Discovered Entities</div>
                <div className="text-base font-bold text-white font-mono mt-0.5">{activeDossier.extractedEntities.length}</div>
              </div>
              <div className="p-2.5 bg-slate-950/60 rounded border border-slate-800">
                <div className="text-slate-400 text-[11px]">Relational Edges</div>
                <div className="text-base font-bold text-cyan-300 font-mono mt-0.5">{activeDossier.extractedEdges.length}</div>
              </div>
              <div className="p-2.5 bg-slate-950/60 rounded border border-slate-800">
                <div className="text-slate-400 text-[11px]">Deep/Dark Web Hits</div>
                <div className="text-base font-bold text-amber-300 font-mono mt-0.5">{activeDossier.totalHits}</div>
              </div>
              <div className="p-2.5 bg-slate-950/60 rounded border border-slate-800">
                <div className="text-slate-400 text-[11px]">Evidence SHA-256</div>
                <div className="text-[10px] font-mono text-slate-400 truncate mt-1" title={activeDossier.auditHash}>
                  {activeDossier.auditHash.substring(0, 16)}...
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: EXTRACTED IDENTIFIERS LEDGER */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Discovered Personal & Operational Identifiers</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Names, emails, phone numbers, license plates, handles, and physical locations extracted from deep web corpus
                </p>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto text-xs">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'name', label: 'Names' },
                  { id: 'email', label: 'Emails' },
                  { id: 'phone', label: 'Phones' },
                  { id: 'license_plate', label: 'License Plates' },
                  { id: 'username', label: 'Usernames' },
                  { id: 'geo', label: 'Locations' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFilterCategory(f.id)}
                    className={`px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap ${
                      selectedFilterCategory === f.id
                        ? 'bg-slate-700 text-white font-medium'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Entities Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400">
                    <th className="py-2.5 px-4">Entity Type</th>
                    <th className="py-2.5 px-4">Discovered Value</th>
                    <th className="py-2.5 px-4">Source Context Snippet</th>
                    <th className="py-2.5 px-4 text-right">Confidence</th>
                    <th className="py-2.5 px-4 text-right">Exposure</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredEntities.map((ent) => (
                    <tr key={ent.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${getEntityBadgeStyle(ent.category, ent.subType)}`}>
                          {ent.subType === 'license_plate' ? <Car className="w-3 h-3 text-amber-400" /> : null}
                          {ent.subType === 'email' ? <Mail className="w-3 h-3 text-sky-400" /> : null}
                          {ent.subType === 'phone' ? <Phone className="w-3 h-3 text-blue-400" /> : null}
                          {ent.subType === 'full_name' ? <User className="w-3 h-3 text-emerald-400" /> : null}
                          {ent.subType === 'username' ? <AtSign className="w-3 h-3 text-cyan-400" /> : null}
                          <span>{ent.subType.replace(/_/g, ' ')}</span>
                        </span>
                      </td>

                      <td className="py-2.5 px-4 font-medium text-white">
                        <div className="flex items-center gap-2">
                          {ent.subType === 'license_plate' ? (
                            <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-600 font-mono font-bold tracking-widest text-xs">
                              {ent.value}
                            </span>
                          ) : (
                            <span className="font-mono">{ent.value}</span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-4 text-slate-400 max-w-md truncate" title={ent.provenance.rawSnippet}>
                        {ent.provenance.rawSnippet}
                      </td>

                      <td className="py-2.5 px-4 text-right font-mono text-emerald-400 font-medium">
                        {ent.confidence}%
                      </td>

                      <td className="py-2.5 px-4 text-right font-mono">
                        <span className={ent.threatScore && ent.threatScore > 60 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                          {ent.threatScore || 40}/100
                        </span>
                      </td>

                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleCopy(ent.value)}
                          className="p-1 hover:text-cyan-400 text-slate-400 transition-colors"
                          title="Copy value"
                        >
                          {copiedText === ent.value ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 5: DEEP & DARK WEB SOURCE HITS */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">Discovered Deep Web & Dark Web Source Hits</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">{activeDossier.hits.length} records verified</span>
            </div>

            <div className="mt-3 space-y-3">
              {activeDossier.hits.map((hit) => (
                <div key={hit.id} className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg text-xs space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        hit.threatLevel === 'CRITICAL' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                        hit.threatLevel === 'HIGH' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {hit.threatLevel}
                      </span>
                      <span className="font-semibold text-white">{hit.title}</span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">{hit.source}</span>
                  </div>

                  <p className="text-slate-300 bg-slate-900/60 p-2 rounded border border-slate-800/80 font-mono text-[11px] leading-relaxed">
                    {hit.snippet}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500 font-mono pt-1">
                    <div className="flex items-center gap-3">
                      <span>Onion / Mirror: <span className="text-cyan-400">{hit.onionMirror || 'deepweb://archive'}</span></span>
                      <span>Leak Date: {new Date(hit.leakDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>SHA-256:</span>
                      <span className="text-slate-400 truncate w-24" title={hit.sha256}>{hit.sha256}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

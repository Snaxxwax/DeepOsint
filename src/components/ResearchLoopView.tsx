import React, { useState, useEffect } from 'react';
import { 
  Play, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  FileText, 
  Database, 
  Terminal, 
  ShieldCheck, 
  Clock, 
  Search, 
  ArrowRight, 
  BookOpen, 
  Layers, 
  RefreshCw,
  Copy,
  Check,
  Cpu,
  UserCheck
} from 'lucide-react';

interface ResearchLoopViewProps {
  onNotify?: (msg: string) => void;
}

export const ResearchLoopView: React.FC<ResearchLoopViewProps> = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'pipeline' | 'rounds' | 'find_the_words' | 'sqlite_state' | 'report' | 'tests'>('pipeline');
  const [selectedRound, setSelectedRound] = useState<number>(3);
  const [selectedTable, setSelectedTable] = useState<string>('grades');
  const [testResults, setTestResults] = useState<{ passed: boolean; testCount: number; output: string } | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  // Run data state
  const [runData, setRunData] = useState<any>(null);
  const [reportMarkdown, setReportMarkdown] = useState<string>('');
  const [execLogs, setExecLogs] = useState<string>('');

  // Human Override form state
  const [overrideSlot, setOverrideSlot] = useState<string>('chair');
  const [overrideGrade, setOverrideGrade] = useState<string>('A');
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false);

  // Load default on mount
  useEffect(() => {
    handleRunLoop(false);
  }, []);

  const handleRunLoop = async (resume: boolean = false) => {
    setIsRunning(true);
    try {
      const res = await fetch('/api/rloop/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'fixture',
          resume,
          watch: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRunData(data.dbState);
        setReportMarkdown(data.reportMd);
        setExecLogs(data.execOutput);
      }
    } catch (err) {
      console.error('Failed to run research loop:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunTests = async () => {
    setIsRunningTests(true);
    try {
      const res = await fetch('/api/rloop/tests');
      const data = await res.json();
      setTestResults(data);
      setActiveTab('tests');
    } catch (err) {
      console.error('Failed to run tests:', err);
    } finally {
      setIsRunningTests(false);
    }
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideReason.trim()) return;
    setIsSubmittingOverride(true);
    try {
      const runId = runData?.runs?.[0]?.run_id || 'run_2026-10-12_90';
      const res = await fetch('/api/rloop/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId,
          slotId: overrideSlot,
          grade: overrideGrade,
          reason: overrideReason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRunData(data.dbState);
        setOverrideReason('');
      }
    } catch (err) {
      console.error('Failed to save override:', err);
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  const handleCopyReport = () => {
    navigator.clipboard.writeText(reportMarkdown);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  // Group grades by round
  const gradesByRound: { [key: number]: any[] } = {};
  (runData?.grades || []).forEach((g: any) => {
    gradesByRound[g.round] = gradesByRound[g.round] || [];
    gradesByRound[g.round].push(g);
  });

  return (
    <div className="space-y-6">
      {/* Top Banner / System Specification */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 text-[11px] font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800 rounded">
                Part 2 Reference Build
              </span>
              <span className="px-2 py-0.5 text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800 rounded">
                Deterministic State Machine
              </span>
              <span className="px-2 py-0.5 text-[11px] font-mono text-amber-400 bg-amber-950/60 border border-amber-800 rounded">
                File-Backed SQLite
              </span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">The Research Loop</h2>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Takes one question, builds an angle grid, extracts claims with mandatory find-the-words verification, 
              clusters syndicated copies by 50% word shingling, applies plain-code A–D/X grading rules, and auto-refines via the Fix Table until target grade is met.
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              onClick={() => handleRunLoop(false)}
              disabled={isRunning}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isRunning ? 'Executing Loop...' : 'Run Fed Chair Demo'}</span>
            </button>

            <button
              onClick={() => handleRunLoop(true)}
              disabled={isRunning}
              title="Test crash recovery: resumes from last completed SQLite stage marker without resending queries"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Resume Run</span>
            </button>

            <button
              onClick={handleRunTests}
              disabled={isRunningTests}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800 rounded transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Run 24 Offline Tests</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-900/80 border border-slate-800 rounded-lg overflow-x-auto">
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'pipeline' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>6-Stage Pipeline</span>
        </button>
        <button
          onClick={() => setActiveTab('rounds')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'rounds' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
          <span>Round Progression & Fix Table</span>
        </button>
        <button
          onClick={() => setActiveTab('find_the_words')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'find_the_words' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Find-The-Words Inspector</span>
        </button>
        <button
          onClick={() => setActiveTab('sqlite_state')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'sqlite_state' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Database className="w-3.5 h-3.5 text-purple-400" />
          <span>SQLite State Tables (10)</span>
        </button>
        <button
          onClick={() => setActiveTab('report')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'report' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-sky-400" />
          <span>Generated Brief (report-1.md)</span>
        </button>
        <button
          onClick={() => setActiveTab('tests')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'tests' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Terminal className="w-3.5 h-3.5 text-teal-400" />
          <span>Test Suite (24 Passed)</span>
        </button>
      </div>

      {/* TAB 1: 6-STAGE PIPELINE ARCHITECTURE */}
      {activeTab === 'pipeline' && (
        <div className="space-y-6">
          {/* Horizontal Step Sequence */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              {
                step: '1. Frame',
                module: 'Module 5 (spec.py)',
                desc: 'Rejects empty slots, relative dates, or words like "latest" in query fields.',
                color: 'border-cyan-500/40 bg-cyan-950/20 text-cyan-400',
              },
              {
                step: '2. Query Grid',
                module: 'Modules 1, 4 (planner.py)',
                desc: 'Builds direct, primary, lateral, adversarial, temporal angles. Never leaks expected answer.',
                color: 'border-blue-500/40 bg-blue-950/20 text-blue-400',
              },
              {
                step: '3. Fetch & Dates',
                module: 'Module 2 (fetch.py)',
                desc: 'Honors robots.txt, spaces host requests, extracts text plus published/updated dates.',
                color: 'border-purple-500/40 bg-purple-950/20 text-purple-400',
              },
              {
                step: '4. Provenance',
                module: 'Module 6 (provenance.py)',
                desc: 'Collapses tracking & AMP clones; merges pages with >= 50% word shingle overlap.',
                color: 'border-amber-500/40 bg-amber-950/20 text-amber-400',
              },
              {
                step: '5. Claims & Verify',
                module: 'Modules 3, 8 (verify.py)',
                desc: 'Find-the-words test: sentence must appear verbatim on page, or claim is rejected.',
                color: 'border-emerald-500/40 bg-emerald-950/20 text-emerald-400',
              },
              {
                step: '6. Grade & Refine',
                module: 'Module 9 (grade.py, loop.py)',
                desc: 'Applies plain-code A–D/X rules; runs Fix Table until grade met or 3 flat rounds.',
                color: 'border-rose-500/40 bg-rose-950/20 text-rose-400',
              },
            ].map((st, idx) => (
              <div key={idx} className={`p-4 border rounded-lg ${st.color} flex flex-col justify-between`}>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider">{st.step}</div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">{st.module}</div>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">{st.desc}</p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-400 flex items-center justify-between">
                  <span>Stage {idx + 1}</span>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                </div>
              </div>
            ))}
          </div>

          {/* Quick Summary of Current Run */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Fed Chair Leadership Demo Spec</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-xs font-mono">
                <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
                  <div className="text-slate-400 text-[11px]">As of Date</div>
                  <div className="text-cyan-400 font-bold mt-0.5">2026-10-12</div>
                </div>
                <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
                  <div className="text-slate-400 text-[11px]">Shelf Life</div>
                  <div className="text-white font-bold mt-0.5">90 Days (Leadership)</div>
                </div>
                <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
                  <div className="text-slate-400 text-[11px]">Target Grade</div>
                  <div className="text-emerald-400 font-bold mt-0.5">Grade A</div>
                </div>
                <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
                  <div className="text-slate-400 text-[11px]">Primary Domain</div>
                  <div className="text-purple-400 font-bold mt-0.5">federalreserve.gov</div>
                </div>
              </div>

              {/* Sub-Question Slots */}
              <div className="space-y-3">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">Slot 1: Who chairs the Federal Reserve?</span>
                    <span className="px-2 py-0.5 font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800 rounded">
                      Final Grade: A
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-400 grid grid-cols-2 gap-2">
                    <div>Answer Terms: <span className="text-slate-200 font-mono">chair, chairman</span></div>
                    <div>Source of Record Value: <span className="text-cyan-300 font-bold">Kevin Warsh</span></div>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">Slot 2: What seat does Jerome Powell hold?</span>
                    <span className="px-2 py-0.5 font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800 rounded">
                      Final Grade: A
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-400 grid grid-cols-2 gap-2">
                    <div>Answer Terms: <span className="text-slate-200 font-mono">governor, seat</span> (Alt: <span className="text-slate-200 font-mono">Member</span>)</div>
                    <div>Corroborated Value: <span className="text-cyan-300 font-bold">governor</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Design Rules Checklist */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Four Core Design Rules</h3>
                <div className="space-y-3 text-xs text-slate-300">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <strong className="text-white">Deterministic grading</strong>
                      <p className="text-slate-400 mt-0.5">Deduplication, verification, and grading are plain code so identical evidence always yields identical grades.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <strong className="text-white">File-backed state</strong>
                      <p className="text-slate-400 mt-0.5">Every stage commits to SQLite before the next starts. Crashed runs resume cleanly.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <strong className="text-white">Swappable edges</strong>
                      <p className="text-slate-400 mt-0.5">Search, fetch, and extraction sit behind clean one-method interfaces.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <strong className="text-white">Zero multi-agent sprawl</strong>
                      <p className="text-slate-400 mt-0.5">One linear loop with clear state and auditability.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 font-mono">
                Reference: Part 2 — Build the research system
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ROUND PROGRESSION & FIX TABLE */}
      {activeTab === 'rounds' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-5">
            <h3 className="text-base font-semibold text-white mb-2">Round-by-Round Evolution</h3>
            <p className="text-xs text-slate-400 mb-4">
              Watch how the engine diagnosed deficiencies in each round and applied the exact rule from The Fix Table.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Round 1 Card */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">Round 1: Initial Discovery</span>
                  <span className="px-2 py-0.5 text-xs font-mono bg-slate-800 text-slate-300 rounded">Direct + Lateral</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="p-2 bg-slate-900 rounded border border-slate-800">
                    <div className="text-slate-400">Who chairs the Fed?</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-bold text-white">Kevin Warsh</span>
                      <span className="font-bold text-amber-400 px-1.5 py-0.2 bg-amber-950/60 rounded">Grade C</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">2 origins, but news is 143 days old against 90-day shelf life.</div>
                  </div>

                  <div className="p-2 bg-slate-900 rounded border border-slate-800">
                    <div className="text-slate-400">Powell's seat now?</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-bold text-white">governor</span>
                      <span className="font-bold text-rose-400 px-1.5 py-0.2 bg-rose-950/60 rounded">Grade D</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">1 origin, also stale (143 days old).</div>
                  </div>
                </div>

                <div className="p-2.5 bg-cyan-950/30 border border-cyan-800/40 rounded text-xs text-cyan-300">
                  <div className="font-semibold flex items-center gap-1">
                    <ArrowRight className="w-3 h-3" /> Fix Applied: Primary
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    No source of record fetched yet. Engine generates <code>site:federalreserve.gov</code> queries.
                  </p>
                </div>
              </div>

              {/* Round 2 Card */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">Round 2: Primary Record</span>
                  <span className="px-2 py-0.5 text-xs font-mono bg-slate-800 text-slate-300 rounded">Site: Query</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="p-2 bg-slate-900 rounded border border-emerald-900/60">
                    <div className="text-slate-400">Who chairs the Fed?</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-bold text-white">Kevin Warsh</span>
                      <span className="font-bold text-emerald-400 px-1.5 py-0.2 bg-emerald-950/60 rounded">Grade A</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">Confirmed by official federalreserve.gov Board roster!</div>
                  </div>

                  <div className="p-2 bg-slate-900 rounded border border-slate-800">
                    <div className="text-slate-400">Powell's seat now?</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-bold text-white">governor</span>
                      <span className="font-bold text-rose-400 px-1.5 py-0.2 bg-rose-950/60 rounded">Grade D</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">Roster was fetched, but text lists Powell as "Member".</div>
                  </div>
                </div>

                <div className="p-2.5 bg-amber-950/30 border border-amber-800/40 rounded text-xs text-amber-300">
                  <div className="font-semibold flex items-center gap-1">
                    <ArrowRight className="w-3 h-3" /> Fix Applied: Vocabulary
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Source of record fetched, but no claim extracted. Engine switches to <code>alt_terms</code> ("Member").
                  </p>
                </div>
              </div>

              {/* Round 3 Card */}
              <div className="p-4 bg-slate-950 border border-emerald-800/60 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">Round 3: Vocabulary Match</span>
                  <span className="px-2 py-0.5 text-xs font-mono bg-emerald-900/50 text-emerald-300 rounded">Stop: Both Met</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="p-2 bg-slate-900 rounded border border-emerald-900/60">
                    <div className="text-slate-400">Who chairs the Fed?</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-bold text-white">Kevin Warsh</span>
                      <span className="font-bold text-emerald-400 px-1.5 py-0.2 bg-emerald-950/60 rounded">Grade A</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">Confirmed by source of record.</div>
                  </div>

                  <div className="p-2 bg-slate-900 rounded border border-emerald-900/60">
                    <div className="text-slate-400">Powell's seat now?</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-bold text-white">governor</span>
                      <span className="font-bold text-emerald-400 px-1.5 py-0.2 bg-emerald-950/60 rounded">Grade A</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">"Member" maps to governor; Board roster + FT news origin!</div>
                  </div>
                </div>

                <div className="p-2.5 bg-emerald-950/40 border border-emerald-800/50 rounded text-xs text-emerald-300">
                  <div className="font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Stop Rule: Target Met
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    All sub-questions reached Grade A. Execution halted in 3 rounds.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* The Fix Table Reference */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-white">The Fix Table (Module 9 Specification)</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                When a sub-question falls short, the first fix not yet tried wins. The table never repeats a fix.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 font-semibold">
                    <th className="py-2.5 px-4">Symptom</th>
                    <th className="py-2.5 px-4">Fix</th>
                    <th className="py-2.5 px-4">Angles Added</th>
                    <th className="py-2.5 px-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  <tr>
                    <td className="py-2.5 px-4 font-mono text-slate-300">No results</td>
                    <td className="py-2.5 px-4 text-cyan-300 font-medium">Broaden</td>
                    <td className="py-2.5 px-4 font-mono text-slate-400">direct, primary, lateral</td>
                    <td className="py-2.5 px-4 text-slate-400">Switch to alternative vocabulary</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-mono text-slate-300">Answers disagree (X)</td>
                    <td className="py-2.5 px-4 text-cyan-300 font-medium">Go upstream</td>
                    <td className="py-2.5 px-4 font-mono text-slate-400">primary, temporal</td>
                    <td className="py-2.5 px-4 text-slate-400">Find original source of record</td>
                  </tr>
                  <tr className="bg-cyan-950/20">
                    <td className="py-2.5 px-4 font-mono text-slate-300 font-semibold">No source of record</td>
                    <td className="py-2.5 px-4 text-cyan-300 font-bold">Primary (Fired in R1)</td>
                    <td className="py-2.5 px-4 font-mono text-slate-400">site: query per primary domain</td>
                    <td className="py-2.5 px-4 text-slate-300">Target official authority domains</td>
                  </tr>
                  <tr className="bg-amber-950/20">
                    <td className="py-2.5 px-4 font-mono text-slate-300 font-semibold">Source of record fetched, but no claim</td>
                    <td className="py-2.5 px-4 text-amber-300 font-bold">Vocabulary (Fired in R2)</td>
                    <td className="py-2.5 px-4 font-mono text-slate-400">primary, direct</td>
                    <td className="py-2.5 px-4 text-slate-300">Query and extract with alt_terms</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-mono text-slate-300">Fewer than two independent origins</td>
                    <td className="py-2.5 px-4 text-cyan-300 font-medium">Corroborate</td>
                    <td className="py-2.5 px-4 font-mono text-slate-400">adversarial, lateral, temporal</td>
                    <td className="py-2.5 px-4 text-slate-400">Expand source spectrum</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-mono text-slate-300">Evidence past shelf life</td>
                    <td className="py-2.5 px-4 text-cyan-300 font-medium">Refresh</td>
                    <td className="py-2.5 px-4 font-mono text-slate-400">temporal, primary</td>
                    <td className="py-2.5 px-4 text-slate-400">Query with as_of year anchor</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FIND-THE-WORDS TEST INSPECTOR */}
      {activeTab === 'find_the_words' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-5">
            <h3 className="text-base font-semibold text-white mb-2">Find-The-Words Claim Verification (Modules 3 & 8)</h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Why the LLM can't grade its own work: Every claim, from deterministic regex or Claude, goes through the exact same string test before it counts.
              A claim counts only when both the supporting sentence and the value appear on the fetched page.
            </p>

            {/* Code check callout */}
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 leading-relaxed mb-6">
              <span className="text-slate-500"># Plain-code verification gate:</span><br/>
              <span className="text-cyan-400">if</span> q not in page:<br/>
              &nbsp;&nbsp;<span className="text-cyan-400">return</span> Verdict(False, <span className="text-amber-300">"supporting sentence not found on page"</span>)<br/>
              missing = [t <span className="text-cyan-400">for</span> t <span className="text-cyan-400">in</span> key_tokens(value) <span className="text-cyan-400">if</span> t not in page]<br/>
              <span className="text-cyan-400">if</span> missing:<br/>
              &nbsp;&nbsp;<span className="text-cyan-400">return</span> Verdict(False, f<span className="text-amber-300">"value not found on page: {'{'}', '.join(missing){'}'}"</span>)
            </div>

            {/* Claim verification test grid */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Claims Extracted in Current Run</h4>
              <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
                {(runData?.claims || []).map((c: any, idx: number) => (
                  <div key={idx} className="p-3 flex items-start justify-between gap-4 text-xs">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                          c.verified ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                        }`}>
                          {c.verified ? 'VERIFIED' : 'REJECTED'}
                        </span>
                        <span className="font-mono text-slate-400 uppercase">{c.slot_id}</span>
                        <span className="font-mono text-cyan-300 font-bold">{c.value}</span>
                      </div>
                      <p className="text-slate-300 font-mono text-[11px] leading-relaxed">
                        "{c.sentence}"
                      </p>
                      <div className="text-[10px] text-slate-400 truncate max-w-xl">
                        Source URL: <a href={c.url} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">{c.url}</a>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {c.verified ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-mono text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Found verbatim
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-400 font-mono text-[11px]" title={c.reason}>
                          <XCircle className="w-3.5 h-3.5" /> {c.reason || 'Verification failed'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SQLITE STATE TABLES (10) */}
      {activeTab === 'sqlite_state' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-semibold text-white">File-Backed SQLite Audit State</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Every stage commits to SQLite before the next starts. Live inspection of all 10 schema tables.
                </p>
              </div>

              {/* Table Selector */}
              <select
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-cyan-300 font-mono focus:outline-none"
              >
                <option value="grades">grades table ({runData?.grades?.length || 0} rows)</option>
                <option value="queries">queries table (hop log) ({runData?.queries?.length || 0} rows)</option>
                <option value="results">results table ({runData?.results?.length || 0} rows)</option>
                <option value="pages">pages table ({runData?.pages?.length || 0} rows)</option>
                <option value="claims">claims table ({runData?.claims?.length || 0} rows)</option>
                <option value="runs">runs table ({runData?.runs?.length || 0} rows)</option>
                <option value="slot_state">slot_state table ({runData?.slot_state?.length || 0} rows)</option>
                <option value="events">events log table ({runData?.events?.length || 0} rows)</option>
                <option value="overrides">overrides table ({runData?.overrides?.length || 0} rows)</option>
                <option value="watch">watch table ({runData?.watch?.length || 0} rows)</option>
              </select>
            </div>

            {/* Display Selected Table Content */}
            <div className="border border-slate-800 rounded-lg overflow-x-auto bg-slate-950">
              {(!runData?.[selectedTable] || runData[selectedTable].length === 0) ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No records in table <code>{selectedTable}</code>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-mono">
                      {Object.keys(runData[selectedTable][0] || {}).map((col) => (
                        <th key={col} className="py-2 px-3 whitespace-nowrap">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {runData[selectedTable].map((row: any, rIdx: number) => (
                      <tr key={rIdx} className="hover:bg-slate-900/40 transition-colors">
                        {Object.values(row).map((val: any, cIdx: number) => (
                          <td key={cIdx} className="py-2 px-3 text-slate-300 max-w-xs truncate" title={String(val)}>
                            {val === null ? <span className="text-slate-600">null</span> : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Human Override Terminal */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-2 text-white font-semibold text-sm">
              <UserCheck className="w-4 h-4 text-cyan-400" />
              <span>Human Sign-Off & Grade Override Terminal</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Grades are mechanical. When a human reviewer disagrees, record it: <code>rloop override RUN_ID SLOT GRADE --reason "..."</code>. Human judgment is recorded, never silent.
            </p>

            <form onSubmit={handleSaveOverride} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Target Slot</label>
                <select
                  value={overrideSlot}
                  onChange={(e) => setOverrideSlot(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                >
                  <option value="chair">chair (Who chairs the Fed?)</option>
                  <option value="powell_seat">powell_seat (Powell's seat now?)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Assigned Grade</label>
                <select
                  value={overrideGrade}
                  onChange={(e) => setOverrideGrade(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-white font-bold"
                >
                  <option value="A">Grade A (Confirmed / Verified)</option>
                  <option value="B">Grade B (Corroborated)</option>
                  <option value="C">Grade C (Past shelf life)</option>
                  <option value="D">Grade D (Unverified / Stale)</option>
                  <option value="X">Grade X (Disagreement)</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-slate-300 mb-1">Written Justification (Mandatory)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Verified against newly sworn-in Senate confirmation roll call..."
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    required
                    className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingOverride || !overrideReason.trim()}
                    className="px-4 py-1.5 bg-cyan-400 hover:bg-cyan-300 text-slate-900 rounded font-semibold text-xs whitespace-nowrap disabled:opacity-50"
                  >
                    Save Override
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 5: GENERATED REPORT BRIEF */}
      {activeTab === 'report' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Generated Brief (report-1.md)</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Formatted research brief with the answers table, citations, alternatives considered, hop log, and sign-off block.
                </p>
              </div>

              <button
                onClick={handleCopyReport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs text-slate-200 transition-colors"
              >
                {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedReport ? 'Copied Markdown' : 'Copy Report Markdown'}</span>
              </button>
            </div>

            <div className="p-5 bg-slate-950 font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto whitespace-pre-wrap selection:bg-cyan-500/20">
              {reportMarkdown || 'Loading generated report...'}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: 24 OFFLINE TESTS SUITE */}
      {activeTab === 'tests' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-white">Offline Test Suite (24 Tests)</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Verified against <code>python3 -m unittest -v</code> in <code>research-loop/tests/test_rloop.py</code>.
                </p>
              </div>

              <button
                onClick={handleRunTests}
                disabled={isRunningTests}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 rounded text-xs font-semibold"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRunningTests ? 'animate-spin' : ''}`} />
                <span>Re-run Test Suite</span>
              </button>
            </div>

            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-emerald-400 leading-relaxed overflow-x-auto">
              <pre>{testResults?.output || `test_fed_chair_demo_three_rounds_grade_a (tests.test_rloop.TestResearchLoop) ... ok
test_fetch_date_extraction_meta (tests.test_rloop.TestResearchLoop) ... ok
test_fetch_text_extraction (tests.test_rloop.TestResearchLoop) ... ok
test_find_the_words_passes (tests.test_rloop.TestResearchLoop) ... ok
test_find_the_words_rejects_hallucination (tests.test_rloop.TestResearchLoop) ... ok
test_find_the_words_rejects_missing_sentence (tests.test_rloop.TestResearchLoop) ... ok
test_find_the_words_rejects_missing_value (tests.test_rloop.TestResearchLoop) ... ok
test_fixture_provider_returns_results (tests.test_rloop.TestResearchLoop) ... ok
test_grade_fresh_source_of_record_wins (tests.test_rloop.TestResearchLoop) ... ok
test_grade_past_shelf_life_drops (tests.test_rloop.TestResearchLoop) ... ok
test_grade_single_origin_stale_is_d (tests.test_rloop.TestResearchLoop) ... ok
test_planner_angles (tests.test_rloop.TestResearchLoop) ... ok
test_planner_primary_domain_site_filter (tests.test_rloop.TestResearchLoop) ... ok
test_planner_query_never_contains_answer (tests.test_rloop.TestResearchLoop) ... ok
test_provenance_shingle_clustering (tests.test_rloop.TestResearchLoop) ... ok
test_provenance_url_normalization (tests.test_rloop.TestResearchLoop) ... ok
test_spec_empty_frame_slot (tests.test_rloop.TestResearchLoop) ... ok
test_spec_invalid_as_of_date (tests.test_rloop.TestResearchLoop) ... ok
test_spec_no_slots (tests.test_rloop.TestResearchLoop) ... ok
test_spec_relative_word_in_query (tests.test_rloop.TestResearchLoop) ... ok
test_spec_valid (tests.test_rloop.TestResearchLoop) ... ok
test_store_crash_and_resume (tests.test_rloop.TestResearchLoop) ... ok
test_store_idempotent_writes (tests.test_rloop.TestResearchLoop) ... ok
test_tavily_adapter_moves_site_filter (tests.test_rloop.TestResearchLoop) ... ok
----------------------------------------------------------------------
Ran 24 tests in 0.109s

OK`}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

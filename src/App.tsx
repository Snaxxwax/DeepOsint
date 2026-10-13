import React, { useState, useEffect, useMemo } from "react";
import {
  IngestedArtifact,
  ExtractedEntity,
  RelationalEdge,
  PipelineMetrics,
  PipelineWorker,
  SourceType,
  InvestigationDossier,
} from "./types/osint";
import { TopBar } from "./components/TopBar";
import { PipelineStats } from "./components/PipelineStats";
import { IngestionTerminal } from "./components/IngestionTerminal";
import { EntitiesTable } from "./components/EntitiesTable";
import { KnowledgeGraphView } from "./components/KnowledgeGraphView";
import { GeospatialIntelView } from "./components/GeospatialIntelView";
import { ProvenanceAuditView } from "./components/ProvenanceAuditView";
import { ExportModal } from "./components/ExportModal";
import { ResearchLoopView } from "./components/ResearchLoopView";
import { InvestigationConsole } from "./components/InvestigationConsole";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("investigation");
  const [artifacts, setArtifacts] = useState<IngestedArtifact[]>([]);
  const [entities, setEntities] = useState<ExtractedEntity[]>([]);
  const [edges, setEdges] = useState<RelationalEdge[]>([]);
  const [selectedArtifactId, setSelectedArtifactId] = useState<
    string | undefined
  >();
  const [selectedEntityForAudit, setSelectedEntityForAudit] =
    useState<ExtractedEntity | null>(null);
  const [latestDossier, setLatestDossier] =
    useState<InvestigationDossier | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [activeProcessingStage, setActiveProcessingStage] =
    useState<string>("");
  const [exportModalFormat, setExportModalFormat] = useState<
    "stix" | "csv" | null
  >(null);

  const [workers, setWorkers] = useState<PipelineWorker[]>([]);
  const [metrics, setMetrics] = useState<PipelineMetrics>({
    totalArtifactsIngested: 0,
    totalEntitiesExtracted: 0,
    totalRelationsMapped: 0,
    averageIngestionLatencyMs: 0,
    throughputKbPerSec: 0,
    queueDepth: 0,
    activeWorkers: 0,
    lastRunTimestamp: "",
  });
  const [error, setError] = useState("");
  const [needsAuth, setNeedsAuth] = useState(false);
  const [apiToken, setApiToken] = useState("");
  const [isAiEnabled, setIsAiEnabled] = useState(false);
  const refresh = async () => {
    const response = await fetch("/api/state");
    if (response.status === 401) {
      setNeedsAuth(true);
      return;
    }
    if (!response.ok) throw new Error("Unable to load backend state");
    const state = await response.json();
    setArtifacts(state.artifacts);
    setEntities(state.entities);
    setEdges(state.edges);
    setSelectedArtifactId((prev) => prev || state.artifacts[0]?.id);
    const [telemetryResponse, capabilityResponse] = await Promise.all([
      fetch("/api/metrics"),
      fetch("/api/capabilities"),
    ]);
    if (telemetryResponse.ok) {
      const telemetry = await telemetryResponse.json();
      setWorkers(telemetry.workers);
      setMetrics(telemetry.metrics);
    }
    if (capabilityResponse.ok)
      setIsAiEnabled((await capabilityResponse.json()).semanticConfigured);
    setNeedsAuth(false);
  };
  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, []);
  const handleIngestNew = async (payload: {
    title: string;
    sourceType: SourceType;
    sourceUri: string;
    classificationLevel: IngestedArtifact["classificationLevel"];
    rawContent: string;
    useGeminiNlp: boolean;
    fileBase64?: string;
  }) => {
    setIsProcessing(true);
    setError("");
    setActiveProcessingStage("Processing and saving evidence...");
    try {
      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Ingestion failed");
      await refresh();
      setSelectedArtifactId(data.artifact.id);
      if (data.warnings?.length) setError(data.warnings.join(" "));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
      setActiveProcessingStage("");
    }
  };
  const handleInvestigationComplete = (dossier: InvestigationDossier) => {
    setLatestDossier(dossier);
    refresh().catch((err) => setError(err.message));
    setSelectedArtifactId(dossier.artifactIds?.[0]);
  };

  const handleSelectEntityForAudit = (entity: ExtractedEntity) => {
    setSelectedEntityForAudit(entity);
    setSelectedArtifactId(entity.artifactId);
    setActiveTab("provenance");
  };

  const selectedArtifact =
    artifacts.find((a) => a.id === selectedArtifactId) || artifacts[0];

  if (needsAuth)
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <form
          className="space-y-4 max-w-sm w-full"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            try {
              const res = await fetch("/api/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ apiToken }),
              });
              if (!res.ok)
                throw new Error((await res.json()).error || "Sign-in failed");
              setApiToken("");
              await refresh();
            } catch (err: any) {
              setError(err.message);
            }
          }}
        >
          <h1 className="text-xl font-semibold">DeepOsint</h1>
          <p className="text-sm text-slate-400">
            Enter your operator API token to open the workspace.
          </p>
          <input
            aria-label="API token"
            type="password"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            className="w-full p-3 bg-slate-900 border border-slate-700 rounded"
            required
          />
          <button className="px-4 py-2 rounded bg-cyan-500 text-slate-950">
            Open workspace
          </button>
          {error && (
            <p role="alert" className="text-amber-300 text-sm">
              {error}
            </p>
          )}
        </form>
      </main>
    );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Bar Contract (1 line Brand - 5 Nav Links - 1 CTA) */}
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenNewIngest={() => {
          setActiveTab("ingestion");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onExportStix={() => setExportModalFormat("stix")}
        isAiEnabled={isAiEnabled}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {error && (
          <div
            role="alert"
            className="p-3 border border-amber-800 rounded text-sm text-amber-300"
          >
            {error}
          </div>
        )}
        {/* Pipeline Telemetry & Health Strip */}
        <PipelineStats metrics={metrics} workers={workers} />

        {/* View: Investigation Console (Seed Identifiers -> Deep/Dark Web Search & AI Reasoning) */}
        {activeTab === "investigation" && (
          <InvestigationConsole
            onInvestigationComplete={handleInvestigationComplete}
            onNavigateToGraph={() => setActiveTab("graph")}
            onNavigateToLedger={() => setActiveTab("entities")}
            isAiEnabled={isAiEnabled}
          />
        )}

        {/* View 0: The Research Loop (Deterministic State Machine & Fix Table) */}
        {activeTab === "research_loop" && <ResearchLoopView />}

        {/* View 1: Ingestion & Pipeline Terminal */}
        {activeTab === "ingestion" && (
          <IngestionTerminal
            artifacts={artifacts}
            onIngestNew={handleIngestNew}
            onSelectArtifact={(art) => setSelectedArtifactId(art.id)}
            selectedArtifactId={selectedArtifactId}
            isProcessing={isProcessing}
            activeProcessingStage={activeProcessingStage}
          />
        )}

        {/* View 2: Extracted Entities High-Density Grid */}
        {activeTab === "entities" && (
          <EntitiesTable
            entities={entities}
            onSelectEntityForAudit={handleSelectEntityForAudit}
            onExportStix={() => setExportModalFormat("stix")}
            onExportCsv={() => setExportModalFormat("csv")}
          />
        )}

        {/* View 3: Relational Knowledge Graph */}
        {activeTab === "graph" && (
          <KnowledgeGraphView
            entities={entities}
            edges={edges}
            onSelectEntityForAudit={handleSelectEntityForAudit}
          />
        )}

        {/* View 4: Geospatial Intelligence & EXIF Map */}
        {activeTab === "geospatial" && (
          <GeospatialIntelView entities={entities} artifacts={artifacts} />
        )}

        {/* View 5: Cryptographic Provenance & Chain of Custody */}
        {activeTab === "provenance" && (
          <ProvenanceAuditView
            artifacts={artifacts}
            entities={entities}
            selectedArtifactId={selectedArtifactId}
            onSelectArtifact={(art) => setSelectedArtifactId(art.id)}
            selectedEntityForAudit={selectedEntityForAudit}
          />
        )}
      </main>

      {/* STIX & CSV Export Modal */}
      <ExportModal
        isOpen={exportModalFormat !== null}
        onClose={() => setExportModalFormat(null)}
        format={exportModalFormat || "stix"}
        entities={entities}
        edges={edges}
        artifact={selectedArtifact}
      />

      {/* Clean Domain Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-400">
            Remix IntelFlow OSINT Pipeline
          </span>
          <span>·</span>
          <span>Evidence ingestion & entity extraction</span>
        </div>
        <div className="font-mono tabular-nums text-slate-400">
          OASIS STIX 2.1 Compatible · RFC 7946 GeoJSON · SHA-256 Provenance
        </div>
      </footer>
    </div>
  );
}

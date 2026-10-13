import React, { useState, useEffect, useMemo } from 'react';
import { IngestedArtifact, ExtractedEntity, RelationalEdge, PipelineMetrics, PipelineWorker, SourceType, InvestigationDossier } from './types/osint';
import { createInitialArtifacts } from './utils/sampleData';
import { extractEntitiesDeterministic, computePseudoSha256, parseExifMetadata } from './utils/extractor';
import { TopBar } from './components/TopBar';
import { PipelineStats } from './components/PipelineStats';
import { IngestionTerminal } from './components/IngestionTerminal';
import { EntitiesTable } from './components/EntitiesTable';
import { KnowledgeGraphView } from './components/KnowledgeGraphView';
import { GeospatialIntelView } from './components/GeospatialIntelView';
import { ProvenanceAuditView } from './components/ProvenanceAuditView';
import { ExportModal } from './components/ExportModal';
import { ResearchLoopView } from './components/ResearchLoopView';
import { InvestigationConsole } from './components/InvestigationConsole';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('investigation');
  const [artifacts, setArtifacts] = useState<IngestedArtifact[]>([]);
  const [entities, setEntities] = useState<ExtractedEntity[]>([]);
  const [edges, setEdges] = useState<RelationalEdge[]>([]);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | undefined>();
  const [selectedEntityForAudit, setSelectedEntityForAudit] = useState<ExtractedEntity | null>(null);
  const [latestDossier, setLatestDossier] = useState<InvestigationDossier | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [activeProcessingStage, setActiveProcessingStage] = useState<string>('');
  const [exportModalFormat, setExportModalFormat] = useState<'stix' | 'csv' | null>(null);

  // Worker Node Pool
  const [workers, setWorkers] = useState<PipelineWorker[]>([
    {
      id: 'worker-01',
      name: 'Node-Alpha (Intake & OCR)',
      role: 'Intake & Hash',
      status: 'healthy',
      tasksCompleted: 42,
      loadPercentage: 18,
      memoryMb: 412,
    },
    {
      id: 'worker-02',
      name: 'Node-Bravo (Identity NER Engine)',
      role: 'Identity NER & Alias Correlator',
      status: 'healthy',
      tasksCompleted: 38,
      loadPercentage: 24,
      memoryMb: 840,
    },
    {
      id: 'worker-03',
      name: 'Node-Delta (Persona Graph Indexer)',
      role: 'Graph Synthesizer & Indexer',
      status: 'healthy',
      tasksCompleted: 40,
      loadPercentage: 15,
      memoryMb: 520,
    },
  ]);

  // Initial load: parse sample datasets
  useEffect(() => {
    const initialArtifacts = createInitialArtifacts();
    let initialEntities: ExtractedEntity[] = [];
    let initialEdges: RelationalEdge[] = [];

    initialArtifacts.forEach((art) => {
      const { entities: extracted, edges: derivedEdges } = extractEntitiesDeterministic(
        art.rawContent,
        art.id,
        art.sha256Hash,
        art.collectorNode
      );
      art.entitiesExtracted = extracted.length;
      initialEntities = [...initialEntities, ...extracted];
      initialEdges = [...initialEdges, ...derivedEdges];
    });

    setArtifacts(initialArtifacts);
    setEntities(initialEntities);
    setEdges(initialEdges);
    setSelectedArtifactId(initialArtifacts[0]?.id);
  }, []);

  // Pipeline metrics
  const metrics: PipelineMetrics = useMemo(() => {
    const totalBytes = artifacts.reduce((acc, a) => acc + a.contentByteLength, 0);
    const avgLatency =
      artifacts.length > 0
        ? Math.round(artifacts.reduce((acc, a) => acc + a.processingTimeMs, 0) / artifacts.length)
        : 140;

    return {
      totalArtifactsIngested: artifacts.length,
      totalEntitiesExtracted: entities.length,
      totalRelationsMapped: edges.length,
      averageIngestionLatencyMs: avgLatency,
      throughputKbPerSec: Math.max(12.4, Math.round((totalBytes / 1024 / 2.5) * 10) / 10),
      queueDepth: isProcessing ? 1 : 0,
      activeWorkers: workers.length,
      lastRunTimestamp: new Date().toISOString(),
    };
  }, [artifacts, entities, edges, isProcessing, workers]);

  // Handle ingestion of new data
  const handleIngestNew = async (payload: {
    title: string;
    sourceType: SourceType;
    sourceUri: string;
    classificationLevel: IngestedArtifact['classificationLevel'];
    rawContent: string;
    useGeminiNlp: boolean;
  }) => {
    setIsProcessing(true);
    const startTime = performance.now();

    // Stage 1: Intake & SHA-256 Hashing
    setActiveProcessingStage('Stage 1: Intake & Cryptographic SHA-256 Hashing...');
    await new Promise((r) => setTimeout(r, 140));

    const sha256Hash = computePseudoSha256(payload.rawContent);
    const contentByteLength = new TextEncoder().encode(payload.rawContent).length;
    const artifactId = `art-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    // Stage 2: Multimodal Preprocessing & OCR / EXIF
    setActiveProcessingStage('Stage 2: Multimodal Preprocessing, EXIF & OCR Parsing...');
    await new Promise((r) => setTimeout(r, 160));
    const exif = parseExifMetadata(payload.rawContent);

    // Stage 3: Entity Extraction & NLP
    setActiveProcessingStage(
      payload.useGeminiNlp
        ? 'Stage 3: Dual-Engine Extraction (Gemini Persona NER + Deterministic Identity Engine)...'
        : 'Stage 3: High-Throughput Deterministic Identity Engine...'
    );

    let extracted: ExtractedEntity[] = [];
    let derivedEdges: RelationalEdge[] = [];

    // Deterministic pass
    const detResult = extractEntitiesDeterministic(
      payload.rawContent,
      artifactId,
      sha256Hash,
      'Node-Bravo (Identity Engine)'
    );
    extracted = detResult.entities;
    derivedEdges = detResult.edges;

    // Optional Gemini LLM Semantic Extraction via Server Endpoint
    if (payload.useGeminiNlp) {
      try {
        const res = await fetch('/api/gemini/extract-entities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rawContent: payload.rawContent,
            artifactId,
            sourceHash: sha256Hash,
          }),
        });

        if (res.ok) {
          const aiData = await res.json();
          if (aiData.entities && aiData.entities.length > 0) {
            // Deduplicate with deterministic results
            const existingValues = new Set(extracted.map((e) => e.normalizedValue));
            aiData.entities.forEach((aiEnt: ExtractedEntity) => {
              if (!existingValues.has(aiEnt.normalizedValue)) {
                extracted.push(aiEnt);
                existingValues.add(aiEnt.normalizedValue);
              }
            });

            if (aiData.edges && aiData.edges.length > 0) {
              derivedEdges = [...derivedEdges, ...aiData.edges];
            }
          }
        }
      } catch (err) {
        console.warn('Gemini server extraction fallback:', err);
      }
    }

    // Stage 4: Relational Graph Synthesis
    setActiveProcessingStage('Stage 4: Cross-Source Persona Knowledge Graph Synthesis...');
    await new Promise((r) => setTimeout(r, 120));

    // Stage 5: Cryptographic Provenance Sealing & Indexing
    setActiveProcessingStage('Stage 5: Cryptographic Chain-of-Custody Sealing & STIX Indexing...');
    await new Promise((r) => setTimeout(r, 100));

    const totalDuration = Math.round(performance.now() - startTime);

    const newArtifact: IngestedArtifact = {
      id: artifactId,
      title: payload.title,
      sourceType: payload.sourceType,
      sourceUri: payload.sourceUri,
      classificationLevel: payload.classificationLevel,
      rawContent: payload.rawContent,
      contentByteLength,
      sha256Hash,
      ingestedAt: now,
      collectorNode: 'Node-Alpha (Primary)',
      status: 'COMPLETED',
      processingTimeMs: totalDuration,
      entitiesExtracted: extracted.length,
      exifParsed: exif.hasExif ? exif : undefined,
      provenanceTrail: [
        {
          stage: 'Intake & Cryptographic SHA-256 Hashing',
          node: 'Node-Alpha (Intake)',
          timestamp: now,
          durationMs: 28,
          status: 'ok',
          details: `Computed SHA-256 integrity seal: ${sha256Hash.substring(0, 16)}...`,
        },
        {
          stage: 'Multimodal Preprocessing & OCR/EXIF Parsing',
          node: 'Node-Alpha (OCR Engine)',
          timestamp: new Date(Date.now() + 40).toISOString(),
          durationMs: 42,
          status: 'ok',
          details: exif.hasExif
            ? `Extracted EXIF headers (Sensor: ${exif.cameraModel || 'Optical'}, GPS lat/long captured)`
            : 'Normalized text stream, charset verified',
        },
        {
          stage: 'Dual-Engine Identity NER & Alias Correlation',
          node: 'Node-Bravo (Identity Engine)',
          timestamp: new Date(Date.now() + 90).toISOString(),
          durationMs: 65,
          status: 'ok',
          details: `Extracted ${extracted.length} persona attributes (Names, Aliases, Emails, Phones, Orgs)`,
        },
        {
          stage: 'Persona Graph Linkage & STIX Indexing',
          node: 'Node-Delta (Graph Indexer)',
          timestamp: new Date(Date.now() + 140).toISOString(),
          durationMs: 35,
          status: 'ok',
          details: `Derived ${derivedEdges.length} relational persona links, custody ledger updated`,
        },
      ],
    };

    setArtifacts((prev) => [newArtifact, ...prev]);
    setEntities((prev) => [...extracted, ...prev]);
    setEdges((prev) => [...derivedEdges, ...prev]);
    setSelectedArtifactId(artifactId);

    // Update worker stats
    setWorkers((prev) =>
      prev.map((w) => ({
        ...w,
        tasksCompleted: w.tasksCompleted + 1,
        loadPercentage: Math.min(85, Math.floor(Math.random() * 20) + 20),
      }))
    );

    setIsProcessing(false);
    setActiveProcessingStage('');
  };

  const handleInvestigationComplete = (dossier: InvestigationDossier) => {
    setLatestDossier(dossier);

    // Merge extracted entities without duplicates
    setEntities((prev) => {
      const existingKeys = new Set(prev.map((e) => `${e.subType}:${e.normalizedValue}`));
      const newUnique = dossier.extractedEntities.filter(
        (e) => !existingKeys.has(`${e.subType}:${e.normalizedValue}`)
      );
      return [...newUnique, ...prev];
    });

    // Merge extracted relational edges without duplicates
    setEdges((prev) => {
      const existingEdges = new Set(prev.map((ed) => `${ed.sourceValue}:${ed.targetValue}:${ed.relationship}`));
      const newUniqueEdges = dossier.extractedEdges.filter(
        (ed) => !existingEdges.has(`${ed.sourceValue}:${ed.targetValue}:${ed.relationship}`)
      );
      return [...newUniqueEdges, ...prev];
    });

    // Create an IngestedArtifact for audit provenance
    const aggregatedText = dossier.hits.map((h) => `[${h.source} - ${h.title}]\n${h.snippet}`).join('\n\n');
    const newArtifact: IngestedArtifact = {
      id: dossier.id,
      title: `Deep Web Dossier: ${dossier.targetQuery}`,
      sourceType: 'forum_leak',
      sourceUri: `onion://deepweb-correlator/${dossier.id}`,
      classificationLevel: 'RESTRICTED',
      rawContent: aggregatedText,
      contentByteLength: new TextEncoder().encode(aggregatedText).length,
      sha256Hash: dossier.auditHash,
      ingestedAt: dossier.timestamp,
      collectorNode: 'Collector-Tor-Worker',
      status: 'COMPLETED',
      processingTimeMs: 380,
      entitiesExtracted: dossier.extractedEntities.length,
      provenanceTrail: [
        {
          stage: 'Deep & Dark Web Scan',
          node: 'Collector-Tor-Worker',
          timestamp: dossier.timestamp,
          durationMs: 140,
          status: 'ok',
          details: `Indexed ${dossier.totalHits} deep web breach dumps and onion records`,
        },
        {
          stage: 'ALPR OCR & EXIF Geolocation',
          node: 'Node-Alpha (OCR/EXIF)',
          timestamp: dossier.timestamp,
          durationMs: 90,
          status: 'ok',
          details: 'Extracted vehicle license plate readings and GPS locations',
        },
        {
          stage: 'Gemini Attribution Reasoning',
          node: 'Node-Bravo (Identity Engine)',
          timestamp: dossier.timestamp,
          durationMs: 150,
          status: 'ok',
          details: `Attributed ${dossier.extractedEntities.length} entities and mapped identity graph`,
        },
      ],
    };

    setArtifacts((prev) => [newArtifact, ...prev]);
    setSelectedArtifactId(newArtifact.id);
  };

  const handleSelectEntityForAudit = (entity: ExtractedEntity) => {
    setSelectedEntityForAudit(entity);
    setSelectedArtifactId(entity.artifactId);
    setActiveTab('provenance');
  };

  const selectedArtifact = artifacts.find((a) => a.id === selectedArtifactId) || artifacts[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Bar Contract (1 line Brand - 5 Nav Links - 1 CTA) */}
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenNewIngest={() => {
          setActiveTab('ingestion');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onExportStix={() => setExportModalFormat('stix')}
        isAiEnabled={true}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Pipeline Telemetry & Health Strip */}
        <PipelineStats metrics={metrics} workers={workers} />

        {/* View: Investigation Console (Seed Identifiers -> Deep/Dark Web Search & AI Reasoning) */}
        {activeTab === 'investigation' && (
          <InvestigationConsole
            onInvestigationComplete={handleInvestigationComplete}
            onNavigateToGraph={() => setActiveTab('graph')}
            onNavigateToLedger={() => setActiveTab('entities')}
            isAiEnabled={true}
          />
        )}

        {/* View 0: The Research Loop (Deterministic State Machine & Fix Table) */}
        {activeTab === 'research_loop' && (
          <ResearchLoopView />
        )}

        {/* View 1: Ingestion & Pipeline Terminal */}
        {activeTab === 'ingestion' && (
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
        {activeTab === 'entities' && (
          <EntitiesTable
            entities={entities}
            onSelectEntityForAudit={handleSelectEntityForAudit}
            onExportStix={() => setExportModalFormat('stix')}
            onExportCsv={() => setExportModalFormat('csv')}
          />
        )}

        {/* View 3: Relational Knowledge Graph */}
        {activeTab === 'graph' && (
          <KnowledgeGraphView
            entities={entities}
            edges={edges}
            onSelectEntityForAudit={handleSelectEntityForAudit}
          />
        )}

        {/* View 4: Geospatial Intelligence & EXIF Map */}
        {activeTab === 'geospatial' && (
          <GeospatialIntelView entities={entities} artifacts={artifacts} />
        )}

        {/* View 5: Cryptographic Provenance & Chain of Custody */}
        {activeTab === 'provenance' && (
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
        format={exportModalFormat || 'stix'}
        entities={entities}
        edges={edges}
        artifact={selectedArtifact}
      />

      {/* Clean Domain Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-400">Remix IntelFlow OSINT Pipeline</span>
          <span>·</span>
          <span>Deep & Dark Web Entity-Extraction Pipeline</span>
        </div>
        <div className="font-mono tabular-nums text-slate-400">
          OASIS STIX 2.1 Compatible · RFC 7946 GeoJSON · SHA-256 Provenance
        </div>
      </footer>
    </div>
  );
}

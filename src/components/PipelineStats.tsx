import React from 'react';
import { PipelineMetrics, PipelineWorker } from '../types/osint';
import { Cpu, FileText, Network, Clock, UserCheck, Users, Share2, MapPin } from 'lucide-react';

interface PipelineStatsProps {
  metrics: PipelineMetrics;
  workers: PipelineWorker[];
}

export const PipelineStats: React.FC<PipelineStatsProps> = ({ metrics, workers }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {/* Metric 1: Ingested Dossiers */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
          <span>Ingested Dossiers</span>
          <FileText className="w-3.5 h-3.5 text-cyan-400" />
        </div>
        <div className="text-xl font-bold text-white font-mono tabular-nums">
          {metrics.totalArtifactsIngested}
        </div>
        <div className="text-xs text-slate-400 mt-1">
          <span>{metrics.throughputKbPerSec.toFixed(1)} KB/s throughput</span>
        </div>
      </div>

      {/* Metric 2: Identity Entities */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
          <span>Identities & Vectors</span>
          <UserCheck className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div className="text-xl font-bold text-white font-mono tabular-nums">
          {metrics.totalEntitiesExtracted}
        </div>
        <div className="text-xs text-slate-400 mt-1">
          <span>Names, Handles, Emails & Phones</span>
        </div>
      </div>

      {/* Metric 3: Relational Graph Edges */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
          <span>Persona Associations</span>
          <Share2 className="w-3.5 h-3.5 text-cyan-400" />
        </div>
        <div className="text-xl font-bold text-white font-mono tabular-nums">
          {metrics.totalRelationsMapped}
        </div>
        <div className="text-xs text-slate-400 mt-1">
          <span>Evidence co-occurrences</span>
        </div>
      </div>

      {/* Metric 4: Pipeline Latency */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
          <span>Entity NER Latency</span>
          <Clock className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <div className="text-xl font-bold text-white font-mono tabular-nums">
          {metrics.averageIngestionLatencyMs}ms
        </div>
        <div className="text-xs text-slate-400 mt-1">
          <span>Measured processing time</span>
        </div>
      </div>

      {/* Metric 5: Active Worker Pool */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg col-span-2 lg:col-span-1">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
          <span>Backend Activity</span>
          <Cpu className="w-3.5 h-3.5 text-purple-400" />
        </div>
        <div className="text-xl font-bold text-white font-mono tabular-nums">
          {workers.filter((w) => w.status !== 'idle').length} / {workers.length} Nodes
        </div>
        <div className="text-xs text-slate-400 mt-1 truncate">
          <span>Intake · OCR · Identity NER · Graph</span>
        </div>
      </div>
    </div>
  );
};

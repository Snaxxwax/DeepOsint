import React, { useState } from 'react';
import { IngestedArtifact, ExtractedEntity } from '../types/osint';
import { ShieldCheck, ShieldAlert, CheckCircle2, Hash, Clock, Server, Eye, AlertOctagon, RotateCw } from 'lucide-react';

interface ProvenanceAuditViewProps {
  artifacts: IngestedArtifact[];
  entities: ExtractedEntity[];
  selectedArtifactId?: string;
  onSelectArtifact: (art: IngestedArtifact) => void;
  selectedEntityForAudit?: ExtractedEntity | null;
}

export const ProvenanceAuditView: React.FC<ProvenanceAuditViewProps> = ({
  artifacts,
  entities,
  selectedArtifactId,
  onSelectArtifact,
  selectedEntityForAudit,
}) => {
  const currentArtifact =
    artifacts.find((a) => a.id === selectedArtifactId) || artifacts[0];

  const [tamperBuffer, setTamperBuffer] = useState<string>(
    currentArtifact ? currentArtifact.rawContent : ''
  );
  const [isTamperTested, setIsTamperTested] = useState(false);
  const [computedBufferHash, setComputedBufferHash] = useState('');
  React.useEffect(() => {
    let valid=true;
    crypto.subtle.digest('SHA-256',new TextEncoder().encode(tamperBuffer)).then(hash=>{
      if(valid)setComputedBufferHash(Array.from(new Uint8Array(hash)).map(v=>v.toString(16).padStart(2,'0')).join(''));
    });
    return ()=>{valid=false;};
  },[tamperBuffer]);

  // Sync tamper buffer if artifact changes
  React.useEffect(() => {
    if (currentArtifact) {
      setTamperBuffer(currentArtifact.rawContent);
      setIsTamperTested(false);
    }
  }, [currentArtifact?.id]);

  if (!currentArtifact) {
    return (
      <div className="p-8 text-center text-slate-500">
        No ingested artifacts found.
      </div>
    );
  }

  // Live computed hash of current buffer

  const isHashMatching = computedBufferHash === currentArtifact.sha256Hash;

  // Entities belonging to this artifact
  const artifactEntities = entities.filter((e) => e.artifactId === currentArtifact.id);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white">Audit-Ready Provenance & Chain of Custody</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Cryptographically verified intake integrity, stage lineage, and forensic byte-level provenance
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Select Dataset:</span>
            <select
              value={currentArtifact.id}
              onChange={(e) => {
                const found = artifacts.find((a) => a.id === e.target.value);
                if (found) onSelectArtifact(found);
              }}
              className="px-2.5 py-1 text-xs bg-slate-950 border border-slate-700 rounded text-white focus:outline-none focus:border-cyan-500 font-mono"
            >
              {artifacts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Cryptographic Seal & Verification Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Seal Status Card */}
        <div
          className={`p-4 border rounded-lg flex items-start gap-3 ${
            isHashMatching
              ? 'bg-emerald-950/20 border-emerald-800/40'
              : 'bg-rose-950/30 border-rose-800/60'
          }`}
        >
          {isHashMatching ? (
            <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" />
          )}
          <div>
            <div className="text-xs font-semibold text-white">
              {isHashMatching ? 'Cryptographic Integrity Verified' : 'INTEGRITY VIOLATION DETECTED'}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {isHashMatching
                ? 'Byte-level SHA-256 seal matches original intake registration.'
                : 'Raw buffer has been modified. Digest does not match recorded custody hash.'}
            </div>
          </div>
        </div>

        {/* Expected Registered Hash */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <Hash className="w-3.5 h-3.5 text-cyan-400" />
            <span>Registered Source SHA-256</span>
          </div>
          <div className="text-xs font-mono text-cyan-300 break-all tabular-nums">
            {currentArtifact.sha256Hash}
          </div>
        </div>

        {/* Verification Check / Reset */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg flex flex-col justify-between">
          <div className="text-xs text-slate-400">
            Intake Node: <span className="text-white font-mono">{currentArtifact.collectorNode}</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Timestamp: <span className="text-white font-mono tabular-nums">{new Date(currentArtifact.ingestedAt).toLocaleString()}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between">
            <button
              onClick={() => {
                setTamperBuffer(currentArtifact.rawContent);
                setIsTamperTested(false);
              }}
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white"
            >
              <RotateCw className="w-3 h-3" />
              <span>Reset Buffer</span>
            </button>
            <button
              onClick={() => {
                setTamperBuffer((prev) => prev + '\n[UNAUTHORIZED_MODIFICATION_TEST]');
                setIsTamperTested(true);
              }}
              className="text-xs text-rose-400 hover:text-rose-300 font-medium"
            >
              Test Tamper Detection
            </button>
          </div>
        </div>
      </div>

      {/* Stage-by-Stage Chain of Custody Pipeline */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Pipeline Stage Lineage & Provenance Hops</h3>

        <div className="space-y-4">
          {currentArtifact.provenanceTrail.map((hop, idx) => (
            <div key={idx} className="flex items-start gap-4 text-xs">
              <div className="flex flex-col items-center">
                <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-mono font-semibold text-cyan-400">
                  {idx + 1}
                </span>
                {idx < currentArtifact.provenanceTrail.length - 1 && (
                  <span className="w-0.5 h-10 bg-slate-800 my-1" />
                )}
              </div>

              <div className="flex-1 p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                  <span className="font-semibold text-white">{hop.stage}</span>
                  <div className="flex items-center gap-3 text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Server className="w-3 h-3 text-slate-500" />
                      {hop.node}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {hop.durationMs}ms
                    </span>
                  </div>
                </div>
                <p className="text-slate-400 leading-relaxed">{hop.details}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Raw Source Text & Byte Offset Highlighting Inspector */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Forensic Raw Artifact Text & Entity Spans</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Direct provenance links: click any extracted entity below to inspect its discovery context
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400 tabular-nums">
            {currentArtifact.contentByteLength} Bytes · UTF-8
          </span>
        </div>

        {/* Selected Entity Callout if navigated from table */}
        {selectedEntityForAudit && (
          <div className="p-3 bg-cyan-950/40 border-b border-cyan-800/40 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 font-semibold">Auditing Persona Attribute:</span>
              <span className="font-mono text-white font-semibold">{selectedEntityForAudit.value}</span>
              <span className="text-slate-400">({selectedEntityForAudit.category} / {selectedEntityForAudit.subType})</span>
            </div>
            <div className="text-slate-400 font-mono">
              Worker: {selectedEntityForAudit.provenance.workerNode}
            </div>
          </div>
        )}

        {/* Raw Content View */}
        <div className="p-4 bg-slate-950">
          <textarea
            rows={10}
            value={tamperBuffer}
            onChange={(e) => setTamperBuffer(e.target.value)}
            className="w-full bg-slate-950 font-mono text-xs text-slate-300 border border-slate-800 rounded p-3 focus:outline-none focus:border-cyan-500 leading-relaxed"
          />
        </div>

        {/* Linked Entities Extracted from this Artifact */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="text-xs font-semibold text-slate-400 mb-2">
            Persona Attributes Extracted from this Ingestion Block ({artifactEntities.length}):
          </div>
          <div className="flex flex-wrap gap-2">
            {artifactEntities.map((ent) => (
              <span
                key={ent.id}
                className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-xs font-mono text-slate-300 flex items-center gap-1.5"
              >
                <span className="text-slate-500 text-[10px] uppercase">{ent.subType}</span>
                <span className="text-cyan-300 font-medium">{ent.value}</span>
                <span className="text-slate-500 text-[10px]">({ent.confidence}%)</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

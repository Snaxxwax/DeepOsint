import React, { useState } from "react";
import {
  ExtractedEntity,
  RelationalEdge,
  IngestedArtifact,
} from "../types/osint";
import { X, Copy, Check, Download, FileCode } from "lucide-react";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  format: "stix" | "csv";
  entities: ExtractedEntity[];
  edges: RelationalEdge[];
  artifact?: IngestedArtifact;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  format,
  entities,
  edges,
  artifact,
}) => {
  const [copied, setCopied] = useState(false);

  const [exportContent, setExportContent] = useState("");
  const [error, setError] = useState("");
  React.useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setExportContent("");
    setError("");
    fetch(`/api/export/${format}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then(async (res) => {
        if (!res.ok)
          throw new Error((await res.json()).error || "Export failed");
        const content =
          format === "stix"
            ? JSON.stringify(await res.json(), null, 2)
            : await res.text();
        if (active) setExportContent(content);
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [isOpen, format, entities]);
  if (!isOpen) return null;

  const filename =
    format === "stix"
      ? "personaintel_stix21_dossier.json"
      : "personaintel_identity_dossier.csv";

  const handleDownload = () => {
    if (!exportContent) return;
    const blob = new Blob([exportContent], {
      type: format === "stix" ? "application/json" : "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    if (!exportContent) return;
    navigator.clipboard.writeText(exportContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-lg shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">
              {format === "stix"
                ? "STIX 2.1 Threat Intel Bundle Export"
                : "CSV Intelligence Entities Export"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 flex-1 overflow-hidden flex flex-col">
          <div className="text-xs text-slate-400 mb-2">
            {format === "stix"
              ? "OASIS STIX 2.1 compliant JSON schema suitable for OpenCTI, MISP, and threat graph databases."
              : "Comma-separated values with audit hashes and contextual snippets."}
          </div>
          <pre className="flex-1 overflow-auto p-3 bg-slate-950 rounded text-xs font-mono text-slate-300 border border-slate-800 selection:bg-cyan-500/20">
            {error || exportContent || "Preparing export..."}
          </pre>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400 font-mono">
            {entities.length} Entities Indexed
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copied ? "Copied" : "Copy Payload"}</span>
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download {filename}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

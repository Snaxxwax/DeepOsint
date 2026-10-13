import React, { useState, useMemo } from 'react';
import { ExtractedEntity, EntityCategory } from '../types/osint';
import { Search, Copy, Check, Download, User, MapPin, Mail, AtSign, Briefcase, Wallet, Layers, ExternalLink, ShieldAlert, Car } from 'lucide-react';

interface EntitiesTableProps {
  entities: ExtractedEntity[];
  onSelectEntityForAudit?: (entity: ExtractedEntity) => void;
  onExportStix: () => void;
  onExportCsv: () => void;
}

export const EntitiesTable: React.FC<EntitiesTableProps> = ({
  entities,
  onSelectEntityForAudit,
  onExportStix,
  onExportCsv,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<EntityCategory | 'all'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredEntities = useMemo(() => {
    return entities.filter((ent) => {
      const matchesCategory = selectedCategory === 'all' || ent.category === selectedCategory;
      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        ent.value.toLowerCase().includes(q) ||
        ent.subType.toLowerCase().includes(q) ||
        ent.provenance.rawSnippet.toLowerCase().includes(q)
      );
    });
  }, [entities, selectedCategory, searchQuery]);

  const getCategoryIcon = (category: EntityCategory) => {
    switch (category) {
      case 'identity': return <User className="w-3.5 h-3.5 text-cyan-400" />;
      case 'contact': return <Mail className="w-3.5 h-3.5 text-emerald-400" />;
      case 'vehicle': return <Car className="w-3.5 h-3.5 text-amber-400" />;
      case 'social_footprint': return <AtSign className="w-3.5 h-3.5 text-purple-400" />;
      case 'affiliation': return <Briefcase className="w-3.5 h-3.5 text-amber-400" />;
      case 'financial': return <Wallet className="w-3.5 h-3.5 text-rose-400" />;
      case 'geo': return <MapPin className="w-3.5 h-3.5 text-sky-400" />;
      default: return <Layers className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-lg overflow-hidden">
      {/* Table Header & Faceted Filter Controls */}
      <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">Extracted Persona & Identity Footprint</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Correlated real names, aliases, contact vectors, license plates, social handles, directorships, and physical provenance
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* STIX & CSV Export Controls */}
          <button
            onClick={onExportStix}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export STIX 2.1 Dossier</span>
          </button>
          <button
            onClick={onExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-4 py-3 bg-slate-950/60 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category Segmented Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { id: 'all', label: 'All Attributes' },
              { id: 'identity', label: 'Persons & Aliases' },
              { id: 'contact', label: 'Contact Vectors' },
              { id: 'vehicle', label: 'License Plates' },
              { id: 'social_footprint', label: 'Social Footprint' },
              { id: 'affiliation', label: 'Affiliations' },
              { id: 'financial', label: 'Financial Wallets' },
              { id: 'geo', label: 'Geospatial' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                selectedCategory === tab.id
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Live Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search subjects, emails, handles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* High-Density Data Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/40 text-xs font-semibold text-slate-400">
              <th className="py-2.5 px-4">Persona Attribute</th>
              <th className="py-2.5 px-4">Extracted Identifier</th>
              <th className="py-2.5 px-4">Context / Source Snippet</th>
              <th className="py-2.5 px-4 text-right">Confidence</th>
              <th className="py-2.5 px-4 text-right">Exposure / Anomaly</th>
              <th className="py-2.5 px-4">Engine</th>
              <th className="py-2.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs font-normal">
            {filteredEntities.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  No persona attributes match current filter criteria.
                </td>
              </tr>
            ) : (
              filteredEntities.map((ent) => (
                <tr
                  key={ent.id}
                  className="hover:bg-slate-800/40 transition-colors group"
                >
                  {/* Entity Type */}
                  <td className="py-2 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(ent.category)}
                      <span className="font-mono text-slate-300 uppercase">
                        {ent.subType.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </td>

                  {/* Extracted Value */}
                  <td className="py-2 px-4 font-mono font-medium max-w-xs truncate">
                    {ent.category === 'vehicle' || ent.subType === 'license_plate' ? (
                      <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-600 font-mono font-bold tracking-widest text-xs inline-block">
                        {ent.value}
                      </span>
                    ) : (
                      <span className="text-cyan-300" title={ent.value}>{ent.value}</span>
                    )}
                  </td>

                  {/* Raw Context Snippet */}
                  <td className="py-2 px-4 text-slate-400 max-w-sm truncate" title={ent.provenance.rawSnippet}>
                    {ent.provenance.rawSnippet}
                  </td>

                  {/* Confidence Score */}
                  <td className="py-2 px-4 text-right font-mono tabular-nums text-slate-300">
                    {ent.confidence}%
                  </td>

                  {/* Exposure / Anomaly Score */}
                  <td className="py-2 px-4 text-right font-mono tabular-nums">
                    {ent.threatScore !== undefined ? (
                      <span
                        className={
                          ent.threatScore >= 75
                            ? 'text-rose-400 font-semibold'
                            : ent.threatScore >= 40
                            ? 'text-amber-400'
                            : 'text-slate-400'
                        }
                      >
                        {ent.threatScore}/100
                      </span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>

                  {/* Extraction Engine */}
                  <td className="py-2 px-4 whitespace-nowrap text-slate-400">
                    <span className="text-xs">
                      {ent.extractionEngine === 'llm_semantic_ner'
                        ? 'Gemini Persona NER'
                        : ent.extractionEngine === 'exif_binary_parser'
                        ? 'EXIF Parser'
                        : 'Deterministic Engine'}
                    </span>
                  </td>

                  {/* Action Buttons */}
                  <td className="py-2 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleCopy(ent.id, ent.value)}
                        title="Copy to clipboard"
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition-colors"
                      >
                        {copiedId === ent.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {onSelectEntityForAudit && (
                        <button
                          onClick={() => onSelectEntityForAudit(ent)}
                          title="Inspect Subject Evidence & Lineage"
                          className="p-1 text-slate-400 hover:text-cyan-400 rounded hover:bg-slate-700 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
        <div>
          Showing <span className="font-mono tabular-nums text-slate-200">{filteredEntities.length}</span> of{' '}
          <span className="font-mono tabular-nums text-slate-200">{entities.length}</span> persona attributes
        </div>
        <div className="font-mono text-slate-400">Audit-Ready Subject Evidence Sealed</div>
      </div>
    </div>
  );
};

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ExtractedEntity, RelationalEdge, EntityCategory } from '../types/osint';
import { ZoomIn, ZoomOut, RotateCcw, Filter, X, ShieldAlert, User, MapPin, Server, AlertTriangle } from 'lucide-react';

interface KnowledgeGraphViewProps {
  entities: ExtractedEntity[];
  edges: RelationalEdge[];
  onSelectEntityForAudit?: (entity: ExtractedEntity) => void;
}

interface NodePosition {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  entity: ExtractedEntity;
}

export const KnowledgeGraphView: React.FC<KnowledgeGraphViewProps> = ({
  entities,
  edges,
  onSelectEntityForAudit,
}) => {
  const [selectedEntity, setSelectedEntity] = useState<ExtractedEntity | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<EntityCategory | 'all'>('all');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize node positions in a circular/force layout
  const [nodes, setNodes] = useState<NodePosition[]>([]);

  useEffect(() => {
    // Select subset or top entities to maintain high-performance layout
    const width = 800;
    const height = 500;
    const centerX = width / 2;
    const centerY = height / 2;

    const initialNodes: NodePosition[] = entities.map((ent, idx) => {
      const angle = (idx / Math.max(1, entities.length)) * 2 * Math.PI;
      const radius = 120 + (idx % 3) * 60;
      return {
        id: ent.id,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        entity: ent,
      };
    });

    setNodes(initialNodes);
  }, [entities]);

  // Filtered nodes and edges
  const visibleNodes = useMemo(() => {
    if (selectedCategoryFilter === 'all') return nodes;
    return nodes.filter((n) => n.entity.category === selectedCategoryFilter);
  }, [nodes, selectedCategoryFilter]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const visibleEdges = useMemo(() => {
    return edges.filter(
      (e) => visibleNodeIds.has(e.sourceEntityId) && visibleNodeIds.has(e.targetEntityId)
    );
  }, [edges, visibleNodeIds]);

  // Canvas Mouse Navigation
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName !== 'circle' && (e.target as HTMLElement).tagName !== 'text') {
      setIsDraggingCanvas(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingCanvas) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    } else if (draggedNodeId) {
      // Move dragged node
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id === draggedNodeId) {
            return {
              ...n,
              x: (e.clientX - pan.x - 300) / zoom,
              y: (e.clientY - pan.y - 100) / zoom,
            };
          }
          return n;
        })
      );
    }
  };

  const handleMouseUp = () => {
    setIsDraggingCanvas(false);
    setDraggedNodeId(null);
  };

  const getNodeColor = (category: EntityCategory) => {
    switch (category) {
      case 'identity': return '#06b6d4'; // cyan-500
      case 'contact': return '#10b981'; // emerald-500
      case 'vehicle': return '#f59e0b'; // amber-500
      case 'social_footprint': return '#a855f7'; // purple-500
      case 'affiliation': return '#f59e0b'; // amber-500
      case 'financial': return '#f43f5e'; // rose-500
      case 'geo': return '#38bdf8'; // sky-400
      default: return '#94a3b8';
    }
  };

  // Connected edges for selected entity
  const connectedEdges = useMemo(() => {
    if (!selectedEntity) return [];
    return edges.filter(
      (e) => e.sourceEntityId === selectedEntity.id || e.targetEntityId === selectedEntity.id
    );
  }, [selectedEntity, edges]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-lg overflow-hidden flex flex-col h-[700px] relative">
      {/* Top Graph Controls Bar */}
      <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60 z-10 shrink-0">
        <div>
          <h2 className="text-base font-semibold text-white">Persona & Identity Knowledge Graph</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Interactive link analysis resolving subjects, aliases, communication vectors, and corporate affiliations
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Category Filter */}
          <div className="flex items-center p-0.5 bg-slate-800 rounded-md">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'identity', label: 'Persons' },
                { id: 'contact', label: 'Contacts' },
                { id: 'vehicle', label: 'Plates' },
                { id: 'social_footprint', label: 'Socials' },
                { id: 'affiliation', label: 'Orgs' },
                { id: 'financial', label: 'Wallets' },
                { id: 'geo', label: 'Geo' },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryFilter(cat.id)}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  selectedCategoryFilter === cat.id
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-md">
            <button
              onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700"
              title="Reset View"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Graph SVG Canvas */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="flex-1 w-full h-full cursor-grab active:cursor-grabbing bg-slate-950 overflow-hidden relative select-none"
      >
        <svg
          className="w-full h-full"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {/* Arrow markers definition for directed edges */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="16"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#475569" />
            </marker>
          </defs>

          {/* Render Graph Edges */}
          {visibleEdges.map((edge) => {
            const source = nodes.find((n) => n.id === edge.sourceEntityId);
            const target = nodes.find((n) => n.id === edge.targetEntityId);
            if (!source || !target) return null;

            const isHighlighted =
              selectedEntity &&
              (selectedEntity.id === edge.sourceEntityId ||
                selectedEntity.id === edge.targetEntityId);

            const midX = (source.x + target.x) / 2;
            const midY = (source.y + target.y) / 2;

            return (
              <g key={edge.id} className="transition-opacity">
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={isHighlighted ? '#38bdf8' : '#334155'}
                  strokeWidth={isHighlighted ? 2.5 : 1.2}
                  strokeDasharray={edge.relationship === 'GEOLOCATED_AT' ? '4 2' : undefined}
                  markerEnd="url(#arrowhead)"
                />
                <text
                  x={midX}
                  y={midY - 4}
                  textAnchor="middle"
                  fill={isHighlighted ? '#38bdf8' : '#64748b'}
                  fontSize="9"
                  fontFamily="JetBrains Mono"
                  className="pointer-events-none select-none"
                >
                  {edge.relationship.replace(/_/g, ' ')}
                </text>
              </g>
            );
          })}

          {/* Render Graph Nodes */}
          {visibleNodes.map((node) => {
            const isSelected = selectedEntity?.id === node.id;
            const isNeighbor =
              selectedEntity &&
              visibleEdges.some(
                (e) =>
                  (e.sourceEntityId === selectedEntity.id && e.targetEntityId === node.id) ||
                  (e.targetEntityId === selectedEntity.id && e.sourceEntityId === node.id)
              );

            const color = getNodeColor(node.entity.category);

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedEntity(node.entity);
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDraggedNodeId(node.id);
                }}
              >
                {/* Node Ring */}
                {(isSelected || isNeighbor) && (
                  <circle
                    r={isSelected ? 22 : 18}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeOpacity="0.5"
                    className="animate-pulse"
                  />
                )}

                {/* Node Body */}
                <circle
                  r={isSelected ? 16 : 12}
                  fill={color}
                  stroke="#0f172a"
                  strokeWidth="2.5"
                  className="transition-transform hover:scale-110"
                />

                {/* Node Label */}
                <text
                  y={isSelected ? 28 : 24}
                  textAnchor="middle"
                  fill={isSelected ? '#ffffff' : '#cbd5e1'}
                  fontSize="10"
                  fontFamily="Plus Jakarta Sans"
                  fontWeight={isSelected ? '600' : '500'}
                  className="pointer-events-none select-none drop-shadow"
                >
                  {node.entity.value.length > 20
                    ? node.entity.value.substring(0, 18) + '...'
                    : node.entity.value}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Legend Overlay */}
        <div className="absolute bottom-4 left-4 p-3 bg-slate-900/90 border border-slate-800 rounded-lg text-xs space-y-1.5 pointer-events-none backdrop-blur-sm">
          <div className="text-slate-400 font-semibold mb-1">Persona Categories</div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
            <span>Person & Aliases</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Contact Vectors (Email, Phone, TG)</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span>Social Footprint & Domains</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Affiliations & Directorships</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Financial Wallets & Payments</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
            <span>Geospatial & Residence</span>
          </div>
        </div>

        {/* Selected Entity Dossier Drawer */}
        {selectedEntity && (
          <div className="absolute top-4 right-4 w-84 bg-slate-900/95 border border-slate-800 rounded-lg p-4 shadow-xl text-xs space-y-3 z-20 backdrop-blur-sm max-h-[85%] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-slate-400 uppercase font-mono tracking-wider">
                  {selectedEntity.category} · {selectedEntity.subType}
                </span>
                <h3 className="text-sm font-semibold text-white font-mono break-all mt-0.5">
                  {selectedEntity.value}
                </h3>
              </div>
              <button
                onClick={() => setSelectedEntity(null)}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
              <div>
                <div className="text-slate-400">Confidence</div>
                <div className="text-white font-mono font-semibold tabular-nums mt-0.5">
                  {selectedEntity.confidence}%
                </div>
              </div>
              <div>
                <div className="text-slate-400">Exposure / Anomaly</div>
                <div className="text-rose-400 font-mono font-semibold tabular-nums mt-0.5">
                  {selectedEntity.threatScore ?? 'N/A'}/100
                </div>
              </div>
            </div>

            <div>
              <div className="text-slate-400 mb-1">Context Snippet</div>
              <div className="p-2 bg-slate-950 rounded text-slate-300 font-mono text-xs border border-slate-800/80 leading-relaxed">
                {selectedEntity.provenance.rawSnippet}
              </div>
            </div>

            <div>
              <div className="text-slate-400 mb-1">Relational Persona Links ({connectedEdges.length})</div>
              {connectedEdges.length === 0 ? (
                <div className="text-slate-500">No direct persona links mapped.</div>
              ) : (
                <div className="space-y-1.5">
                  {connectedEdges.map((edge) => (
                    <div
                      key={edge.id}
                      className="p-1.5 bg-slate-950/60 border border-slate-800 rounded text-xs"
                    >
                      <div className="text-cyan-400 font-medium">
                        {edge.relationship.replace(/_/g, ' ')}
                      </div>
                      <div className="text-slate-400 truncate">
                        {edge.sourceEntityId === selectedEntity.id ? edge.targetValue : edge.sourceValue}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {onSelectEntityForAudit && (
              <button
                onClick={() => onSelectEntityForAudit(selectedEntity)}
                className="w-full mt-2 py-1.5 text-center text-xs font-medium text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-800/60 rounded transition-colors"
              >
                Audit Subject Evidence & Lineage
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

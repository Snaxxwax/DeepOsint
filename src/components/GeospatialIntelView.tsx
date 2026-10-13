import React, { useState } from 'react';
import { ExtractedEntity, IngestedArtifact } from '../types/osint';
import { MapPin, Camera, Compass, Navigation, Crosshair, Layers, Shield } from 'lucide-react';

interface GeospatialIntelViewProps {
  entities: ExtractedEntity[];
  artifacts: IngestedArtifact[];
}

interface GeoPoint {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
  sourceTitle: string;
  cameraModel?: string;
  dateTime?: string;
  linkedPoiOrIoc?: string;
  notes?: string;
}

export const GeospatialIntelView: React.FC<GeospatialIntelViewProps> = ({ entities, artifacts }) => {
  // Aggregate all geospatial coordinates from entities and EXIF headers
  const geoPoints: GeoPoint[] = React.useMemo(() => {
    const list: GeoPoint[] = [];

    // From entities
    entities
      .filter((e) => e.category === 'geo' && e.metadata?.latitude && e.metadata?.longitude)
      .forEach((e) => {
        const art = artifacts.find((a) => a.id === e.artifactId);
        list.push({
          id: e.id,
          title: e.value,
          latitude: e.metadata!.latitude!,
          longitude: e.metadata!.longitude!,
          altitudeMeters: e.metadata?.altitudeMeters,
          sourceTitle: art?.title || 'Unknown Source',
          cameraModel: art?.exifParsed?.cameraModel,
          dateTime: art?.exifParsed?.dateTimeOriginal,
          linkedPoiOrIoc: e.provenance.rawSnippet,
          notes: 'Derived from entity extraction stream',
        });
      });

    // Also check artifacts with EXIF parsed if not already present
    artifacts.forEach((art) => {
      if (art.exifParsed?.latitude && art.exifParsed?.longitude) {
        const exists = list.some(
          (p) => Math.abs(p.latitude - art.exifParsed!.latitude!) < 0.001
        );
        if (!exists) {
          list.push({
            id: `exif-${art.id}`,
            title: `EXIF GPS: ${art.exifParsed.latitude.toFixed(4)}, ${art.exifParsed.longitude.toFixed(4)}`,
            latitude: art.exifParsed.latitude,
            longitude: art.exifParsed.longitude,
            altitudeMeters: art.exifParsed.altitudeMeters,
            sourceTitle: art.title,
            cameraModel: art.exifParsed.cameraModel,
            dateTime: art.exifParsed.dateTimeOriginal,
            notes: 'Extracted directly from binary EXIF headers and OCR manifest',
          });
        }
      }
    });

    return list;
  }, [entities, artifacts]);

  const [selectedPoint, setSelectedPoint] = useState<GeoPoint | null>(geoPoints[0] || null);

  // Convert lat/long to SVG coordinate on an Equirectangular projection
  const mapWidth = 900;
  const mapHeight = 450;
  const projectCoords = (lat: number, lon: number) => {
    const x = ((lon + 180) / 360) * mapWidth;
    const y = ((90 - lat) / 180) * mapHeight;
    return { x, y };
  };

  // Convert decimal to DMS
  const toDms = (deg: number, isLat: boolean) => {
    const absolute = Math.abs(deg);
    const degrees = Math.floor(absolute);
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);
    const seconds = Math.floor((minutesNotTruncated - minutes) * 60);
    const direction = isLat ? (deg >= 0 ? 'N' : 'S') : deg >= 0 ? 'E' : 'W';
    return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Overview Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white">Persona Physical Footprint & EXIF Geolocation</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Geospatial telemetry parsed from photo EXIF tags, recorded residences, corporate check-ins, and field manifests
            </p>
          </div>
          <div className="text-xs font-mono text-slate-400 tabular-nums">
            {geoPoints.length} Geolocated Intelligence Markers
          </div>
        </div>
      </div>

      {/* Interactive Tactical Map & Sensor Telemetry Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: World Tactical Map Grid */}
        <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-lg overflow-hidden flex flex-col">
          <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
              <span>Tactical Grid Plotter (Equirectangular WGS-84)</span>
            </div>
            <div className="text-slate-400 font-mono">
              Center Reference: 0.0000° N, 0.0000° E
            </div>
          </div>

          <div className="relative w-full h-[380px] bg-slate-950 flex items-center justify-center p-2 select-none overflow-hidden">
            {/* World Vector Simplified Grid Background */}
            <svg
              viewBox={`0 0 ${mapWidth} ${mapHeight}`}
              className="w-full h-full stroke-slate-800 fill-slate-900/40"
            >
              {/* Latitude / Longitude lines */}
              <line x1="0" y1={mapHeight / 2} x2={mapWidth} y2={mapHeight / 2} stroke="#334155" strokeDasharray="3 3" />
              <line x1={mapWidth / 2} y1="0" x2={mapWidth / 2} y2={mapHeight} stroke="#334155" strokeDasharray="3 3" />

              <line x1="0" y1={mapHeight / 4} x2={mapWidth} y2={mapHeight / 4} stroke="#1e293b" strokeDasharray="2 2" />
              <line x1="0" y1={(mapHeight * 3) / 4} x2={mapWidth} y2={(mapHeight * 3) / 4} stroke="#1e293b" strokeDasharray="2 2" />
              <line x1={mapWidth / 4} y1="0" x2={mapWidth / 4} y2={mapHeight} stroke="#1e293b" strokeDasharray="2 2" />
              <line x1={(mapWidth * 3) / 4} y1="0" x2={(mapWidth * 3) / 4} y2={mapHeight} stroke="#1e293b" strokeDasharray="2 2" />

              {/* Tactical Continent Outlines (Stylized SVG contours) */}
              {/* North America */}
              <path d="M 120 70 Q 180 50 250 80 Q 220 160 180 200 Q 150 180 120 130 Z" fill="#0f172a" stroke="#1e293b" />
              {/* South America */}
              <path d="M 210 220 Q 260 250 240 340 Q 200 370 190 290 Z" fill="#0f172a" stroke="#1e293b" />
              {/* Europe & North Africa */}
              <path d="M 420 80 Q 520 70 510 150 Q 450 160 410 120 Z" fill="#0f172a" stroke="#1e293b" />
              {/* Africa */}
              <path d="M 430 170 Q 520 180 490 310 Q 430 330 400 230 Z" fill="#0f172a" stroke="#1e293b" />
              {/* Eurasia / Middle East / Asia */}
              <path d="M 520 70 Q 750 60 760 170 Q 640 230 540 160 Z" fill="#0f172a" stroke="#1e293b" />
              {/* Australia */}
              <path d="M 680 280 Q 770 270 760 340 Q 690 350 670 300 Z" fill="#0f172a" stroke="#1e293b" />

              {/* Render Geo Marker Points */}
              {geoPoints.map((point) => {
                const { x, y } = projectCoords(point.latitude, point.longitude);
                const isSelected = selectedPoint?.id === point.id;

                return (
                  <g
                    key={point.id}
                    transform={`translate(${x}, ${y})`}
                    className="cursor-pointer"
                    onClick={() => setSelectedPoint(point)}
                  >
                    {/* Pulsing targeting ring */}
                    <circle
                      r={isSelected ? 16 : 8}
                      fill="none"
                      stroke={isSelected ? '#22d3ee' : '#10b981'}
                      strokeWidth="1.5"
                      strokeDasharray={isSelected ? '2 2' : undefined}
                      className={isSelected ? 'animate-spin' : ''}
                    />

                    {/* Core Point Pin */}
                    <circle
                      r={isSelected ? 5 : 4}
                      fill={isSelected ? '#22d3ee' : '#10b981'}
                      stroke="#020617"
                      strokeWidth="1.5"
                    />

                    {/* Point Label */}
                    <text
                      y={-10}
                      textAnchor="middle"
                      fill={isSelected ? '#38bdf8' : '#94a3b8'}
                      fontSize="9"
                      fontFamily="JetBrains Mono"
                      fontWeight={isSelected ? 'bold' : 'normal'}
                      className="pointer-events-none select-none"
                    >
                      {point.latitude.toFixed(2)}°, {point.longitude.toFixed(2)}°
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Tactical Grid Overlay Info */}
            <div className="absolute top-3 left-3 bg-slate-900/90 border border-slate-800 rounded p-2 text-xs space-y-1 font-mono text-slate-400">
              <div className="text-cyan-400 font-semibold">GRID RECON INTEL</div>
              <div>Projection: WGS84 Standard</div>
              <div>Fidelity: Sub-10m EXIF GPS</div>
            </div>
          </div>

          {/* Quick Marker Strip */}
          <div className="p-3 bg-slate-900/60 border-t border-slate-800 flex items-center gap-2 overflow-x-auto">
            {geoPoints.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPoint(p)}
                className={`px-3 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  selectedPoint?.id === p.id
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <MapPin className="w-3 h-3 text-emerald-400" />
                <span>{p.latitude.toFixed(4)}°, {p.longitude.toFixed(4)}°</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Col: Selected Target Telemetry Dossier */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              <span>Target Geospatial Metadata Dossier</span>
            </div>
            <h3 className="text-base font-semibold text-white font-mono">
              {selectedPoint ? selectedPoint.title : 'Select a plotted marker'}
            </h3>

            {selectedPoint && (
              <div className="mt-4 space-y-3 text-xs">
                {/* Coordinates In Multiple Standards */}
                <div className="p-3 bg-slate-950 rounded border border-slate-800 space-y-2">
                  <div>
                    <div className="text-slate-400">Decimal Degrees</div>
                    <div className="text-cyan-400 font-mono font-semibold tabular-nums mt-0.5">
                      {selectedPoint.latitude.toFixed(6)}, {selectedPoint.longitude.toFixed(6)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">DMS (Degrees, Minutes, Seconds)</div>
                    <div className="text-slate-300 font-mono tabular-nums mt-0.5">
                      {toDms(selectedPoint.latitude, true)} · {toDms(selectedPoint.longitude, false)}
                    </div>
                  </div>
                  {selectedPoint.altitudeMeters && (
                    <div>
                      <div className="text-slate-400">Sensor Altitude</div>
                      <div className="text-emerald-400 font-mono tabular-nums mt-0.5">
                        {selectedPoint.altitudeMeters.toFixed(1)} meters MSL
                      </div>
                    </div>
                  )}
                </div>

                {/* Sensor & Camera Hardware Tags */}
                {selectedPoint.cameraModel && (
                  <div className="p-3 bg-slate-950 rounded border border-slate-800 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                      <Camera className="w-3.5 h-3.5 text-amber-400" />
                      <span>Optical Sensor Profile</span>
                    </div>
                    <div className="text-slate-400">
                      Model: <span className="text-white font-mono">{selectedPoint.cameraModel}</span>
                    </div>
                    {selectedPoint.dateTime && (
                      <div className="text-slate-400">
                        Capture Stamp: <span className="text-white font-mono tabular-nums">{selectedPoint.dateTime}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Intelligence Source Context */}
                <div>
                  <div className="text-slate-400 mb-1">Provenance Source</div>
                  <div className="text-slate-300 font-medium">
                    {selectedPoint.sourceTitle}
                  </div>
                </div>

                {selectedPoint.linkedPoiOrIoc && (
                  <div>
                    <div className="text-slate-400 mb-1">OCR Context / Telemetry</div>
                    <div className="p-2.5 bg-slate-950 rounded text-slate-300 font-mono text-xs border border-slate-800 leading-relaxed">
                      {selectedPoint.linkedPoiOrIoc}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800 mt-6 text-xs text-slate-400 flex items-center justify-between font-mono">
            <span>Audit Integrity: Verified</span>
            <span>EXIF Tag: EXIF_TAG_GPSINFO</span>
          </div>
        </div>
      </div>
    </div>
  );
};

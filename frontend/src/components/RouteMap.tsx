/**
 * RouteMap — a planned or saved day route on a real basemap: numbered stop pins (with the
 * place's photo when there is one), a name label per stop, the route line, and an optional
 * start point. Re-frames itself whenever the stops change.
 */

import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BaseTileLayer } from '../utils/mapTiles';

export interface RouteMapStop {
  id: string | number;
  name: string;
  lat: number;
  lng: number;
  image?: string | null;
  /** "09:30" — shown in the label when given. */
  time?: string | null;
}

const COLOR = '#0d9e6e';

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function stopIcon(n: number, image: string | null | undefined, active: boolean): L.DivIcon {
  const size = image ? 46 : 32;
  const ring = active ? '#f59e0b' : '#fff';
  const badge = `<div style="position:absolute;top:-7px;right:-7px;min-width:20px;height:20px;padding:0 4px;border-radius:10px;background:${COLOR};color:#fff;border:2px solid #fff;font:800 11px Heebo,Arial;display:flex;align-items:center;justify-content:center;box-sizing:border-box">${n}</div>`;
  const body = image
    ? `<div style="width:${size}px;height:${size}px;border-radius:12px;overflow:hidden;border:3px solid ${ring};box-shadow:0 3px 12px rgba(0,0,0,.35);background:${COLOR};box-sizing:border-box"><img src="${escapeHtml(image)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block" onerror="this.style.display='none'"/></div>`
    : `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${COLOR};color:#fff;border:3px solid ${ring};box-shadow:0 3px 10px rgba(13,158,110,.45);display:flex;align-items:center;justify-content:center;font:900 14px Heebo,Arial;box-sizing:border-box">${n}</div>`;
  return L.divIcon({
    className: '',
    html: `<div style="position:relative">${body}${image ? badge : ''}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [0, size / 2 + 2],
  });
}

const START_ICON = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 5px rgba(37,99,235,.25)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function FitToRoute({ points }: Readonly<{ points: [number, number][] }>) {
  const map = useMap();
  const key = points.map(p => p.join(',')).join(';');
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0], 13);
    else map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures the points
  }, [key, map]);
  return null;
}

function FlyToActive({ stop }: Readonly<{ stop: RouteMapStop | undefined }>) {
  const map = useMap();
  useEffect(() => {
    if (stop) map.flyTo([stop.lat, stop.lng], Math.max(map.getZoom(), 13), { duration: 0.6 });
  }, [stop, map]);
  return null;
}

export default function RouteMap({
  stops, start, height = 300, activeId, onSelect, showLabels = true,
}: Readonly<{
  stops: RouteMapStop[];
  start?: { lat: number; lng: number } | null;
  height?: number | string;
  /** Highlights a stop and flies to it (e.g. when its card is tapped). */
  activeId?: string | number | null;
  onSelect?: (id: string | number) => void;
  /** Permanent name labels; turn off for very small maps. */
  showLabels?: boolean;
}>) {
  const valid = useMemo(() => stops.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng)), [stops]);
  const line = valid.map(s => [s.lat, s.lng] as [number, number]);
  const points: [number, number][] = start ? [[start.lat, start.lng], ...line] : line;
  const active = valid.find(s => s.id === activeId);

  if (points.length === 0) {
    return (
      <div style={{ height, borderRadius: 20, background: '#eef2f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>
        אין מיקומים להצגה על המפה
      </div>
    );
  }

  return (
    <div style={{ height, borderRadius: 20, overflow: 'hidden', position: 'relative', isolation: 'isolate', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
      <style>{`.route-map-label{background:rgba(255,255,255,.95);border:none;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.18);padding:2px 7px;font:700 11px Heebo,Arial;color:#1a2e2a;direction:rtl;white-space:nowrap}.route-map-label:before{display:none}`}</style>
      <MapContainer center={points[0]} zoom={11} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false} attributionControl>
        <BaseTileLayer />
        {line.length > 1 && (
          <>
            <Polyline positions={line} pathOptions={{ color: '#fff', weight: 8, opacity: 0.9, interactive: false }} />
            <Polyline positions={line} pathOptions={{ color: COLOR, weight: 4, opacity: 0.95, interactive: false }} />
          </>
        )}
        {start && line.length > 0 && (
          <>
            <Polyline positions={[[start.lat, start.lng], line[0]]} pathOptions={{ color: '#2563eb', weight: 3, opacity: 0.7, dashArray: '6 8', interactive: false }} />
            <Marker position={[start.lat, start.lng]} icon={START_ICON} zIndexOffset={900}>
              <Tooltip direction="bottom" className="route-map-label">נקודת התחלה</Tooltip>
            </Marker>
          </>
        )}
        {valid.map((s, i) => (
          <Marker
            key={s.id}
            position={[s.lat, s.lng]}
            icon={stopIcon(i + 1, s.image, s.id === activeId)}
            zIndexOffset={s.id === activeId ? 2000 : 1000 + i}
            title={`${i + 1}. ${s.name}`}
            eventHandlers={{ click: () => onSelect?.(s.id) }}
          >
            <Tooltip direction="bottom" permanent={showLabels} className="route-map-label">
              {s.time ? `${s.time} · ` : ''}{s.name}
            </Tooltip>
          </Marker>
        ))}
        <FitToRoute points={points} />
        <FlyToActive stop={active} />
      </MapContainer>
    </div>
  );
}

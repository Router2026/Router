/**
 * PlacePickerMap — pick places for a route on the map. Every place in the list is shown: unpicked
 * ones as small dots, picked ones as numbered photo pins (in pick order). Tapping toggles a place.
 * Frames all places when the list changes (e.g. a new region), not on every pick.
 */

import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { POI } from '../api';
import { BaseTileLayer } from '../utils/mapTiles';

const COLOR = '#0d9e6e';

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

const DOT = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#fff;border:3px solid ${COLOR};box-shadow:0 1px 4px rgba(0,0,0,.35);box-sizing:border-box"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  tooltipAnchor: [0, 10],
});

const DOT_FILTERED_OUT = L.divIcon({
  className: '',
  html: '<div style="width:10px;height:10px;border-radius:50%;background:#cbd5e1;border:2px solid #fff;box-sizing:border-box"></div>',
  iconSize: [10, 10],
  iconAnchor: [5, 5],
  tooltipAnchor: [0, 7],
});

function pickedIcon(n: number, image: string | null | undefined): L.DivIcon {
  const size = image ? 42 : 30;
  const badge = `<div style="position:absolute;top:-7px;right:-7px;min-width:20px;height:20px;padding:0 4px;border-radius:10px;background:${COLOR};color:#fff;border:2px solid #fff;font:800 11px Heebo,Arial;display:flex;align-items:center;justify-content:center;box-sizing:border-box">${n}</div>`;
  const body = image
    ? `<div style="width:${size}px;height:${size}px;border-radius:11px;overflow:hidden;border:3px solid ${COLOR};box-shadow:0 3px 10px rgba(0,0,0,.35);background:${COLOR};box-sizing:border-box"><img src="${escapeHtml(image)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block" onerror="this.style.display='none'"/></div>${badge}`
    : `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${COLOR};color:#fff;border:3px solid #fff;box-shadow:0 3px 10px rgba(13,158,110,.45);display:flex;align-items:center;justify-content:center;font:900 13px Heebo,Arial;box-sizing:border-box">${n}</div>`;
  return L.divIcon({ className: '', html: `<div style="position:relative">${body}</div>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2], tooltipAnchor: [0, size / 2 + 2] });
}

const START_ICON = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 5px rgba(37,99,235,.25)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function FitPlaces({ places, fallback }: Readonly<{ places: POI[]; fallback: { lat: number; lng: number; zoom: number } | null }>) {
  const map = useMap();
  // Re-frame only when the set of places changes (new region / first load), not on picks.
  const key = places.map(p => p.id).join(',');
  useEffect(() => {
    const pts = places.filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)).map(p => [p.latitude, p.longitude] as [number, number]);
    if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [24, 24], maxZoom: 13 });
    else if (pts.length === 1) map.setView(pts[0], 13);
    else if (fallback) map.setView([fallback.lat, fallback.lng], fallback.zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures the place set
  }, [key, map]);
  return null;
}

function FlyTo({ place }: Readonly<{ place: POI | null }>) {
  const map = useMap();
  useEffect(() => {
    if (place) map.flyTo([place.latitude, place.longitude], Math.max(map.getZoom(), 13), { duration: 0.5 });
  }, [place, map]);
  return null;
}

export default function PlacePickerMap({
  places, visibleIds, picked, start, focus, fallback, onToggle, height = 320,
}: Readonly<{
  places: POI[];
  /** Places matching the current search/filter; the rest are drawn faded. */
  visibleIds: Set<string>;
  picked: POI[];
  start: { lat: number; lng: number } | null;
  /** A place to fly to (e.g. tapped in the list). */
  focus: POI | null;
  fallback: { lat: number; lng: number; zoom: number } | null;
  onToggle: (poi: POI) => void;
  height?: number;
}>) {
  const pickedIndex = useMemo(() => new Map(picked.map((p, i) => [p.id, i])), [picked]);
  const center: [number, number] = fallback ? [fallback.lat, fallback.lng] : [31.8, 35.0];

  return (
    <div style={{ height, borderRadius: 20, overflow: 'hidden', position: 'relative', isolation: 'isolate', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
      <style>{`.picker-label{background:rgba(255,255,255,.96);border:none;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.18);padding:2px 7px;font:700 11px Heebo,Arial;color:#1a2e2a;direction:rtl;white-space:nowrap}.picker-label:before{display:none}`}</style>
      <MapContainer center={center} zoom={fallback?.zoom ?? 9} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <BaseTileLayer />
        {places.map(p => {
          const idx = pickedIndex.get(p.id);
          const isPicked = idx !== undefined;
          const dim = !isPicked && !visibleIds.has(p.id);
          return (
            <Marker
              key={p.id}
              position={[p.latitude, p.longitude]}
              icon={isPicked ? pickedIcon(idx + 1, p.main_image) : dim ? DOT_FILTERED_OUT : DOT}
              zIndexOffset={isPicked ? 1000 + idx : dim ? 0 : 500}
              title={p.name}
              eventHandlers={{ click: () => onToggle(p) }}
            >
              {/* Picked places keep their label; others show it on hover. */}
              <Tooltip direction="bottom" permanent={isPicked} className="picker-label">
                {isPicked ? p.name : `${p.name} · לחצו להוספה`}
              </Tooltip>
            </Marker>
          );
        })}
        {start && (
          <Marker position={[start.lat, start.lng]} icon={START_ICON} zIndexOffset={900}>
            <Tooltip direction="bottom" className="picker-label">נקודת התחלה</Tooltip>
          </Marker>
        )}
        <FitPlaces places={places} fallback={fallback} />
        <FlyTo place={focus} />
      </MapContainer>
      <div style={{ position: 'absolute', bottom: 8, right: 8, zIndex: 500, background: 'rgba(255,255,255,0.92)', borderRadius: 10, padding: '4px 9px', fontSize: 11, fontWeight: 700, color: '#475569', pointerEvents: 'none', direction: 'rtl' }}>
        לחצו על נקודה כדי להוסיף למסלול
      </div>
    </div>
  );
}

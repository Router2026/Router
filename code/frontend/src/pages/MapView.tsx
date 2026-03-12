import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';
import { api, type POI, type Region } from '../api';

/* ── Fix Leaflet default icon paths ──────────────────────────── */
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

/* ── Category colors & emojis ──────────────────────────────────── */
const CAT_COLOR: Record<string, string> = {
  'טבע': '#16a34a', 'מעיין': '#0284c7', 'מצפה': '#d97706',
  'נחל': '#0891b2', 'אתר היסטורי': '#7c3aed',
  'גיאולוגיה': '#b45309', 'חוף': '#0ea5e9',
};
const CAT_EMOJI: Record<string, string> = {
  'טבע': '🌿', 'מעיין': '💧', 'מצפה': '⛰️',
  'נחל': '🏞️', 'אתר היסטורי': '🏛️', 'גיאולוגיה': '🪨', 'חוף': '🏖️',
};

function makePOIIcon(poi: POI) {
  const color = CAT_COLOR[poi.category] || '#0d9e6e';
  const emoji = CAT_EMOJI[poi.category] || '📍';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="54" viewBox="0 0 44 54">
      <defs><filter id="ds"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.25)"/></filter></defs>
      <path d="M22 2C11.5 2 3 10.5 3 21c0 13 19 31 19 31S41 34 41 21C41 10.5 32.5 2 22 2Z"
        fill="${color}" filter="url(#ds)" stroke="white" stroke-width="2.5"/>
      <circle cx="22" cy="21" r="13" fill="white" opacity="0.95"/>
      <text x="22" y="26" font-size="14" text-anchor="middle" font-family="Arial">${emoji}</text>
    </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [44, 54], iconAnchor: [22, 54], popupAnchor: [0, -56] });
}

interface MarkersLayerProps { pois: POI[]; onMarkerClick: (poi: POI) => void; onMapClick: () => void; }
function MarkersLayer({ pois, onMarkerClick, onMapClick }: MarkersLayerProps) {
  const map = useMap();
  const markersRef = useRef<L.Marker[]>([]);
  const clearMarkers = useCallback(() => { markersRef.current.forEach(m => m.remove()); markersRef.current = []; }, []);

  useEffect(() => {
    clearMarkers();
    pois.forEach(poi => {
      const m = L.marker([poi.latitude, poi.longitude], { icon: makePOIIcon(poi) });
      m.on('click', (e) => { L.DomEvent.stopPropagation(e); onMarkerClick(poi); });
      m.addTo(map);
      markersRef.current.push(m);
    });
    return clearMarkers;
  }, [pois, map, clearMarkers, onMarkerClick]);

  useMapEvents({ click: onMapClick });
  return null;
}

function PanController({ target }: { target: { center: [number, number]; zoom: number } | null }) {
  const map = useMap();
  const prevTarget = useRef<string>('');
  useEffect(() => {
    const key = target ? `${target.center[0]},${target.center[1]},${target.zoom}` : 'reset';
    if (key === prevTarget.current) return;
    prevTarget.current = key;
    if (target) map.flyTo(target.center, target.zoom, { duration: 1.0 });
    else map.flyTo([31.5, 35.0], 8, { duration: 1.0 });
    setTimeout(() => map.invalidateSize(), 500);
  }, [target, map]);
  return null;
}

export default function MapView() {
  const navigate = useNavigate();
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [pois, setPois] = useState<POI[]>([]);
  const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load all regions on mount
  useEffect(() => {
    api.regions.list()
      .then(setRegions)
      .catch(err => setError(err.message));
  }, []);

  // When a region is selected, fetch its POIs
  useEffect(() => {
    if (!selectedRegion) { setPois([]); setSelectedPOI(null); return; }
    setLoading(true);
    api.locations.list({ region: selectedRegion.name })
      .then(data => { setPois(data); setSelectedPOI(null); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [selectedRegion]);

  const handleRegionClick = (region: Region) => {
    setSelectedPOI(null);
    setSelectedRegion(prev => prev?.id === region.id ? null : region);
  };

  const panTarget = selectedRegion
    ? { center: [selectedRegion.center_lat, selectedRegion.center_lng] as [number, number], zoom: selectedRegion.zoom }
    : null;

  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 72px)', overflow: 'hidden', direction: 'rtl' }}>

      {/* ── Top info bar ────────────────────────── */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1100, background: '#fff', padding: '12px 20px 10px', boxShadow: '0 2px 16px rgba(0,0,0,0.08)', direction: 'rtl', display: 'flex', alignItems: 'center', gap: 12 }}>
        {error && (
          <div style={{ width: '100%', textAlign: 'center', color: '#dc2626', fontSize: 13, fontWeight: 700 }}>
            שגיאה בטעינת הנתונים — {error}
          </div>
        )}
        {!error && selectedRegion ? (
          <>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: selectedRegion.color, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#1a2e2a' }}>{selectedRegion.name}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{loading ? 'טוען...' : `${pois.length} אתרים`}</div>
            </div>
            <button onClick={() => { setSelectedRegion(null); setPois([]); }} style={{ background: '#f1f5f9', border: 'none', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: '#64748b', fontFamily: 'Heebo, sans-serif', fontWeight: 600 }}>הצג הכל</button>
          </>
        ) : !error && (
          <div style={{ width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1a2e2a' }}>בחר אזור לצפייה באתרים</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>לחץ על אזור במפה</div>
          </div>
        )}
      </div>

      <MapContainer center={[31.5, 35.0]} zoom={8} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }} zoomControl={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
        <PanController target={panTarget} />

        {/* Draw region circles */}
        {!selectedRegion && regions.map(region => (
          <Circle
            key={region.id}
            center={[region.center_lat, region.center_lng]}
            radius={region.radius_meters}
            pathOptions={{ color: region.color, fillColor: region.color, fillOpacity: 0.15, weight: 1.5 }}
            eventHandlers={{ click: () => handleRegionClick(region) }}
          />
        ))}

        <MarkersLayer pois={pois} onMarkerClick={setSelectedPOI} onMapClick={() => setSelectedPOI(null)} />
      </MapContainer>

      {/* ── POI Popup card ────────────────────── */}
      {selectedPOI && (
        <div style={{ position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 1200, width: 290, background: '#fff', borderRadius: 20, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', overflow: 'hidden', direction: 'rtl' }}>
          <button onClick={() => setSelectedPOI(null)} style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
          {selectedPOI.main_image && (
            <div style={{ height: 140, backgroundImage: `url(${selectedPOI.main_image})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
          )}
          <div style={{ padding: '14px 16px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#f59e0b' }}>{selectedPOI.average_rating}</span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#1a2e2a' }}>{selectedPOI.name}</div>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'right', marginBottom: 14 }}>{selectedPOI.category}</div>
            <button onClick={() => navigate(`/POIDetail?id=${selectedPOI.id}`)} style={{ width: '100%', padding: '11px', border: 'none', borderRadius: 13, background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              פרטים נוספים
            </button>
          </div>
        </div>
      )}

      {/* ── Bottom region filter bar ───────────── */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1100, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)', padding: '10px 16px 12px', boxShadow: '0 -4px 20px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none', alignItems: 'center' }}>
          {regions.map(region => {
            const active = selectedRegion?.id === region.id;
            return (
              <button key={region.id} onClick={() => handleRegionClick(region)} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 20, border: `2px solid ${active ? region.color : '#e2e8f0'}`, background: active ? region.color : '#fff', color: active ? '#fff' : '#64748b', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', whiteSpace: 'nowrap', transition: 'all 0.15s ease' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: active ? 'rgba(255,255,255,0.75)' : region.color, flexShrink: 0 }} />
                {region.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

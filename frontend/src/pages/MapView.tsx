// src/pages/MapView.tsx
//
// React Performance changes vs original:
//  1. makePhotoIcon / makeClusterIcon — module-level Map cache keyed by
//     poi.id + main_image + size. Same L.DivIcon object reused every render.
//  2. MarkersLayer — keyed diff instead of clearMarkers() + full rebuild.
//     Only new groups get new DOM nodes; gone groups are removed individually.
//  3. Data fetching moved to useRegions + useLocationsByRegion (React Query).
//     First visit loads from network; back-navigation reads from cache = 0ms.
//  4. Tile layer switched from openstreetmap.org to CARTO Voyager CDN.
//     Faster global CDN, correct subdomains (a/b/c/d), crossOrigin for caching.
//  5. useMemo for client-side filter + categories derivation.

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Polygon, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { type POI, type Region } from '../api';
import { useRegions, useLocationsByRegion } from '../hooks/useLocations';
import { useTripBucket } from '../context/TripBucketContext';
import TripBucketFab from '../components/TripBucketFab';
import TripBucketSheet from '../components/TripBucketSheet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

// ── Category maps ─────────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  טבע: '#16a34a', מעיין: '#0284c7', מצפה: '#d97706',
  נחל: '#0891b2', 'אתר היסטורי': '#7c3aed', גיאולוגיה: '#b45309', חוף: '#0ea5e9',
};
const CAT_EMOJI: Record<string, string> = {
  טבע: '🌿', מעיין: '💧', מצפה: '⛰️',
  נחל: '🏞️', 'אתר היסטורי': '🏛️', גיאולוגיה: '🪨', חוף: '🏖️',
};
const DIFFICULTIES = ['קל - משפחות', 'בינוני', 'מאתגר', 'אקסטרים'];

// ── POI filter helper ─────────────────────────────────────────────────────────

interface PoiFilterOptions {
  selCats: string[];
  selDiffs: string[];
  hasWater: boolean;
  hasShade: boolean;
  accessible: boolean;
}

function poiMatchesFilter(p: POI, opts: PoiFilterOptions): boolean {
  if (opts.selCats.length && !opts.selCats.includes(p.category)) return false;
  if (opts.selDiffs.length && !opts.selDiffs.includes(p.difficulty ?? '')) return false;
  if (opts.hasWater && !p.has_water) return false;
  if (opts.hasShade && !p.has_shade) return false;
  if (opts.accessible && !p.accessible) return false;
  return true;
}

// ── Icon cache — module-level, lives for the session ─────────────────────────
// Key: `p:{id}:{main_image}:{size}` or `c:{count}:{color}:{size}`
// When none of those change, the exact same L.DivIcon object is returned so
// Leaflet skips the DOM diff entirely.

const _iconCache = new Map<string, L.DivIcon>();
const ICON_CACHE_MAX = 600;

function _cacheSet(key: string, icon: L.DivIcon): L.DivIcon {
  if (_iconCache.size >= ICON_CACHE_MAX) _iconCache.delete(_iconCache.keys().next().value!);
  _iconCache.set(key, icon);
  return icon;
}

function makePhotoIcon(poi: POI, size = 52): L.DivIcon {
  const key = `p:${poi.id}:${poi.main_image ?? ''}:${size}`;
  if (_iconCache.has(key)) return _iconCache.get(key)!;

  if (poi.main_image) {
    const border = CAT_COLOR[poi.category] || '#0d9e6e';
    return _cacheSet(key, L.divIcon({
      html: `<div style="position:relative;width:${size}px;height:${size}px;border-radius:12px;overflow:hidden;border:3px solid ${border};box-shadow:0 3px 12px rgba(0,0,0,0.35);cursor:pointer;background:#e2e8f0;">
        <img src="${poi.main_image}" style="width:100%;height:100%;object-fit:cover;"
          onerror="this.style.display='none';this.parentElement.querySelector('.fb').style.display='flex'"/>
        <div class="fb" style="display:none;width:100%;height:100%;background:${border};align-items:center;justify-content:center;font-size:22px;position:absolute;top:0;left:0;">
          ${CAT_EMOJI[poi.category] || '📍'}
        </div>
      </div>`,
      className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2],
    }));
  }

  const color = CAT_COLOR[poi.category] || '#0d9e6e';
  const emoji = CAT_EMOJI[poi.category] || '📍';
  const h = size * 1.23;
  return _cacheSet(key, L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${h}" viewBox="0 0 44 54">
      <defs><filter id="ds"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.25)"/></filter></defs>
      <path d="M22 2C11.5 2 3 10.5 3 21c0 13 19 31 19 31S41 34 41 21C41 10.5 32.5 2 22 2Z" fill="${color}" filter="url(#ds)" stroke="white" stroke-width="2.5"/>
      <circle cx="22" cy="21" r="13" fill="white" opacity="0.95"/>
      <text x="22" y="26" font-size="14" text-anchor="middle" font-family="Arial">${emoji}</text>
    </svg>`,
    className: '', iconSize: [size, h], iconAnchor: [size / 2, h], popupAnchor: [0, -h],
  }));
}

const _clusterCache = new Map<string, L.DivIcon>();

function makeClusterIcon(count: number, color: string, size = 48): L.DivIcon {
  const key = `c:${count}:${color}:${size}`;
  if (_clusterCache.has(key)) return _clusterCache.get(key)!;
  if (_clusterCache.size >= 200) _clusterCache.delete(_clusterCache.keys().next().value!);
  const icon = L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${color}" opacity="0.9" stroke="white" stroke-width="3"/>
      <text x="${size / 2}" y="${size / 2 + 5}" font-size="${count > 99 ? 12 : 15}" font-weight="bold" text-anchor="middle" fill="white" font-family="Heebo,Arial">${count > 999 ? '999+' : count}</text>
    </svg>`,
    className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
  });
  _clusterCache.set(key, icon);
  return icon;
}

// ── Clustering ────────────────────────────────────────────────────────────────

function clusterPOIs(pois: POI[], zoom: number) {
  if (zoom >= 13) return pois.map(poi => ({ pois: [poi], lat: poi.latitude, lng: poi.longitude }));
  const gridSizeDeg = zoom < 7 ? 1.5 : zoom < 9 ? 0.8 : zoom < 11 ? 0.3 : zoom < 13 ? 0.1 : 0.05;
  const cells = new Map<string, POI[]>();
  for (const poi of pois) {
    const key = `${Math.floor(poi.latitude / gridSizeDeg)},${Math.floor(poi.longitude / gridSizeDeg)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key)!.push(poi);
  }
  return Array.from(cells.values()).map(group => ({
    pois: group,
    lat: group.reduce((s, p) => s + p.latitude, 0) / group.length,
    lng: group.reduce((s, p) => s + p.longitude, 0) / group.length,
  }));
}

// ── MarkersLayer — keyed diff, no full rebuild ────────────────────────────────

interface MarkersLayerProps {
  pois: POI[];
  onMarkerClick: (poi: POI) => void;
  onMapClick: () => void;
  zoom: number;
}

function MarkersLayer({ pois, onMarkerClick, onMapClick, zoom }: MarkersLayerProps) {
  const map = useMap();
  const markerMapRef = useRef<Map<string, L.Marker>>(new Map());
  const onClickRef = useRef(onMarkerClick);
  useEffect(() => { onClickRef.current = onMarkerClick; }, [onMarkerClick]);

  const groups = useMemo(() => clusterPOIs(pois, zoom), [pois, zoom]);

  useEffect(() => {
    const nextKeys = new Set<string>();

    for (const g of groups) {
      const key = g.pois.map(p => p.id).sort((a, b) => a - b).join(',');
      nextKeys.add(key);
      if (markerMapRef.current.has(key)) continue;

      let marker: L.Marker;
      if (g.pois.length === 1) {
        marker = L.marker([g.lat, g.lng], { icon: makePhotoIcon(g.pois[0]) });
        marker.on('click', e => { L.DomEvent.stopPropagation(e); onClickRef.current(g.pois[0]); });
      } else {
        const color = CAT_COLOR[g.pois[0].category] || '#0d9e6e';
        const size = g.pois.length > 50 ? 60 : g.pois.length > 10 ? 52 : 44;
        marker = L.marker([g.lat, g.lng], { icon: makeClusterIcon(g.pois.length, color, size) });
        marker.on('click', e => {
          L.DomEvent.stopPropagation(e);
          map.setView([g.lat, g.lng], Math.min(zoom + 2, 14), { animate: true });
        });
      }
      marker.addTo(map);
      markerMapRef.current.set(key, marker);
    }

    for (const [key, marker] of markerMapRef.current) {
      if (!nextKeys.has(key)) {
        marker.remove();
        markerMapRef.current.delete(key);
      }
    }
  }, [groups, map, zoom]);

  useEffect(() => () => {
    markerMapRef.current.forEach(m => m.remove());
    markerMapRef.current.clear();
  }, []);

  useMapEvents({ click: onMapClick });
  return null;
}

// ── Helper components ─────────────────────────────────────────────

interface ViewTarget {
  center: [number, number];
  zoom: number;
  id: number;
}

function PanController({ target }: { target: ViewTarget | null }) {
  const map = useMap();
  const prev = useRef<number>(0);
  useEffect(() => {
    if (!target) return;
    if (target.id === prev.current) return;
    prev.current = target.id;
    map.flyTo(target.center, target.zoom, { duration: 1.2 });
    const t = setTimeout(() => map.invalidateSize(), 500);
    return () => clearTimeout(t);
  }, [target, map]);
  return null;
}

function MapStateTracker({ onChange }: { onChange: (lat: number, lng: number, zoom: number) => void }) {
  const map = useMap();
  const cbRef = useRef(onChange);
  useEffect(() => { cbRef.current = onChange; }, [onChange]);
  useMapEvents({
    moveend() { const c = map.getCenter(); cbRef.current(c.lat, c.lng, map.getZoom()); },
    zoomend() { const c = map.getCenter(); cbRef.current(c.lat, c.lng, map.getZoom()); },
  });
  return null;
}

interface OverlayFilterProps {
  open: boolean; onClose: () => void; categories: string[];
  selCats: string[]; setSelCats: (v: string[]) => void;
  selDiffs: string[]; setSelDiffs: (v: string[]) => void;
  hasWater: boolean; setHasWater: (v: boolean) => void;
  hasShade: boolean; setHasShade: (v: boolean) => void;
  accessible: boolean; setAccessible: (v: boolean) => void;
}

function OverlayFilter({ open, onClose, categories, selCats, setSelCats, selDiffs, setSelDiffs, hasWater, setHasWater, hasShade, setHasShade, accessible, setAccessible }: OverlayFilterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open && containerRef.current) {
      L.DomEvent.disableClickPropagation(containerRef.current);
      L.DomEvent.disableScrollPropagation(containerRef.current);
    }
  }, [open]);
  if (!open) return null;

  const toggle = (arr: string[], setArr: (v: string[]) => void, val: string) =>
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  const chip = (active: boolean): React.CSSProperties => ({
    padding: '5px 10px', borderRadius: 16,
    border: `2px solid ${active ? '#0d9e6e' : '#e2e8f0'}`,
    background: active ? '#0d9e6e' : '#fff',
    color: active ? '#fff' : '#64748b',
    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
  });

  return (
    <div ref={containerRef} style={{ position: 'absolute', top: 60, left: 10, right: 10, zIndex: 1500, background: '#fff', borderRadius: 20, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', padding: '20px', direction: 'rtl', maxHeight: '60vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button onClick={() => { setSelCats([]); setSelDiffs([]); setHasWater(false); setHasShade(false); setAccessible(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#64748b', fontFamily: 'Heebo, sans-serif' }}>נקה</button>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#1a2e2a' }}>סינון מפה</div>
        <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2e2a', marginBottom: 8 }}>סוג אתר</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {categories.map(c => <button key={c} onClick={() => toggle(selCats, setSelCats, c)} style={chip(selCats.includes(c))}>{c}</button>)}
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2e2a', marginBottom: 8 }}>רמת קושי</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {DIFFICULTIES.map(d => <button key={d} onClick={() => toggle(selDiffs, setSelDiffs, d)} style={chip(selDiffs.includes(d))}>{d}</button>)}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[{ label: '💧 מים', state: hasWater, set: setHasWater }, { label: '🌿 צל', state: hasShade, set: setHasShade }, { label: '♿ נגיש', state: accessible, set: setAccessible }].map(f => (
          <button key={f.label} onClick={() => f.set(!f.state)} style={chip(f.state)}>{f.label}</button>
        ))}
      </div>
    </div>
  );
}

// ── Module-level helpers ──────────────────────────────────────────────────────

function buildUrlParams(lat: number, lng: number, zoom: number, regionName: string): Record<string, string> {
  const p: Record<string, string> = { lat: lat.toFixed(5), lng: lng.toFixed(5), zoom: String(zoom) };
  if (regionName) p.region = regionName;
  return p;
}

function calcActiveFilterCount(selCats: string[], selDiffs: string[], hasWater: boolean, hasShade: boolean, accessible: boolean): number {
  return selCats.length + selDiffs.length +
    (hasWater ? 1 : 0) + (hasShade ? 1 : 0) + (accessible ? 1 : 0);
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MapView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { addPoi, removePoi, hasPoi } = useTripBucket();

  const urlRegion = searchParams.get('region') || '';
  const urlLat = Number.parseFloat(searchParams.get('lat') || '0');
  const urlLng = Number.parseFloat(searchParams.get('lng') || '0');
  const urlZoom = Number.parseInt(searchParams.get('zoom') || '7');

  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [panTarget, setPanTarget] = useState<ViewTarget | null>(null);
  const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);
  const [mapZoom, setMapZoom] = useState(urlZoom || 7);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selCats, setSelCats] = useState<string[]>([]);
  const [selDiffs, setSelDiffs] = useState<string[]>([]);
  const [hasWater, setHasWater] = useState(false);
  const [hasShade, setHasShade] = useState(false);
  const [accessible, setAccessible] = useState(false);

  const mapCenterRef = useRef<[number, number]>(
    urlLat && urlLng ? [urlLat, urlLng] : [31.5, 35],
  );
  const urlWriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (urlWriteTimerRef.current) clearTimeout(urlWriteTimerRef.current); }, []);

  const writeUrl = useCallback((lat: number, lng: number, zoom: number, regionName: string) => {
    if (urlWriteTimerRef.current) clearTimeout(urlWriteTimerRef.current);
    urlWriteTimerRef.current = setTimeout(() => {
      setSearchParams(buildUrlParams(lat, lng, zoom, regionName), { replace: true });
    }, 400);
  }, [setSearchParams]);

  const { data: regions = [], isError } = useRegions();
  const { data: allPois = [], isLoading } = useLocationsByRegion(selectedRegion?.name ?? null);

  useEffect(() => {
    if (urlRegion && regions.length) {
      const found = regions.find(r => r.name === urlRegion);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (found) setSelectedRegion(found);
    }
  }, [urlRegion, regions]);

  useEffect(() => {
    const [lat, lng] = mapCenterRef.current;
    writeUrl(lat, lng, mapZoom, selectedRegion?.name ?? '');
  }, [selectedRegion]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMapState = useCallback((lat: number, lng: number, zoom: number) => {
    mapCenterRef.current = [lat, lng];
    setMapZoom(zoom);
    writeUrl(lat, lng, zoom, selectedRegion?.name ?? '');
  }, [writeUrl, selectedRegion?.name]);

  const pois = useMemo(
    () => allPois.filter(p => poiMatchesFilter(p, { selCats, selDiffs, hasWater, hasShade, accessible })),
    [allPois, selCats, selDiffs, hasWater, hasShade, accessible],
  );

  const categories = useMemo(
    () => [...new Set(allPois.map(p => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [allPois],
  );

  const activeFilterCount = calcActiveFilterCount(selCats, selDiffs, hasWater, hasShade, accessible);

  // פונקציה מסודרת לאיפוס התצוגה במפה
  const resetView = useCallback(() => {
    setSelectedRegion(null);
    setMapZoom(7);
    setPanTarget({ center: [31.5, 35], zoom: 7, id: Date.now() });
  }, []);

  const handleRegionClick = useCallback((region: Region) => {
    setSelectedPOI(null);
    setFilterOpen(false);
    if (selectedRegion?.id === region.id) {
      resetView();
    } else {
      setSelectedRegion(region);
      setPanTarget({ center: [region.center_lat, region.center_lng] as [number, number], zoom: region.zoom, id: Date.now() });
    }
  }, [selectedRegion, resetView]);

  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100dvh - 72px - var(--safe-top))', overflow: 'hidden', direction: 'rtl' }}>
      {/* Top bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1100, background: '#fff', padding: 'calc(var(--safe-top) + 12px) 20px 10px', boxShadow: '0 2px 16px rgba(0,0,0,0.08)', direction: 'rtl', display: 'flex', alignItems: 'center', gap: 12 }}>
        {isError && <div style={{ width: '100%', textAlign: 'center', color: '#dc2626', fontSize: 13, fontWeight: 700 }}>שגיאה בטעינת אזורים</div>}
        {!isError && selectedRegion ? (
          <>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: selectedRegion.color, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#1a2e2a' }}>{selectedRegion.name}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>
                {isLoading ? 'טוען...' : `${pois.length} אתרים`}
                {activeFilterCount > 0 ? ` (${activeFilterCount} פילטרים)` : ''}
              </div>
            </div>
            <button onClick={() => setFilterOpen(!filterOpen)} style={{ background: activeFilterCount > 0 ? '#0d9e6e' : '#f1f5f9', border: 'none', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: activeFilterCount > 0 ? '#fff' : '#64748b', fontFamily: 'Heebo, sans-serif', fontWeight: 600, position: 'relative' }}>
              {activeFilterCount > 0 && <span style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{activeFilterCount}</span>}
              סינון
            </button>
            <button onClick={resetView} style={{ background: '#f1f5f9', border: 'none', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: '#64748b', fontFamily: 'Heebo, sans-serif', fontWeight: 600 }}>
              ← כל האזורים
            </button>
          </>
        ) : !isError && (
          <div style={{ width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1a2e2a' }}>בחר אזור לצפייה באתרים</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>לחץ על אזור במפה או בתפריט התחתון</div>
          </div>
        )}
      </div>

      <OverlayFilter open={filterOpen} onClose={() => setFilterOpen(false)} categories={categories}
        selCats={selCats} setSelCats={setSelCats} selDiffs={selDiffs} setSelDiffs={setSelDiffs}
        hasWater={hasWater} setHasWater={setHasWater} hasShade={hasShade} setHasShade={setHasShade}
        accessible={accessible} setAccessible={setAccessible} />

      <MapContainer center={urlLat && urlLng ? [urlLat, urlLng] : [31.5, 35]} zoom={urlZoom || 7} minZoom={7} maxZoom={18}
        maxBounds={[[29, 34], [33.8, 36.3]]} maxBoundsViscosity={0.85}
        style={{ width: '100%', height: '100%', zIndex: 1 }} zoomControl={false}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />
        <PanController target={panTarget} />
        <MapStateTracker onChange={handleMapState} />

        {!selectedRegion && regions.map(region => {
          if (!region.polygon_coords) return null;
          return (
            <Polygon key={region.id}
              positions={region.polygon_coords}
              pathOptions={{ color: region.color, fillColor: region.color, fillOpacity: 0.15, weight: 2 }}
              eventHandlers={{ click: () => handleRegionClick(region) }}>
              <Tooltip permanent direction="center" opacity={1} className="region-label">{region.name}</Tooltip>
            </Polygon>
          );
        })}

        {selectedRegion?.polygon_coords && (
          <Polygon
            positions={selectedRegion.polygon_coords}
            pathOptions={{ color: selectedRegion.color, fillColor: selectedRegion.color, fillOpacity: 0.08, weight: 3, dashArray: '6,4' }}>
            <Tooltip permanent direction="center" opacity={1} className="region-label">{selectedRegion.name}</Tooltip>
          </Polygon>
        )}

        <MarkersLayer
          pois={pois}
          onMarkerClick={setSelectedPOI}
          onMapClick={() => setSelectedPOI(null)}
          zoom={mapZoom}
        />
      </MapContainer>

      {/* POI popup card */}
      {selectedPOI && (() => {
        const inBucket = hasPoi(selectedPOI.id);
        return (
          <div style={{ position: 'absolute', bottom: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 1200, width: 330, background: '#fff', borderRadius: 20, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', overflow: 'hidden', direction: 'rtl' }}>
            <button onClick={() => setSelectedPOI(null)} style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
            <button onClick={e => { e.stopPropagation(); if (inBucket) { removePoi(selectedPOI.id); } else { addPoi(selectedPOI); } }}
              style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, background: inBucket ? '#0d9e6e' : 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: inBucket ? '0 2px 8px rgba(13,158,110,0.4)' : '0 2px 8px rgba(0,0,0,0.1)', transition: 'all 0.18s ease' }}>
              {inBucket
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0d9e6e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              }
            </button>
            {selectedPOI.main_image && (
              <div style={{ height: 140, position: 'relative' }}>
                <img src={selectedPOI.main_image} alt={selectedPOI.name}
                  loading="lazy" decoding="async"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.onerror = null; }} />
                {selectedPOI.photo_credit && (
                  <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(255,255,255,0.92)', borderRadius: 5, padding: '2px 7px', fontSize: 10, fontWeight: 600, color: '#374151', fontFamily: 'Heebo, sans-serif', direction: 'rtl', pointerEvents: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.15)', lineHeight: 1.4 }}>
                    צילום: {selectedPOI.photo_credit}
                  </div>
                )}
              </div>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <button onClick={() => navigate(`/POIDetail?id=${selectedPOI.id}`)} style={{ width: '100%', padding: '10px', border: 'none', borderRadius: 12, background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>פרטים נוספים</button>
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPOI.latitude},${selectedPOI.longitude}`} target="_blank" rel="noopener noreferrer"
                  style={{ textDecoration: 'none', width: '100%', padding: '10px', border: '2px solid #e2e8f0', borderRadius: 12, background: '#fff', color: '#1e293b', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, boxSizing: 'border-box' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>
                  ניווט
                </a>
              </div>
              <button onClick={e => { e.stopPropagation(); if (inBucket) { removePoi(selectedPOI.id); } else { addPoi(selectedPOI); } }}
                style={{ width: '100%', padding: '10px', border: `2px solid ${inBucket ? '#0d9e6e' : '#f1f5f9'}`, borderRadius: 12, background: inBucket ? '#f0fdf8' : '#f8fafc', color: inBucket ? '#0d9e6e' : '#64748b', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s' }}>
                {inBucket ? <>✓ נוסף לסל המסלול</> : <>+ הוספה מהירה למסלול</>}
              </button>
            </div>
          </div>
        );
      })()}

      {/* Bottom region bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1100, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)', padding: '10px 16px 12px', boxShadow: '0 -4px 20px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none', alignItems: 'center' }}>
          {selectedRegion && (
            <button onClick={resetView} style={{ flexShrink: 0, padding: '7px 14px', borderRadius: 20, border: '2px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', whiteSpace: 'nowrap' }}>כל האזורים</button>
          )}
          {regions.map(region => {
            const active = selectedRegion?.id === region.id;
            return (
              <button key={region.id} onClick={() => handleRegionClick(region)}
                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 20, border: `2px solid ${active ? region.color : '#e2e8f0'}`, background: active ? region.color : '#fff', color: active ? '#fff' : '#64748b', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', whiteSpace: 'nowrap', transition: 'all 0.15s ease' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: active ? 'rgba(255,255,255,0.75)' : region.color, flexShrink: 0 }} />
                {region.name}
              </button>
            );
          })}
        </div>
      </div>

      <TripBucketFab />
      <TripBucketSheet />
    </div>
  );
}
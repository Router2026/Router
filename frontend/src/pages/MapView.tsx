import { useState, useEffect, useRef, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Polygon,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, type POI, type Region } from "../api";

// Fix for default Leaflet icons in Webpack/React
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const CAT_COLOR: Record<string, string> = {
  טבע: "#16a34a",
  מעיין: "#0284c7",
  מצפה: "#d97706",
  נחל: "#0891b2",
  "אתר היסטורי": "#7c3aed",
  גיאולוגיה: "#b45309",
  חוף: "#0ea5e9",
};

const CAT_EMOJI: Record<string, string> = {
  טבע: "🌿",
  מעיין: "💧",
  מצפה: "⛰️",
  נחל: "🏞️",
  "אתר היסטורי": "🏛️",
  גיאולוגיה: "🪨",
  חוף: "🏖️",
};

const DIFFICULTIES = ["קל - משפחות", "בינוני", "מאתגר", "אקסטרים"];

function makePOIIcon(poi: POI, size = 44) {
  const color = CAT_COLOR[poi.category] || "#0d9e6e";
  const emoji = CAT_EMOJI[poi.category] || "📍";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size * 1.23}" viewBox="0 0 44 54">
    <defs><filter id="ds"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.25)"/></filter></defs>
    <path d="M22 2C11.5 2 3 10.5 3 21c0 13 19 31 19 31S41 34 41 21C41 10.5 32.5 2 22 2Z" fill="${color}" filter="url(#ds)" stroke="white" stroke-width="2.5"/>
    <circle cx="22" cy="21" r="13" fill="white" opacity="0.95"/>
    <text x="22" y="26" font-size="14" text-anchor="middle" font-family="Arial">${emoji}</text>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [size, size * 1.23],
    iconAnchor: [size / 2, size * 1.23],
    popupAnchor: [0, -size * 1.23],
  });
}

function makeClusterIcon(count: number, color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48">
    <circle cx="24" cy="24" r="20" fill="${color}" opacity="0.85" stroke="white" stroke-width="3"/>
    <text x="24" y="29" font-size="14" font-weight="bold" text-anchor="middle" fill="white" font-family="Heebo,Arial">${count}</text>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
}

function clusterPOIs(pois: POI[], gridSizeDeg: number) {
  const cells = new Map<string, POI[]>();
  for (const poi of pois) {
    const cellLat = Math.floor(poi.latitude / gridSizeDeg);
    const cellLng = Math.floor(poi.longitude / gridSizeDeg);
    const key = `${cellLat},${cellLng}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key)!.push(poi);
  }
  return Array.from(cells.values()).map((group) => ({
    pois: group,
    lat: group.reduce((s, p) => s + p.latitude, 0) / group.length,
    lng: group.reduce((s, p) => s + p.longitude, 0) / group.length,
  }));
}

interface MarkersLayerProps {
  pois: POI[];
  onMarkerClick: (poi: POI) => void;
  onMapClick: () => void;
  zoom: number;
}

function MarkersLayer({
  pois,
  onMarkerClick,
  onMapClick,
  zoom,
}: MarkersLayerProps) {
  const map = useMap();
  const markersRef = useRef<L.Layer[]>([]);

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
  }, []);

  useEffect(() => {
    clearMarkers();
    if (!pois.length) return;

    const shouldCluster = zoom < 10 && pois.length > 20;
    const gridSize = zoom < 8 ? 1.2 : zoom < 10 ? 0.5 : zoom < 12 ? 0.2 : 0.05;

    if (shouldCluster) {
      const groups = clusterPOIs(pois, gridSize);
      groups.forEach((g) => {
        if (g.pois.length === 1) {
          const m = L.marker([g.lat, g.lng], { icon: makePOIIcon(g.pois[0]) });
          m.on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            onMarkerClick(g.pois[0]);
          });
          m.addTo(map);
          markersRef.current.push(m);
        } else {
          const color = CAT_COLOR[g.pois[0].category] || "#0d9e6e";
          const m = L.marker([g.lat, g.lng], {
            icon: makeClusterIcon(g.pois.length, color),
          });
          m.on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            map.setView([g.lat, g.lng], Math.min(zoom + 2, 14), {
              animate: true,
            });
          });
          m.addTo(map);
          markersRef.current.push(m);
        }
      });
    } else {
      pois.forEach((poi) => {
        const m = L.marker([poi.latitude, poi.longitude], {
          icon: makePOIIcon(poi),
        });
        m.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          onMarkerClick(poi);
        });
        m.addTo(map);
        markersRef.current.push(m);
      });
    }

    return clearMarkers;
  }, [pois, map, zoom, onMarkerClick, clearMarkers]);

  useMapEvents({ click: onMapClick });
  return null;
}

function PanController({
  target,
}: {
  target: { center: [number, number]; zoom: number } | null;
}) {
  const map = useMap();
  const prev = useRef("");

  useEffect(() => {
    const key = target
      ? `${target.center[0]},${target.center[1]},${target.zoom}`
      : "reset";
    if (key === prev.current) return;
    prev.current = key;

    if (target) {
      map.flyTo(target.center, target.zoom, { duration: 1.2 });
    } else {
      map.flyTo([31.5, 35.0], 7, { duration: 1.0 });
    }

    const timer = setTimeout(() => map.invalidateSize(), 500);
    return () => clearTimeout(timer);
  }, [target, map]);

  return null;
}

function ZoomTracker({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMap();
  useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  return null;
}

interface OverlayFilterProps {
  open: boolean;
  onClose: () => void;
  categories: string[];
  selCats: string[];
  setSelCats: (v: string[]) => void;
  selDiffs: string[];
  setSelDiffs: (v: string[]) => void;
  hasWater: boolean;
  setHasWater: (v: boolean) => void;
  hasShade: boolean;
  setHasShade: (v: boolean) => void;
  accessible: boolean;
  setAccessible: (v: boolean) => void;
}

function OverlayFilter({
  open,
  onClose,
  categories,
  selCats,
  setSelCats,
  selDiffs,
  setSelDiffs,
  hasWater,
  setHasWater,
  hasShade,
  setHasShade,
  accessible,
  setAccessible,
}: OverlayFilterProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Prevent map interaction when clicking on the filter panel
  useEffect(() => {
    if (open && containerRef.current) {
      L.DomEvent.disableClickPropagation(containerRef.current);
      L.DomEvent.disableScrollPropagation(containerRef.current);
    }
  }, [open]);

  if (!open) return null;

  const toggle = (arr: string[], setArr: (v: string[]) => void, val: string) =>
    setArr(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        top: 60,
        left: 10,
        right: 10,
        zIndex: 1500,
        background: "#fff",
        borderRadius: 20,
        boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
        padding: "20px",
        direction: "rtl",
        maxHeight: "60vh",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <button
          onClick={() => {
            setSelCats([]);
            setSelDiffs([]);
            setHasWater(false);
            setHasShade(false);
            setAccessible(false);
          }}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 12,
            color: "#64748b",
            fontFamily: "Heebo, sans-serif",
          }}
        >
          נקה
        </button>
        <div style={{ fontSize: 16, fontWeight: 900, color: "#1a2e2a" }}>
          סינון מפה
        </div>
        <button
          onClick={onClose}
          style={{
            background: "#f1f5f9",
            border: "none",
            borderRadius: "50%",
            width: 28,
            height: 28,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#64748b"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#1a2e2a",
            marginBottom: 8,
          }}
        >
          סוג אתר
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {categories.map((c) => {
            const a = selCats.includes(c);
            return (
              <button
                key={c}
                onClick={() => toggle(selCats, setSelCats, c)}
                style={{
                  padding: "5px 10px",
                  borderRadius: 16,
                  border: `2px solid ${a ? "#0d9e6e" : "#e2e8f0"}`,
                  background: a ? "#0d9e6e" : "#fff",
                  color: a ? "#fff" : "#64748b",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "Heebo, sans-serif",
                }}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#1a2e2a",
            marginBottom: 8,
          }}
        >
          רמת קושי
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {DIFFICULTIES.map((d) => {
            const a = selDiffs.includes(d);
            return (
              <button
                key={d}
                onClick={() => toggle(selDiffs, setSelDiffs, d)}
                style={{
                  padding: "5px 10px",
                  borderRadius: 16,
                  border: `2px solid ${a ? "#0d9e6e" : "#e2e8f0"}`,
                  background: a ? "#0d9e6e" : "#fff",
                  color: a ? "#fff" : "#64748b",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "Heebo, sans-serif",
                }}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[
          { label: "💧 מים", state: hasWater, set: setHasWater },
          { label: "🌿 צל", state: hasShade, set: setHasShade },
          { label: "♿ נגיש", state: accessible, set: setAccessible },
        ].map((f) => (
          <button
            key={f.label}
            onClick={() => f.set(!f.state)}
            style={{
              padding: "6px 12px",
              borderRadius: 16,
              border: `2px solid ${f.state ? "#0d9e6e" : "#e2e8f0"}`,
              background: f.state ? "#0d9e6e" : "#fff",
              color: f.state ? "#fff" : "#64748b",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "Heebo, sans-serif",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function MapView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const urlRegion = searchParams.get("region") || "";
  const urlLat = parseFloat(searchParams.get("lat") || "0");
  const urlLng = parseFloat(searchParams.get("lng") || "0");
  const urlZoom = parseInt(searchParams.get("zoom") || "11");

  const [regions, setRegions] = useState<Region[]>([]);
  const [allPois, setAllPois] = useState<POI[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [pois, setPois] = useState<POI[]>([]);
  const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState(8);
  const [filterOpen, setFilterOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  const [selCats, setSelCats] = useState<string[]>([]);
  const [selDiffs, setSelDiffs] = useState<string[]>([]);
  const [hasWater, setHasWater] = useState(false);
  const [hasShade, setHasShade] = useState(false);
  const [accessible, setAccessible] = useState(false);

  useEffect(() => {
    api.regions
      .list()
      .then((r) => {
        setRegions(r);
        if (urlRegion) {
          const found = r.find((reg) => reg.name === urlRegion);
          if (found) setSelectedRegion(found);
        }
      })
      .catch((err) => setError(err.message));
  }, [urlRegion]);

  useEffect(() => {
    if (!selectedRegion) {
      setPois([]);
      setAllPois([]);
      setSelectedPOI(null);
      return;
    }
    setLoading(true);
    api.locations
      .list({ region: selectedRegion.name })
      .then((data) => {
        setAllPois(data);
        setCategories(
          [...new Set(data.map((p) => p.category).filter(Boolean))].sort(),
        );
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [selectedRegion]);

  useEffect(() => {
    const filtered = allPois.filter((p) => {
      if (selCats.length && !selCats.includes(p.category)) return false;
      if (selDiffs.length && !selDiffs.includes(p.difficulty)) return false;
      if (hasWater && !p.has_water) return false;
      if (hasShade && !p.has_shade) return false;
      if (accessible && !p.accessible) return false;
      return true;
    });
    setPois(filtered);
  }, [allPois, selCats, selDiffs, hasWater, hasShade, accessible]);

  const activeFilterCount =
    selCats.length +
    selDiffs.length +
    (hasWater ? 1 : 0) +
    (hasShade ? 1 : 0) +
    (accessible ? 1 : 0);

  const handleRegionClick = (region: Region) => {
    setSelectedPOI(null);
    setSelectedRegion((prev) => (prev?.id === region.id ? null : region));
  };

  const panTarget =
    urlRegion && urlLat && urlLng
      ? { center: [urlLat, urlLng] as [number, number], zoom: urlZoom }
      : selectedRegion
        ? {
            center: [selectedRegion.center_lat, selectedRegion.center_lng] as [
              number,
              number,
            ],
            zoom: selectedRegion.zoom,
          }
        : null;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "calc(100vh - 72px)",
        overflow: "hidden",
        direction: "rtl",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          background: "#fff",
          padding: "12px 20px 10px",
          boxShadow: "0 2px 16px rgba(0,0,0,0.08)",
          direction: "rtl",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        {error && (
          <div
            style={{
              width: "100%",
              textAlign: "center",
              color: "#dc2626",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            שגיאה — {error}
          </div>
        )}
        {!error && selectedRegion ? (
          <>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: selectedRegion.color,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#1a2e2a" }}>
                {selectedRegion.name}
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 1 }}>
                {loading ? "טוען..." : `${pois.length} אתרים`}
                {activeFilterCount > 0 ? ` (${activeFilterCount} פילטרים)` : ""}
              </div>
            </div>
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              style={{
                background: activeFilterCount > 0 ? "#0d9e6e" : "#f1f5f9",
                border: "none",
                borderRadius: 10,
                padding: "6px 12px",
                cursor: "pointer",
                fontSize: 13,
                color: activeFilterCount > 0 ? "#fff" : "#64748b",
                fontFamily: "Heebo, sans-serif",
                fontWeight: 600,
                position: "relative",
              }}
            >
              {activeFilterCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#ef4444",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {activeFilterCount}
                </span>
              )}
              סינון
            </button>
            <button
              onClick={() => setSelectedRegion(null)}
              style={{
                background: "#f1f5f9",
                border: "none",
                borderRadius: 10,
                padding: "6px 12px",
                cursor: "pointer",
                fontSize: 13,
                color: "#64748b",
                fontFamily: "Heebo, sans-serif",
                fontWeight: 600,
              }}
            >
              ביטול אזור
            </button>
          </>
        ) : (
          !error && (
            <div style={{ width: "100%", textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#1a2e2a" }}>
                בחר אזור לצפייה באתרים
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                לחץ על אזור במפה או בתפריט התחתון
              </div>
            </div>
          )
        )}
      </div>

      <OverlayFilter
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        categories={categories}
        selCats={selCats}
        setSelCats={setSelCats}
        selDiffs={selDiffs}
        setSelDiffs={setSelDiffs}
        hasWater={hasWater}
        setHasWater={setHasWater}
        hasShade={hasShade}
        setHasShade={setHasShade}
        accessible={accessible}
        setAccessible={setAccessible}
      />

      <MapContainer
        center={[31.5, 35.0]}
        zoom={7}
        minZoom={7}
        maxZoom={18}
        maxBounds={[
          [29.0, 34.0],
          [33.8, 36.3],
        ]}
        maxBoundsViscosity={0.85}
        style={{ width: "100%", height: "100%", zIndex: 1 }}
        zoomControl={false}
      >
        <TileLayer
          url="https://cdnil.govmap.gov.il/xyz/heb/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          subdomains="abcd"
          maxZoom={20}
        />
        <PanController target={panTarget} />
        <ZoomTracker onZoom={setMapZoom} />

        {!selectedRegion &&
          regions.map((region) => {
            if (!region.polygon_coords) return null;
            return (
              <Polygon
                key={region.id}
                positions={region.polygon_coords as [number, number][]}
                pathOptions={{
                  color: region.color,
                  fillColor: region.color,
                  fillOpacity: 0.15,
                  weight: 2,
                }}
                eventHandlers={{ click: () => handleRegionClick(region) }}
              >
                <Tooltip
                  sticky
                  direction="center"
                  opacity={1}
                  className="region-label"
                >
                  {region.name}
                </Tooltip>
              </Polygon>
            );
          })}

        <MarkersLayer
          pois={pois}
          onMarkerClick={setSelectedPOI}
          onMapClick={() => setSelectedPOI(null)}
          zoom={mapZoom}
        />
      </MapContainer>

      {selectedPOI && (
        <div
          style={{
            position: "absolute",
            bottom: 90,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1200,
            width: 290,
            background: "#fff",
            borderRadius: 20,
            boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
            overflow: "hidden",
            direction: "rtl",
          }}
        >
          <button
            onClick={() => setSelectedPOI(null)}
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              zIndex: 10,
              background: "rgba(0,0,0,0.4)",
              border: "none",
              borderRadius: "50%",
              width: 30,
              height: 30,
              cursor: "pointer",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          {selectedPOI.main_image && (
            <div
              style={{
                height: 140,
                backgroundImage: `url(${selectedPOI.main_image})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          )}
          <div style={{ padding: "14px 16px 16px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <span
                  style={{ fontSize: 14, fontWeight: 800, color: "#f59e0b" }}
                >
                  {selectedPOI.average_rating}
                </span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#1a2e2a" }}>
                {selectedPOI.name}
              </div>
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#94a3b8",
                textAlign: "right",
                marginBottom: 14,
              }}
            >
              {selectedPOI.category}
            </div>
            <button
              onClick={() => navigate(`/POIDetail?id=${selectedPOI.id}`)}
              style={{
                width: "100%",
                padding: "11px",
                border: "none",
                borderRadius: 13,
                background: "linear-gradient(135deg, #0d9e6e, #0bba7e)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 800,
                cursor: "pointer",
                fontFamily: "Heebo, sans-serif",
              }}
            >
              פרטים נוספים
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          background: "rgba(255,255,255,0.97)",
          backdropFilter: "blur(12px)",
          padding: "10px 16px 12px",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            alignItems: "center",
          }}
        >
          {regions.map((region) => {
            const active = selectedRegion?.id === region.id;
            return (
              <button
                key={region.id}
                onClick={() => handleRegionClick(region)}
                style={{
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "7px 14px",
                  borderRadius: 20,
                  border: `2px solid ${active ? region.color : "#e2e8f0"}`,
                  background: active ? region.color : "#fff",
                  color: active ? "#fff" : "#64748b",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "Heebo, sans-serif",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: active
                      ? "rgba(255,255,255,0.75)"
                      : region.color,
                    flexShrink: 0,
                  }}
                />
                {region.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/TripDetail.tsx — UPDATED
// Feature 9: Share trip button that awards XP (once per trip).
// Feature: Google Maps-style photo markers on map.

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "../api";
import XpToast from "../components/XpToast";
import Disclaimer from "../components/Disclaimer";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ── Photo marker ──────────────────────────────────────────────────────────────

function PhotoStopMarker({ stop, index }: Readonly<{ stop: any; index: number }>) {
  const map = useMap();
  const icon = L.divIcon({
    html: stop.main_image
      ? String.raw`<div style="
            position:relative;width:52px;height:52px;border-radius:12px;
            overflow:hidden;border:3px solid #0d9e6e;
            box-shadow:0 3px 12px rgba(0,0,0,0.35);cursor:pointer;">
          <img src="${stop.main_image}" style="width:100%;height:100%;object-fit:cover;"
            onerror="this.onerror=null;this.parentElement.innerHTML='<div style=\'width:100%;height:100%;background:#0d9e6e;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:900\'>${index + 1}</div>'"/>
          <div style="
            position:absolute;bottom:0;left:0;right:0;
            background:linear-gradient(transparent,rgba(0,0,0,0.65));
            color:#fff;font-size:9px;font-weight:700;
            padding:4px 4px 3px;text-align:center;font-family:Heebo,Arial;">
            ${index + 1}
          </div>
        </div>`
      : `<div style="
            width:40px;height:40px;border-radius:12px;
            background:linear-gradient(135deg,#0d9e6e,#0bba7e);
            border:3px solid #fff;
            display:flex;align-items:center;justify-content:center;
            color:#fff;font-size:15px;font-weight:900;
            box-shadow:0 3px 10px rgba(13,158,110,0.4);font-family:Heebo,Arial;">
          ${index + 1}
        </div>`,
    className: "",
    iconSize: stop.main_image ? [52, 52] : [40, 40],
    iconAnchor: stop.main_image ? [26, 26] : [20, 20],
  });

  return (
    <Marker
      position={[stop.latitude, stop.longitude]}
      icon={icon}
      eventHandlers={{
        click: () => map.flyTo([stop.latitude, stop.longitude], Math.max(map.getZoom(), 13), { duration: 0.6 }),
      }}
    />
  );
}

// ── FitBounds ─────────────────────────────────────────────────────────────────

function FitBounds({ points }: Readonly<{ points: [number, number][] }>) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points).pad(0.18));
  }, []);
  return null;
}

// ── RegionLabel ───────────────────────────────────────────────────────────────

function RegionLabel({ name }: Readonly<{ name: string }>) {
  return (
    <div style={{
      position: "absolute", top: "50%", left: "50%",
      transform: "translate(-50%, -50%)",
      pointerEvents: "none", textAlign: "center", zIndex: 500,
    }}>
      <div style={{
        color: "#1a1a1a",
        textShadow: "0 1px 4px rgba(255,255,255,0.9), 0 -1px 4px rgba(255,255,255,0.9), 1px 0 4px rgba(255,255,255,0.9), -1px 0 4px rgba(255,255,255,0.9)",
        fontFamily: "Heebo, Arial",
        fontSize: 20, fontWeight: 900,
      }}>
        {name}
      </div>
    </div>
  );
}

// ── Share icon helper ─────────────────────────────────────────────────────────

function getShareIcon(sharing: boolean, shared: boolean) {
  if (sharing) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d9e6e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
    );
  }
  if (shared) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d9e6e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TripDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tripId = searchParams.get("id") || "";
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [shareXp, setShareXp] = useState<any>(null);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    if (!tripId) { setLoading(false); return; }
    api.trips.get(tripId)
      .then(data => { setTrip(data); setLoading(false); })
      .catch(() => {
        api.trips.list()
          .then(trips => { if (trips.length > 0) { setTrip(trips[0]); } setLoading(false); })
          .catch(() => setLoading(false));
      });
  }, [tripId]);

  const handleShare = async () => {
    if (sharing || !tripId) return;
    setSharing(true);
    try {
      const result = await api.trips.share(tripId);
      if (result.xp_awarded && result.xp) setShareXp(result.xp);
      setShared(true);
      if (navigator.share) {
        await navigator.share({ title: trip?.name || 'המסלול שלי', text: trip?.description || '', url: globalThis.location.href }).catch(() => { });
      } else {
        navigator.clipboard.writeText(globalThis.location.href).catch(() => { });
      }
    } catch (err) {
      console.error("Share failed:", err);
    } finally {
      setSharing(false);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>טוען...</div>;

  if (!trip) return (
    <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🗺️</div>
      <div style={{ fontWeight: 700 }}>המסלול לא נמצא</div>
      <button onClick={() => navigate("/MyTrips")}
        style={{ marginTop: 16, background: "#0d9e6e", color: "#fff", border: "none", borderRadius: 12, padding: "10px 24px", cursor: "pointer", fontFamily: "Heebo, sans-serif", fontWeight: 700 }}>
        חזרה למסלולים
      </button>
    </div>
  );

  const stopsWithCoords = (trip.stops || []).filter((s: any) => s.latitude && s.longitude);
  const polylinePoints: [number, number][] = stopsWithCoords.map((s: any) => [s.latitude, s.longitude]);
  const center: [number, number] | null = stopsWithCoords.length > 0
    ? [stopsWithCoords[0].latitude, stopsWithCoords[0].longitude] : null;

  return (
    <>
      {shareXp && <XpToast xp={shareXp} onDone={() => setShareXp(null)} />}
      <div style={{ background: "#f8fafc", minHeight: "100vh", width: "100%", direction: "rtl" }}>

        {/* Header */}
        <div style={{ background: "linear-gradient(160deg, #0d9e6e 0%, #0bba7e 100%)", width: "100%" }}>
          <div style={{ maxWidth: 600, margin: "0 auto", padding: "48px 20px 40px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <button onClick={() => navigate("/MyTrips")}
              style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 12, padding: "8px 12px", cursor: "pointer", color: "#fff", fontSize: 13, fontFamily: "Heebo, sans-serif" }}>
              ← חזרה
            </button>
            <div style={{ textAlign: "right" }}>
              <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 900, marginBottom: 4 }}>{trip.name}</h1>
              {trip.region && <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>{trip.region}</p>}
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px", paddingBottom: 100 }}>

          {/* Stats row */}
          <div style={{ background: "#fff", borderRadius: 20, padding: "16px 20px", marginBottom: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", display: "flex", justifyContent: "space-around", direction: "rtl" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#1a2e2a" }}>{trip.total_duration_hours}</div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>שעות</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#1a2e2a" }}>{trip.stops?.length || 0}</div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>עצירות</div>
            </div>
            {trip.difficulty && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#1a2e2a" }}>{trip.difficulty}</div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>קושי</div>
              </div>
            )}
          </div>

          {/* Map with photo markers */}
          {center && (
            <div style={{
              borderRadius: 20, overflow: "hidden", marginBottom: 16,
              height: 280, position: "relative",
              boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
            }}>
              <MapContainer
                center={center} zoom={11}
                style={{ height: "100%", width: "100%" }}
                zoomControl={false} scrollWheelZoom={false}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
                {polylinePoints.length > 1 && (
                  <Polyline positions={polylinePoints} pathOptions={{ color: "#0d9e6e", weight: 3, opacity: 0.8, dashArray: "8,6" }} />
                )}
                {stopsWithCoords.map((s: any, i: number) => (
                  <PhotoStopMarker key={s.location_id ?? s.poi_name ?? i} stop={s} index={i} />
                ))}
                <FitBounds points={polylinePoints} />
              </MapContainer>
              {trip.region && <RegionLabel name={trip.region} />}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, height: 50,
                background: "linear-gradient(transparent, rgba(0,0,0,0.06))",
                pointerEvents: "none", zIndex: 500,
              }} />
            </div>
          )}

          {/* Stops */}
          <div style={{ background: "#fff", borderRadius: 20, padding: "16px 20px", marginBottom: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: "#1a2e2a", marginBottom: 16, textAlign: "right" }}>עצירות במסלול</h2>
            {(trip.stops || []).map((stop: any, index: number) => (
              <div key={stop.location_id ?? stop.poi_name ?? index} style={{ display: "flex", gap: 12, marginBottom: 16, direction: "rtl" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #0d9e6e, #34d399)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 13 }}>{index + 1}</div>
                  {index < (trip.stops || []).length - 1 && <div style={{ flex: 1, width: 2, background: "#e2e8f0", minHeight: 24 }} />}
                </div>
                <div style={{ flex: 1, paddingBottom: index < (trip.stops || []).length - 1 ? 16 : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", background: "#e2e8f0", padding: "2px 6px", borderRadius: 6 }}>{stop.arrival_time}</span>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>{stop.duration_minutes} דק'</span>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {stop.main_image && (
                      <img src={stop.main_image} alt="" loading="lazy" decoding="async" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                    )}
                    <div style={{ fontWeight: 800, fontSize: 15, color: "#1a2e2a", textAlign: "right" }}>{stop.poi_name}</div>
                  </div>
                  {stop.smart_insight && (
                    <div style={{ background: "#fffbeb", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "flex-start", gap: 6, marginTop: 6 }}>
                      <span style={{ fontSize: 12, color: "#d97706", fontWeight: 600, flex: 1, textAlign: "right", lineHeight: 1.4 }}>{stop.smart_insight}</span>
                      <span style={{ fontSize: 14 }}>💡</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Disclaimer />
          {/* Action Buttons */}
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={handleShare} disabled={sharing}
              style={{ width: 56, height: 56, border: shared ? "2px solid #0d9e6e" : "2px solid #e2e8f0", borderRadius: 16, background: shared ? "#f0fdf8" : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s ease" }}
              title="שתף מסלול וקבל XP">
              {getShareIcon(sharing, shared)}
            </button>
            <button
              onClick={() => { const addr = encodeURIComponent(trip.stops?.[0]?.poi_name || trip.region); window.open(`https://waze.com/ul?q=${addr}`, "_blank"); }}
              style={{ flex: 1, padding: "16px", border: "none", borderRadius: 16, background: "linear-gradient(135deg, #0d9e6e, #0bba7e)", color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer", fontFamily: "Heebo, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 12px rgba(13, 158, 110, 0.2)" }}>
              התחל ניווט
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>
            </button>
          </div>

          {shared && (
            <div style={{ marginTop: 10, textAlign: "center", fontSize: 13, color: "#0d9e6e", fontWeight: 700 }}>
              🎉 מסלול שותף! {shareXp ? `+${shareXp.new_xp} XP` : ""}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
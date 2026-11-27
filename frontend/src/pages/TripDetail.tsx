/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/TripDetail.tsx — UPDATED
// Feature 9: Share trip button that awards XP (once per trip).
// Feature: Google Maps-style photo markers on map.

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import RouteMap from "../components/RouteMap";
import { fromMinutes, googleMapsRouteUrl, toMinutes } from "../utils/routeSchedule";
import { api } from "../api";
import XpToast from "../components/XpToast";
import { getSavedTrip, isTripSaved, refreshSavedTrip, removeSavedTrip, saveTripOffline } from "../utils/offlineTrips";
import { toast } from "sonner";

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
  const [activeStop, setActiveStop] = useState<string | number | null>(null);
  /** Showing the copy saved on this device because the server could not be reached. */
  const [fromOffline, setFromOffline] = useState<string | null>(null);
  const [savedOffline, setSavedOffline] = useState(() => isTripSaved(tripId));
  const [saveProgress, setSaveProgress] = useState<number | null>(null);

  useEffect(() => {
    if (!tripId) { setLoading(false); return; }
    api.trips.get(tripId)
      .then(data => { setTrip(data); refreshSavedTrip(data); setLoading(false); })
      .catch(() => {
        const saved = getSavedTrip(tripId);
        if (saved) {
          setTrip(saved.trip);
          setFromOffline(saved.savedAt);
          setLoading(false);
          return;
        }
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

  const handleOfflineToggle = async () => {
    if (saveProgress !== null || !trip) return;
    if (savedOffline) {
      removeSavedTrip(trip.id);
      setSavedOffline(false);
      toast.success("המסלול הוסר מהשמורים במכשיר");
      return;
    }
    setSaveProgress(0);
    try {
      await saveTripOffline(trip, (done, total) => setSaveProgress(Math.round((done / total) * 100)));
      setSavedOffline(true);
      toast.success("המסלול והמפה נשמרו – אפשר לפתוח גם בלי קליטה");
    } catch {
      toast.error("השמירה נכשלה. בדקו את החיבור ונסו שוב.");
    } finally {
      setSaveProgress(null);
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
  const stopKey = (s: any, i: number) => s.location_id ?? `${i}-${s.poi_name}`;
  const mapsUrl = googleMapsRouteUrl(stopsWithCoords.map((s: any) => ({ lat: s.latitude, lng: s.longitude })));
  const first = stopsWithCoords[0];

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

          {fromOffline && (
            <div role="status" style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 14, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#92400e", textAlign: "right", lineHeight: 1.5 }}>
              📴 אין חיבור – מוצג העותק ששמרתם במכשיר ({new Date(fromOffline).toLocaleDateString("he-IL")}).
            </div>
          )}

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

          {(trip.description || trip.why) && (
            <div style={{ background: "#fff", borderRadius: 20, padding: "16px 20px", marginBottom: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", textAlign: "right" }}>
              {trip.description && <p style={{ fontSize: 14, color: "#334155", lineHeight: 1.7, margin: 0 }}>{trip.description}</p>}
              {trip.why && (
                <div style={{ marginTop: trip.description ? 10 : 0, background: "#f0fdf8", borderRadius: 12, padding: "10px 12px" }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#065f46", marginBottom: 2 }}>🧭 למה המסלול בנוי ככה</div>
                  <div style={{ fontSize: 14, color: "#065f46", lineHeight: 1.7 }}>{trip.why}</div>
                </div>
              )}
            </div>
          )}

          {/* Map */}
          {stopsWithCoords.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <RouteMap
                height={300}
                activeId={activeStop}
                onSelect={setActiveStop}
                stops={stopsWithCoords.map((s: any, i: number) => ({
                  id: stopKey(s, i),
                  name: s.poi_name,
                  lat: s.latitude,
                  lng: s.longitude,
                  image: s.main_image,
                  time: s.arrival_time || null,
                }))}
              />
            </div>
          )}

          {/* Stops */}
          <div style={{ background: "#fff", borderRadius: 20, padding: "16px 20px", marginBottom: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: "#1a2e2a", marginBottom: 16, textAlign: "right" }}>עצירות במסלול</h2>
            {(trip.stops || []).map((stop: any, index: number) => (
              <div key={stop.location_id ?? stop.poi_name ?? index} role="button" tabIndex={0}
                onClick={() => setActiveStop(stopKey(stop, stopsWithCoords.indexOf(stop)))}
                onKeyDown={e => { if (e.key === "Enter") setActiveStop(stopKey(stop, stopsWithCoords.indexOf(stop))); }}
                style={{ display: "flex", gap: 12, marginBottom: 16, direction: "rtl", cursor: "pointer", borderRadius: 14, outline: activeStop !== null && activeStop === stopKey(stop, stopsWithCoords.indexOf(stop)) ? "2px solid #0d9e6e" : "none", outlineOffset: 4 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #0d9e6e, #34d399)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 13 }}>{index + 1}</div>
                  {index < (trip.stops || []).length - 1 && <div style={{ flex: 1, width: 2, background: "#e2e8f0", minHeight: 24 }} />}
                </div>
                <div style={{ flex: 1, paddingBottom: index < (trip.stops || []).length - 1 ? 16 : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <bdi dir="ltr" style={{ fontSize: 11, fontWeight: 800, color: "#0d9e6e", background: "#f0fdf8", padding: "2px 6px", borderRadius: 6, fontVariantNumeric: "tabular-nums" }}>
                      {stop.arrival_time ? `${stop.arrival_time}–${fromMinutes(toMinutes(stop.arrival_time) + (stop.duration_minutes || 60))}` : ""}
                    </bdi>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>{stop.duration_minutes} דק'</span>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {stop.main_image && (
                      <img src={stop.main_image} alt="" loading="lazy" decoding="async" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                    )}
                    <div style={{ fontWeight: 800, fontSize: 15, color: "#1a2e2a", textAlign: "right" }}>{stop.poi_name}</div>
                  </div>
                  {stop.reason && (
                    <div style={{ background: "#f0fdf8", borderRadius: 10, padding: "7px 12px", marginTop: 6, fontSize: 12.5, color: "#065f46", lineHeight: 1.5, textAlign: "right" }}>🧭 {stop.reason}</div>
                  )}
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

          {/* Live trip mode — the day itself: next stop, on-time status, sunset */}
          {(trip.stops || []).length > 0 && (
            <button onClick={() => navigate(`/TripLive?id=${trip.id}`)}
              style={{ width: "100%", marginBottom: 12, padding: "16px", border: "none", borderRadius: 16, background: "#1a2e2a", color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer", fontFamily: "Heebo, sans-serif" }}>
              ▶ יוצאים לדרך – מצב טיול
            </button>
          )}

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={handleShare} disabled={sharing}
              style={{ width: 56, height: 56, border: shared ? "2px solid #0d9e6e" : "2px solid #e2e8f0", borderRadius: 16, background: shared ? "#f0fdf8" : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s ease" }}
              title="שתף מסלול וקבל XP">
              {getShareIcon(sharing, shared)}
            </button>
            <button
              onClick={() => {
                const url = mapsUrl
                  ?? (first ? `https://waze.com/ul?ll=${first.latitude},${first.longitude}&navigate=yes` : `https://waze.com/ul?q=${encodeURIComponent(trip.stops?.[0]?.poi_name || trip.region || "")}`);
                window.open(url, "_blank", "noopener,noreferrer");
              }}
              style={{ flex: 1, padding: "16px", border: "none", borderRadius: 16, background: "linear-gradient(135deg, #0d9e6e, #0bba7e)", color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer", fontFamily: "Heebo, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 12px rgba(13, 158, 110, 0.2)" }}>
              {stopsWithCoords.length > 1 ? "נווט בכל המסלול" : "התחל ניווט"}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>
            </button>
          </div>

          <button onClick={handleOfflineToggle} disabled={saveProgress !== null}
            aria-pressed={savedOffline}
            style={{ width: "100%", marginTop: 12, padding: "12px", borderRadius: 14, border: savedOffline ? "2px solid #0d9e6e" : "2px solid #e2e8f0", background: savedOffline ? "#f0fdf8" : "#fff", color: savedOffline ? "#0d9e6e" : "#334155", fontSize: 14, fontWeight: 800, cursor: saveProgress !== null ? "wait" : "pointer", fontFamily: "Heebo, sans-serif" }}>
            {saveProgress !== null
              ? `שומר מפה לשימוש בלי קליטה… ${saveProgress}%`
              : savedOffline ? "✓ שמור במכשיר לשימוש בלי קליטה (הקישו להסרה)" : "📥 שמור לשימוש בלי קליטה"}
          </button>

          {first && (
            <a href={`https://waze.com/ul?ll=${first.latitude},${first.longitude}&navigate=yes`} target="_blank" rel="noopener noreferrer"
              style={{ display: "block", marginTop: 10, textAlign: "center", fontSize: 13, color: "#0d9e6e", fontWeight: 700, textDecoration: "none" }}>
              או ב-Waze לעצירה הראשונה ({first.poi_name})
            </a>
          )}

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
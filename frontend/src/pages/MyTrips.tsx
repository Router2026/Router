// src/pages/MyTrips.tsx — the user's saved routes.
// Data comes from useMyRoutes() (React Query); delete / share / publish update that cache.
// Each card: a photo cover from its stops, when it was saved, the stops, whether the trip
// agents planned it, and actions (open, navigate, share, publish, delete).

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, toast, type Trip, type XpResult } from '../api';
import XpToast from '../components/XpToast';
import { useMyRoutes, useDeleteRoute, tripKeys } from '../hooks/useTrips';
import { googleMapsRouteUrl } from '../utils/routeSchedule';
import { listSavedTrips } from '../utils/offlineTrips';

const GROUP_ICONS: Record<string, string> = {
  'משפחה עם ילדים': '👨‍👩‍👧‍👦', 'משפחה': '👨‍👩‍👧‍👦',
  'חברים': '👥', 'יחיד': '🚶', 'זוג': '👫',
  'solo': '🚶', 'couple': '👫', 'family': '👨‍👩‍👧‍👦', 'friends': '👥',
};

const C = { ink: '#1a2e2a', muted: '#64748b', faint: '#94a3b8', line: '#e2e8f0', accent: '#0d9e6e', soft: '#f0fdf8', deep: '#065f46', purple: '#7c3aed' };

type Source = 'all' | 'agents' | 'manual';

const CREATE_OPTIONS = [
  { path: '/TripPlanner', icon: '🤖', title: 'תכנון עם הסוכנים', desc: 'בוחרים אזור וסגנון, והסוכנים בונים יום שלם' },
  { path: '/AgentPlanner', icon: '✍️', title: 'לכתוב במילים שלכם', desc: '"טיול קל עם ילדים בגליל עם מים, מחר מ-9"' },
  { path: '/RouteGenerator', icon: '🗺️', title: 'לבנות בעצמי', desc: 'בוחרים מקומות על המפה ומסדרים מסלול' },
] as const;

/** Agent-planned routes carry a "why" or per-stop reasons (migration 0013). */
const isAgentPlanned = (t: Trip) => !!t.why || (t.stops ?? []).some(s => !!s.reason);

function savedLabel(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return 'נשמר היום';
  if (days === 1) return 'נשמר אתמול';
  if (days < 7) return `נשמר לפני ${days} ימים`;
  return `נשמר ב-${d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })}`;
}

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

const actionBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 34, padding: '0 12px',
  borderRadius: 10, border: `1.5px solid ${C.line}`, background: '#fff', color: C.muted, fontSize: 12, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'Heebo, sans-serif', textDecoration: 'none', whiteSpace: 'nowrap',
};

// ── Card ─────────────────────────────────────────────────────────────────────

function TripCard({
  trip, confirming, deleting, sharing, shared, published,
  onOpen, onAskDelete, onDelete, onCancelDelete, onShare, onPublish,
}: Readonly<{
  trip: Trip;
  confirming: boolean; deleting: boolean; sharing: boolean; shared: boolean; published: boolean;
  onOpen: () => void; onAskDelete: () => void; onDelete: () => void; onCancelDelete: () => void;
  onShare: () => void; onPublish: () => void;
}>) {
  const stops = trip.stops ?? [];
  const images = [...new Set(stops.map(s => s.main_image).filter((x): x is string => !!x))].slice(0, 3);
  const withCoords = stops.filter(s => s.latitude != null && s.longitude != null);
  const mapsUrl = googleMapsRouteUrl(withCoords.map(s => ({ lat: s.latitude as number, lng: s.longitude as number })));
  const names = stops.map(s => s.poi_name).filter(Boolean);
  const agents = isAgentPlanned(trip);
  const km = Number(trip.total_distance_km);

  return (
    <article style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', border: `1px solid ${confirming ? '#fecaca' : '#eef2f1'}`, display: 'flex', flexDirection: 'column' }}>
      {/* Cover — the whole top opens the trip */}
      <button type="button" onClick={onOpen} aria-label={`פתח את ${trip.name}`}
        style={{ position: 'relative', height: 140, padding: 0, border: 'none', cursor: 'pointer', background: 'linear-gradient(160deg, #0d9e6e 0%, #34d399 100%)', display: 'block', width: '100%' }}>
        {images.length > 0 && (
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: images.length === 1 ? '1fr' : '2fr 1fr', gridTemplateRows: images.length === 3 ? '1fr 1fr' : '1fr', gap: 2 }}>
            {images.map((src, i) => (
              <img key={src} src={src} alt="" loading="lazy" decoding="async"
                onError={e => { e.currentTarget.style.visibility = 'hidden'; }}
                style={{ width: '100%', height: '100%', objectFit: 'cover', gridRow: i === 0 && images.length === 3 ? '1 / span 2' : undefined }} />
            ))}
          </div>
        )}
        {images.length === 0 && <span aria-hidden="true" style={{ position: 'absolute', top: 18, left: 18, fontSize: 40, opacity: 0.35 }}>🗺️</span>}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 30%, rgba(0,0,0,0.65))' }} />
        <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '3px 9px', background: agents ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.55)', color: agents ? C.deep : '#fff' }}>
          {agents ? '🤖 תוכנן ע״י הסוכנים' : '✋ נבנה ידנית'}
        </span>
        {trip.is_shared && (
          <span style={{ position: 'absolute', top: 10, left: 10, fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '3px 9px', background: 'rgba(124,58,237,0.92)', color: '#fff' }}>
            👥 משותף איתי
          </span>
        )}
        <div style={{ position: 'absolute', bottom: 10, right: 12, left: 12, textAlign: 'right', direction: 'rtl' }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', lineHeight: 1.25, textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>{trip.name}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.92)', marginTop: 3 }}>
            {[trip.region, savedLabel(trip.created_at)].filter(Boolean).join(' · ')}
          </div>
        </div>
      </button>

      <div style={{ padding: '12px 14px 14px', direction: 'rtl', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: C.muted, fontWeight: 600 }}>
          <span>📍 {stops.length} עצירות</span>
          {trip.total_duration_hours > 0 && <span>⏱ {trip.total_duration_hours} שעות</span>}
          {Number.isFinite(km) && km > 0 && <span>🚗 {km.toFixed(km < 10 ? 1 : 0)} ק"מ</span>}
          <span style={{ marginInlineStart: 'auto' }} aria-hidden="true">{GROUP_ICONS[trip.group_type ?? ''] ?? ''}</span>
        </div>

        {names.length > 0 && (
          <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
            {names.slice(0, 3).join(' ← ')}{names.length > 3 ? ` ← ועוד ${names.length - 3}` : ''}
          </div>
        )}

        {confirming ? (
          <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fef2f2', borderRadius: 12, padding: '8px 10px', marginTop: 'auto' }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#b91c1c' }}>למחוק את המסלול?</span>
            <button type="button" onClick={onCancelDelete} style={actionBtn}>ביטול</button>
            <button type="button" onClick={onDelete} disabled={deleting}
              style={{ ...actionBtn, background: '#ef4444', borderColor: '#ef4444', color: '#fff' }}>
              {deleting ? 'מוחק…' : 'מחק'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'auto' }}>
            <button type="button" onClick={onOpen} style={{ ...actionBtn, background: C.accent, borderColor: C.accent, color: '#fff' }}>פתח</button>
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={actionBtn}>🚗 נווט</a>
            )}
            <button type="button" onClick={onShare} disabled={sharing} title="שתף וקבל +15 XP"
              style={{ ...actionBtn, ...(shared ? { borderColor: C.accent, color: C.accent, background: C.soft } : {}) }}>
              {sharing ? '⏳' : shared ? '✓' : <ShareIcon />} {shared ? 'שותף' : 'שתף'}
            </button>
            {/* Publishing and deleting belong to the owner; a joined member only plans along. */}
            {!trip.is_shared && (published ? (
              <span style={{ ...actionBtn, cursor: 'default', borderColor: C.purple, color: C.purple, background: '#faf5ff' }}>✓ ציבורי</span>
            ) : (
              <button type="button" onClick={onPublish} title="פרסם לכולם וקבל +25 XP" style={{ ...actionBtn, borderColor: '#ddd6fe', color: C.purple }}>🌐 פרסם</button>
            ))}
            {!trip.is_shared && (
              <button type="button" onClick={onAskDelete} aria-label={`מחק את ${trip.name}`} title="מחיקה"
                style={{ ...actionBtn, marginInlineStart: 'auto', padding: '0 10px' }}>🗑</button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function SkeletonCard() {
  return (
    <div aria-hidden="true" style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
      <div className="mytrips-shimmer" style={{ height: 140 }} />
      <div style={{ padding: 14, display: 'grid', gap: 8 }}>
        <div className="mytrips-shimmer" style={{ height: 12, width: '60%', borderRadius: 6 }} />
        <div className="mytrips-shimmer" style={{ height: 12, width: '85%', borderRadius: 6 }} />
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MyTrips() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: trips = [], isLoading, isError, refetch } = useMyRoutes();
  const deleteRoute = useDeleteRoute();

  const [query, setQuery] = useState('');
  const [source, setSource] = useState<Source>('all');
  const [region, setRegion] = useState<string>('');
  const [showCreate, setShowCreate] = useState(false);

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [sharedIds, setSharedIds] = useState<Set<string>>(new Set());
  const [shareXp, setShareXp] = useState<XpResult | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishedIds, setPublishedIds] = useState<Set<string>>(new Set());
  const [showPublishModal, setShowPublishModal] = useState<string | null>(null);
  const [publishDesc, setPublishDesc] = useState('');
  const [publishPOI, setPublishPOI] = useState('');
  const [publishStops, setPublishStops] = useState('');

  // A pending delete confirmation goes away by itself.
  useEffect(() => {
    if (!confirmId) return;
    const t = setTimeout(() => setConfirmId(null), 6000);
    return () => clearTimeout(t);
  }, [confirmId]);

  const regions = useMemo(
    () => [...new Set(trips.map(t => t.region).filter((r): r is string => !!r))].sort((a, b) => a.localeCompare(b, 'he')),
    [trips],
  );
  const agentCount = useMemo(() => trips.filter(isAgentPlanned).length, [trips]);

  const visible = useMemo(() => {
    const q = query.trim();
    return trips.filter(t => {
      if (source === 'agents' && !isAgentPlanned(t)) return false;
      if (source === 'manual' && isAgentPlanned(t)) return false;
      if (region && t.region !== region) return false;
      if (!q) return true;
      return t.name.includes(q) || (t.region ?? '').includes(q) || (t.stops ?? []).some(s => s.poi_name.includes(q));
    });
  }, [trips, query, source, region]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleDelete = (id: string) => {
    deleteRoute.mutate(id, {
      onSuccess: () => { setConfirmId(null); toast.success('המסלול נמחק'); },
      onError: () => toast.error('המחיקה נכשלה. נסו שוב.'),
    });
  };

  const handleShare = async (id: string) => {
    if (sharingId === id) return;
    setSharingId(id);
    try {
      const result = await api.trips.share(id);
      if (result.xp_awarded && result.xp) setShareXp(result.xp);
      setSharedIds(prev => new Set(prev).add(id));
      const trip = trips.find(t => String(t.id) === id);
      const url = `${globalThis.location.origin}/TripDetail?id=${id}`;
      if (navigator.share && trip) {
        navigator.share({ title: trip.name, url }).catch(() => {});
      } else {
        navigator.clipboard.writeText(url).then(() => toast.success('הקישור הועתק')).catch(() => {});
      }
    } catch (err) {
      console.error('Share failed:', err);
      toast.error('השיתוף נכשל. נסו שוב.');
    } finally { setSharingId(null); }
  };

  const handlePublish = async (id: string) => {
    setPublishingId(id);
    try {
      const trip = trips.find(t => String(t.id) === id);
      if (!trip) return;
      const result = await api.publicTrips.create({
        title: trip.name,
        description: publishDesc || trip.description || undefined,
        is_public: true,
        location_ids: trip.stops?.map(s => s.location_id).filter((x): x is number => !!x) || [],
      });
      if (publishPOI || publishStops) {
        await api.publicTrips.updateMedia(result.id, {
          points_of_interest: publishPOI || undefined,
          recommended_stops: publishStops || undefined,
        });
      }
      // The publish endpoint returns the XP result in xp_awarded when XP was given.
      if (result.xp_awarded && typeof result.xp_awarded === 'object') setShareXp(result.xp_awarded as XpResult);
      setPublishedIds(prev => new Set(prev).add(id));
      setShowPublishModal(null);
      setPublishDesc(''); setPublishPOI(''); setPublishStops('');
      toast.success('המסלול פורסם לכולם');
      qc.invalidateQueries({ queryKey: ['publicTrips', 'list'] });
      qc.invalidateQueries({ queryKey: tripKeys.routes() });
    } catch (err) {
      console.error('Publish failed:', err);
      toast.error('הפרסום נכשל. נסו שוב.');
    } finally { setPublishingId(null); }
  };

  const filtersActive = !!query.trim() || source !== 'all' || !!region;

  const chip = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px', borderRadius: 999, border: `1.5px solid ${active ? C.accent : C.line}`,
    background: active ? C.soft : '#fff', color: active ? C.accent : C.muted, fontSize: 12, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'Heebo, sans-serif', whiteSpace: 'nowrap',
  });

  return (
    <>
      {shareXp && <XpToast xp={shareXp} onDone={() => setShareXp(null)} />}
      <style>{`
        @keyframes mytripsShimmer { 0% { background-position: -400px 0 } 100% { background-position: 400px 0 } }
        .mytrips-shimmer { background: linear-gradient(90deg, #eef2f1 25%, #f8fafc 50%, #eef2f1 75%); background-size: 800px 100%; animation: mytripsShimmer 1.4s infinite linear; }
        @media (prefers-reduced-motion: reduce) { .mytrips-shimmer { animation: none } }
      `}</style>

      <div style={{ background: '#f8fafc', minHeight: '100vh', width: '100%', direction: 'rtl' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(160deg, #0d9e6e 0%, #0bba7e 100%)', width: '100%' }}>
          <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 20px 56px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
            <div>
              <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 900, margin: 0 }}>המסלולים שלי</h1>
              <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, margin: '4px 0 0' }}>
                {trips.length > 0 ? `${trips.length} מסלולים שמורים${agentCount ? ` · ${agentCount} תוכננו ע״י הסוכנים` : ''}` : 'כל המסלולים שיצרת במקום אחד'}
              </p>
            </div>
            <button type="button" onClick={() => setShowCreate(true)}
              style={{ background: '#fff', border: 'none', borderRadius: 14, padding: '10px 16px', cursor: 'pointer', color: C.accent, fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Heebo, sans-serif', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', flexShrink: 0 }}>
              <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>+</span> מסלול חדש
            </button>
          </div>
        </div>

        <div style={{ maxWidth: 860, margin: '-32px auto 0', padding: '0 16px 100px' }}>
          {/* Search + filters */}
          {trips.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 18, padding: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.06)', marginBottom: 16, display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', border: `1.5px solid ${C.line}`, borderRadius: 12, padding: '8px 12px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.faint} strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="חיפוש לפי שם, אזור או מקום..." aria-label="חיפוש מסלולים"
                  style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, fontFamily: 'Heebo, sans-serif', color: C.ink, minWidth: 0 }} />
                {query && <button type="button" onClick={() => setQuery('')} aria-label="נקה חיפוש" style={{ border: 'none', background: 'none', color: C.faint, cursor: 'pointer', fontSize: 16 }}>×</button>}
              </div>
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
                <button type="button" style={chip(source === 'all')} onClick={() => setSource('all')}>הכל</button>
                <button type="button" style={chip(source === 'agents')} onClick={() => setSource('agents')}>🤖 של הסוכנים</button>
                <button type="button" style={chip(source === 'manual')} onClick={() => setSource('manual')}>✋ שבניתי</button>
                {regions.length > 1 && <span aria-hidden="true" style={{ width: 1, background: C.line, margin: '0 4px', flexShrink: 0 }} />}
                {regions.length > 1 && regions.map(r => (
                  <button key={r} type="button" style={chip(region === r)} onClick={() => setRegion(region === r ? '' : r)}>{r}</button>
                ))}
              </div>
            </div>
          )}

          {isLoading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, marginTop: 48 }}>
              <SkeletonCard /><SkeletonCard /><SkeletonCard />
            </div>
          )}

          {isError && !isLoading && (
            <div role="alert" style={{ background: '#fff', borderRadius: 20, padding: '40px 20px', textAlign: 'center', marginTop: 48, boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>😕</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.ink, marginBottom: 12 }}>לא הצלחנו לטעון את המסלולים</div>
              <button type="button" onClick={() => refetch()} style={{ ...actionBtn, background: C.accent, borderColor: C.accent, color: '#fff', padding: '0 20px', minHeight: 40 }}>נסו שוב</button>
              <OfflineSavedList onOpen={id => navigate(`/TripDetail?id=${id}`)} />
            </div>
          )}

          {!isLoading && !isError && trips.length > 0 && (
            visible.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                {visible.map(trip => {
                  const id = String(trip.id);
                  return (
                    <TripCard
                      key={id}
                      trip={trip}
                      confirming={confirmId === id}
                      deleting={deleteRoute.isPending && deleteRoute.variables === id}
                      sharing={sharingId === id}
                      shared={sharedIds.has(id)}
                      published={publishedIds.has(id)}
                      onOpen={() => navigate(`/TripDetail?id=${id}`)}
                      onAskDelete={() => setConfirmId(id)}
                      onCancelDelete={() => setConfirmId(null)}
                      onDelete={() => handleDelete(id)}
                      onShare={() => handleShare(id)}
                      onPublish={() => setShowPublishModal(id)}
                    />
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: C.muted }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>אין מסלולים שמתאימים לחיפוש</div>
                {filtersActive && (
                  <button type="button" onClick={() => { setQuery(''); setSource('all'); setRegion(''); }} style={actionBtn}>נקה סינון</button>
                )}
              </div>
            )
          )}

          {!isLoading && !isError && trips.length === 0 && (
            <div style={{ background: '#fff', borderRadius: 24, padding: '36px 20px 24px', textAlign: 'center', marginTop: 48, boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>🗺️</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: C.ink, marginBottom: 6 }}>אין מסלולים עדיין</div>
              <div style={{ fontSize: 14, color: C.muted, marginBottom: 20 }}>בחרו איך להתחיל:</div>
              <div style={{ display: 'grid', gap: 10, textAlign: 'right' }}>
                {CREATE_OPTIONS.map(o => (
                  <button key={o.path} type="button" onClick={() => navigate(o.path)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 16, border: `1.5px solid ${C.line}`, background: '#fff', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', textAlign: 'right' }}>
                    <span style={{ fontSize: 26 }} aria-hidden="true">{o.icon}</span>
                    <span style={{ flex: 1 }}>
                      <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: C.ink }}>{o.title}</span>
                      <span style={{ display: 'block', fontSize: 12, color: C.muted }}>{o.desc}</span>
                    </span>
                    <span aria-hidden="true" style={{ color: C.accent, fontWeight: 900 }}>←</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── "New route" chooser ───────────────────────────────────────── */}
      {showCreate && (
        <div role="dialog" aria-modal="true" aria-label="מסלול חדש" style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', direction: 'rtl' }}>
          <button type="button" aria-label="סגור" onClick={() => setShowCreate(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', border: 'none', cursor: 'default', padding: 0 }} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 520, padding: '18px 16px 28px', boxShadow: '0 -8px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: '#cbd5e1', margin: '0 auto 14px' }} />
            <div style={{ fontSize: 17, fontWeight: 900, color: C.ink, marginBottom: 12 }}>איך תרצו לבנות את המסלול?</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {CREATE_OPTIONS.map(o => (
                <button key={o.path} type="button" onClick={() => { setShowCreate(false); navigate(o.path); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 16, border: `1.5px solid ${C.line}`, background: '#fff', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', textAlign: 'right' }}>
                  <span style={{ fontSize: 26 }} aria-hidden="true">{o.icon}</span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: C.ink }}>{o.title}</span>
                    <span style={{ display: 'block', fontSize: 12, color: C.muted }}>{o.desc}</span>
                  </span>
                  <span aria-hidden="true" style={{ color: C.accent, fontWeight: 900 }}>←</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Publish Modal ─────────────────────────────────────────────── */}
      {showPublishModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'rtl', padding: 16 }}>
          <button type="button" aria-label="סגור" onClick={() => setShowPublishModal(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'default', padding: 0 }} />
          <div style={{ background: '#fff', borderRadius: 24, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)', position: 'relative', zIndex: 1 }}>
            <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, background: '#fff', zIndex: 10, borderRadius: '24px 24px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18, color: '#0f172a' }}>🌐 פרסם מסלול ציבורי</div>
                <div style={{ fontSize: 12, color: C.faint, marginTop: 3 }}>יוצג בעמוד המסלולים + תקבל +25 XP</div>
              </div>
              <button type="button" onClick={() => setShowPublishModal(null)} aria-label="סגור" style={{ border: 'none', background: '#f1f5f9', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', fontSize: 18, color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {([
                ['mytrips-pub-desc', '📝 תיאור המסלול', publishDesc, setPublishDesc, 3, 'מה מיוחד במסלול? למי הוא מתאים? מה הייתם ממליצים?'],
                ['mytrips-pub-poi', '✨ נקודות עניין', publishPOI, setPublishPOI, 2, 'מפל, תצפית, עץ עתיק — מה כדאי לשים לב?'],
                ['mytrips-pub-stops', '🛑 עצירות מומלצות', publishStops, setPublishStops, 2, 'היכן מומלץ לעצור ולהתעכב?'],
              ] as const).map(([htmlId, label, value, setValue, rows, placeholder]) => (
                <div key={htmlId}>
                  <label htmlFor={htmlId} style={{ fontWeight: 700, fontSize: 13, color: '#374151', display: 'block', marginBottom: 6 }}>{label}</label>
                  <textarea id={htmlId} value={value} onChange={e => setValue(e.target.value)} rows={rows} placeholder={placeholder}
                    style={{ width: '100%', padding: '11px 13px', border: `1.5px solid ${C.line}`, borderRadius: 13, fontSize: 13, fontFamily: 'Heebo, sans-serif', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.65 }}
                    onFocus={e => { e.currentTarget.style.borderColor = C.purple; }}
                    onBlur={e => { e.currentTarget.style.borderColor = C.line; }} />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setShowPublishModal(null)}
                  style={{ flex: 1, padding: '12px', borderRadius: 13, border: `1.5px solid ${C.line}`, background: '#fff', color: C.muted, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontSize: 14 }}>ביטול</button>
                <button type="button" onClick={() => handlePublish(showPublishModal)} disabled={!!publishingId}
                  style={{ flex: 2, padding: '12px', borderRadius: 13, border: 'none', background: publishingId ? C.faint : 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: '#fff', fontWeight: 800, cursor: publishingId ? 'default' : 'pointer', fontFamily: 'Heebo, sans-serif', fontSize: 14 }}>
                  {publishingId ? '⏳ מפרסם...' : '🌐 פרסם + קבל 25 XP'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Trips saved on this device; shown when the list can't be loaded (usually: no signal). */
function OfflineSavedList({ onOpen }: Readonly<{ onOpen: (id: string) => void }>) {
  const saved = useMemo(() => listSavedTrips(), []);
  if (saved.length === 0) return null;
  return (
    <div style={{ marginTop: 24, textAlign: 'right' }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.deep, marginBottom: 10 }}>📥 שמורים במכשיר – נפתחים גם בלי קליטה</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {saved.map(({ trip }) => (
          <button key={trip.id} type="button" onClick={() => onOpen(trip.id)}
            style={{ ...actionBtn, justifyContent: 'space-between', width: '100%', minHeight: 44, padding: '0 14px', background: C.soft, borderColor: C.soft, color: C.ink }}>
            <span style={{ fontWeight: 800 }}>{trip.name}</span>
            <span style={{ fontSize: 12, color: C.muted }}>{trip.stops?.length || 0} עצירות</span>
          </button>
        ))}
      </div>
    </div>
  );
}

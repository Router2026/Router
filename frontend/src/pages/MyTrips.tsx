// src/pages/MyTrips.tsx — UPDATED
// Feature 9: Share button on each trip card (awards XP).
// Also includes XpToast on share.

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import XpToast from '../components/XpToast';

const GROUP_ICONS: Record<string, string> = {
  'משפחה עם ילדים': '👨‍👩‍👧‍👦', 'משפחה': '👨‍👩‍👧‍👦',
  'חברים': '👥', 'יחיד': '🚶', 'זוג': '👫',
  'solo': '🚶', 'couple': '👫', 'family': '👨‍👩‍👧‍👦', 'friends': '👥',
};

export default function MyTrips() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<unknown[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [sharedIds, setSharedIds] = useState<Set<string>>(new Set());
  const [shareXp, setShareXp] = useState<unknown>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishedIds, setPublishedIds] = useState<Set<string>>(new Set());
  const [showPublishModal, setShowPublishModal] = useState<string | null>(null);
  const [publishDesc, setPublishDesc] = useState('');
  const [publishPOI, setPublishPOI] = useState('');
  const [publishStops, setPublishStops] = useState('');

  useEffect(() => {
    api.trips.list()
      .then(data => setTrips(data))
      .catch(err => console.error('Failed to fetch trips:', err))
      .finally(() => setIsLoading(false));
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmId !== id) { setConfirmId(id); return; }
    setDeletingId(id); setConfirmId(null);
    try {
      await api.trips.delete(id);
      setTrips(prev => prev.filter(t => String(t.id) !== id));
    } catch (err) { console.error('Delete failed:', err); }
    setDeletingId(null);
  };

  // Feature 9: share a trip and earn XP
  const handleShare = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sharingId === id) return;
    setSharingId(id);
    try {
      const result = await api.trips.share(id);
      if (result.xp_awarded && result.xp) setShareXp(result.xp);
      setSharedIds(prev => new Set(prev).add(id));
      const trip = trips.find(t => String(t.id) === id);
      if (navigator.share && trip) {
        navigator.share({ title: trip.name, url: `${window.location.origin}/TripDetail?id=${id}` }).catch(() => {});
      } else {
        navigator.clipboard.writeText(`${window.location.origin}/TripDetail?id=${id}`).catch(() => {});
      }
    } catch (err) { console.error('Share failed:', err); }
    finally { setSharingId(null); }
  };

  const handlePublish = async (id: string) => {
    setPublishingId(id);
    try {
      // First create a public trip entry linked to this private route
      const trip = trips.find(t => String(t.id) === id);
      if (!trip) return;
      const result = await api.publicTrips.create({
        title: trip.name,
        description: publishDesc || undefined,
        is_public: true,
        location_ids: (trip as { stops?: { location_id: unknown }[] }).stops?.map(s => s.location_id).filter(Boolean) || [],
      });
      if (publishPOI || publishStops) {
        await api.publicTrips.updateMedia(result.id, {
          points_of_interest: publishPOI || undefined,
          recommended_stops: publishStops || undefined,
        });
      }
      if ((result as Record<string, unknown>).xp_awarded) setShareXp((result as Record<string, unknown>).xp_awarded);
      setPublishedIds(prev => new Set(prev).add(id));
      setShowPublishModal(null);
      setPublishDesc(''); setPublishPOI(''); setPublishStops('');
    } catch (err) { console.error('Publish failed:', err); }
    finally { setPublishingId(null); }
  };

  return (
    <>
      {shareXp && <XpToast xp={shareXp} onDone={() => setShareXp(null)} />}
      <div style={{ background: '#f8fafc', minHeight: '100vh', width: '100%', direction: 'rtl' }}>
        <div style={{ background: 'linear-gradient(160deg, #0d9e6e 0%, #0bba7e 100%)', width: '100%' }}>
          <div style={{ maxWidth: 600, margin: '0 auto', padding: '48px 20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <button onClick={() => navigate('/TripPlanner')}
              style={{ background: '#fff', border: 'none', borderRadius: 12, padding: '8px 16px', cursor: 'pointer', color: '#0d9e6e', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Heebo, sans-serif', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              חדש
            </button>
            <div style={{ textAlign: 'right' }}>
              <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 900, marginBottom: 4 }}>המסלולים שלי</h1>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>כל המסלולים שיצרת במקום אחד</p>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 600, margin: '0 auto', paddingBottom: 100 }}>
          {isLoading && (
            <div style={{ padding: '80px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#0d9e6e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#64748b', marginTop: 16 }}>טוען מסלולים...</div>
            </div>
          )}

          {!isLoading && trips.length > 0 && (
            <div style={{ padding: '20px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              {trips.map(trip => {
                const id = String(trip.id);
                const isConfirming = confirmId === id;
                const isDeleting = deletingId === id;
                const isSharing = sharingId === id;
                const hasShared = sharedIds.has(id);

                return (
                  <button type="button" key={id} onClick={() => navigate(`/TripDetail?id=${id}`)}
                    style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', cursor: 'pointer', border: `1px solid ${isConfirming ? '#fecaca' : '#f0fdf8'}`, transition: 'all 0.2s ease', position: 'relative', padding: 0, textAlign: 'right', width: '100%' }}>
                    <div style={{ height: 100, background: isConfirming ? 'linear-gradient(160deg, #ef4444 0%, #f87171 100%)' : 'linear-gradient(160deg, #0d9e6e 0%, #34d399 100%)', display: 'flex', alignItems: 'flex-end', padding: '16px', transition: 'background 0.2s ease' }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>{trip.name}</div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                          {trip.region}
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 12, fontWeight: 600 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                          {trip.total_duration_hours} שעות
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 12, fontWeight: 600 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="6" r="2" /><path d="M5 8v12" /><circle cx="19" cy="18" r="2" /><path d="M19 16V4" /></svg>
                          {trip.stops?.length || 0} עצירות
                        </div>
                      </div>

                      {trip.style && (
                        <span style={{ display: 'inline-block', background: '#f0fdf8', color: '#0d9e6e', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700, marginBottom: 12 }}>{trip.style}</span>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0fdf8', paddingTop: 12, gap: 8 }}>
                        {/* Delete */}
                        <button onClick={e => handleDelete(id, e)} disabled={isDeleting}
                          style={{ background: isConfirming ? '#ef4444' : 'transparent', border: `1.5px solid ${isConfirming ? '#ef4444' : '#e2e8f0'}`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: isConfirming ? '#fff' : '#94a3b8', fontSize: 12, fontWeight: 700, fontFamily: 'Heebo, sans-serif', transition: 'all 0.2s ease' }}>
                          {isDeleting ? '...' : isConfirming ? 'מחיקה?' : '🗑'}
                        </button>

                        {/* Feature 9: Share button */}
                        <button onClick={e => handleShare(id, e)} disabled={isSharing}
                          title={hasShared ? 'שותף! +15 XP' : 'שתף מסלול וקבל +15 XP'}
                          style={{ background: hasShared ? '#f0fdf8' : 'transparent', border: `1.5px solid ${hasShared ? '#0d9e6e' : '#e2e8f0'}`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: hasShared ? '#0d9e6e' : '#94a3b8', fontSize: 12, fontWeight: 700, fontFamily: 'Heebo, sans-serif', display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.2s ease' }}>
                          {isSharing ? '⏳' : hasShared ? '✓' : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
                          )}
                          {hasShared ? 'שותף' : 'שתף'}
                        </button>

                        {/* Publish as public */}
                        {!publishedIds.has(id) && (
                          <button onClick={e => { e.stopPropagation(); setShowPublishModal(id); }}
                            title="פרסם כמסלול ציבורי וקבל +25 XP"
                            style={{ background: '#faf5ff', border: '1.5px solid #7c3aed', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: '#7c3aed', fontSize: 12, fontWeight: 700, fontFamily: 'Heebo, sans-serif', display: 'flex', alignItems: 'center', gap: 3, transition: 'all 0.2s ease' }}>
                            🌐
                          </button>
                        )}
                        {publishedIds.has(id) && (
                          <span style={{ fontSize: 11, color: '#7c3aed', fontWeight: 700, background: '#faf5ff', borderRadius: 8, padding: '4px 8px', border: '1.5px solid #7c3aed' }}>✓ ציבורי</span>
                        )}

                        <span style={{ fontSize: 16 }}>{GROUP_ICONS[trip.group_type] || '🚶'}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {!isLoading && trips.length === 0 && (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 56, marginBottom: 20 }}>🗺️</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#1a2e2a', marginBottom: 8 }}>אין מסלולים עדיין</div>
              <div style={{ fontSize: 15, color: '#64748b', marginBottom: 24 }}>צור את המסלול הראשון שלך ותתחיל לטייל!</div>
              <button onClick={() => navigate('/TripPlanner')}
                style={{ background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)', color: '#fff', border: 'none', borderRadius: 16, padding: '16px 40px', fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', boxShadow: '0 8px 20px rgba(13, 158, 110, 0.2)' }}>
                צור מסלול חדש
              </button>
            </div>
          )}
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>

      {/* ── Publish Modal ─────────────────────────────────────────────── */}
      {showPublishModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'rtl', padding: 16 }}>
          <button type="button" aria-label="סגור" onClick={() => setShowPublishModal(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'default', padding: 0 }} />
          <div style={{ background: '#fff', borderRadius: 24, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)', position: 'relative', zIndex: 1 }}>
            <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, background: '#fff', zIndex: 10, borderRadius: '24px 24px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18, color: '#0f172a' }}>🌐 פרסם מסלול ציבורי</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>יוצג בעמוד המסלולים + תקבל +25 XP</div>
              </div>
              <button onClick={() => setShowPublishModal(null)} style={{ border: 'none', background: '#f1f5f9', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', fontSize: 18, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label htmlFor="mytrips-pub-desc" style={{ fontWeight: 700, fontSize: 13, color: '#374151', display: 'block', marginBottom: 6 }}>📝 תיאור המסלול</label>
                <textarea id="mytrips-pub-desc" value={publishDesc} onChange={e => setPublishDesc(e.target.value)} rows={3}
                  placeholder="מה מיוחד במסלול? למי הוא מתאים? מה הייתם ממליצים?"
                  style={{ width: '100%', padding: '11px 13px', border: '1.5px solid #e2e8f0', borderRadius: 13, fontSize: 13, fontFamily: 'Heebo, sans-serif', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.65 }}
                  onFocus={e => e.currentTarget.style.borderColor = '#7c3aed'}
                  onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'} />
              </div>
              <div>
                <label htmlFor="mytrips-pub-poi" style={{ fontWeight: 700, fontSize: 13, color: '#374151', display: 'block', marginBottom: 6 }}>✨ נקודות עניין</label>
                <textarea id="mytrips-pub-poi" value={publishPOI} onChange={e => setPublishPOI(e.target.value)} rows={2}
                  placeholder="מפל, תצפית, עץ עתיק — מה כדאי לשים לב?"
                  style={{ width: '100%', padding: '11px 13px', border: '1.5px solid #e2e8f0', borderRadius: 13, fontSize: 13, fontFamily: 'Heebo, sans-serif', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.65 }}
                  onFocus={e => e.currentTarget.style.borderColor = '#7c3aed'}
                  onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'} />
              </div>
              <div>
                <label htmlFor="mytrips-pub-stops" style={{ fontWeight: 700, fontSize: 13, color: '#374151', display: 'block', marginBottom: 6 }}>🛑 עצירות מומלצות</label>
                <textarea id="mytrips-pub-stops" value={publishStops} onChange={e => setPublishStops(e.target.value)} rows={2}
                  placeholder="היכן מומלץ לעצור ולהתעכב?"
                  style={{ width: '100%', padding: '11px 13px', border: '1.5px solid #e2e8f0', borderRadius: 13, fontSize: 13, fontFamily: 'Heebo, sans-serif', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.65 }}
                  onFocus={e => e.currentTarget.style.borderColor = '#7c3aed'}
                  onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowPublishModal(null)}
                  style={{ flex: 1, padding: '12px', borderRadius: 13, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontSize: 14 }}>ביטול</button>
                <button onClick={() => handlePublish(showPublishModal)} disabled={!!publishingId}
                  style={{ flex: 2, padding: '12px', borderRadius: 13, border: 'none', background: publishingId ? '#94a3b8' : 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: '#fff', fontWeight: 800, cursor: publishingId ? 'default' : 'pointer', fontFamily: 'Heebo, sans-serif', fontSize: 14 }}>
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

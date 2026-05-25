// src/pages/MyPlaces.tsx
// Dashboard showing all community POIs the authenticated user has submitted.
// Displays status, allows editing (pending/rejected) and deleting (pending/rejected).

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type CommunityPoiSubmission } from '../api';
import { useAuth } from '../context/AuthContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { bg: string; color: string; border: string; label: string; icon: string }> = {
  pending:  { bg: '#fef3c7', color: '#92400e', border: '#fde68a', label: 'ממתין לאישור', icon: '⏳' },
  approved: { bg: '#dcfce7', color: '#166534', border: '#bbf7d0', label: 'מאושר ומפורסם', icon: '✅' },
  rejected: { bg: '#fee2e2', color: '#991b1b', border: '#fecaca', label: 'נדחה', icon: '❌' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.pending;
  return (
    <span style={{
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700,
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ── Place card ────────────────────────────────────────────────────────────────

function PlaceCard({
  poi,
  onEdit,
  onDelete,
}: {
  poi: CommunityPoiSubmission;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isLocked = poi.status === 'approved';
  const mainPhoto = poi.photos?.[0] ?? null;

  const createdAt = new Date(poi.created_at).toLocaleDateString('he-IL', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <div style={{
      background: '#fff', borderRadius: 18, overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #f1f5f9',
      marginBottom: 14,
    }}>
      <div style={{ display: 'flex', gap: 0 }}>
        {/* Thumbnail */}
        <div style={{
          width: 88, flexShrink: 0, background: mainPhoto ? 'none' : 'linear-gradient(135deg,#0d9e6e,#34d399)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
        }}>
          {mainPhoto
            ? <img src={mainPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : '📍'
          }
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: '12px 14px', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {poi.name}
            </div>
            <StatusBadge status={poi.status} />
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#64748b', background: '#f8fafc', borderRadius: 8, padding: '2px 8px', border: '1px solid #e2e8f0' }}>
              {poi.category}
            </span>
            {poi.region && (
              <span style={{ fontSize: 12, color: '#64748b', background: '#f8fafc', borderRadius: 8, padding: '2px 8px', border: '1px solid #e2e8f0' }}>
                📍 {poi.region}
              </span>
            )}
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{createdAt}</span>
          </div>

          {poi.admin_note && poi.status === 'rejected' && (
            <div style={{ fontSize: 12, color: '#991b1b', background: '#fff7f7', borderRadius: 8, padding: '6px 10px', marginBottom: 8, border: '1px solid #fecaca' }}>
              💬 {poi.admin_note}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            {!isLocked && (
              <button
                onClick={onEdit}
                style={{
                  padding: '6px 14px', border: '1.5px solid #0d9e6e', borderRadius: 10,
                  background: '#f0fdf4', color: '#0d9e6e', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                }}>
                ✏️ עריכה
              </button>
            )}
            {isLocked && (
              <button
                onClick={onEdit}
                style={{
                  padding: '6px 14px', border: '1.5px solid #94a3b8', borderRadius: 10,
                  background: '#f8fafc', color: '#64748b', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                }}>
                👁 צפייה
              </button>
            )}
            {!isLocked && (
              confirmDelete ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 700 }}>למחוק?</span>
                  <button
                    onClick={onDelete}
                    style={{
                      padding: '5px 12px', border: 'none', borderRadius: 9,
                      background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 800,
                      cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                    }}>כן</button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    style={{
                      padding: '5px 12px', border: '1px solid #e2e8f0', borderRadius: 9,
                      background: '#fff', color: '#64748b', fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                    }}>לא</button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  style={{
                    padding: '6px 14px', border: '1.5px solid #fecaca', borderRadius: 10,
                    background: '#fff', color: '#ef4444', fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                  }}>
                  🗑️ מחיקה
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MyPlaces() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [places, setPlaces] = useState<CommunityPoiSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    api.communityPois.myPlaces()
      .then(setPlaces)
      .catch(() => setError('שגיאה בטעינת המיקומים'))
      .finally(() => setLoading(false));
  }, [user]);

  const handleDelete = async (id: number) => {
    try {
      await api.communityPois.delete(id);
      setPlaces(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      setError(err?.message || 'שגיאה במחיקה');
    }
  };

  if (!user) {
    return (
      <div style={centered}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#1a2e2a', marginBottom: 16 }}>יש להתחבר תחילה</div>
        <button onClick={() => navigate('/Login')} style={primaryBtn}>התחבר</button>
      </div>
    );
  }

  if (loading) return <Spinner label="טוען את המיקומים שלך..." />;

  const filtered = filter === 'all' ? places : places.filter(p => p.status === filter);
  const counts = {
    all: places.length,
    pending: places.filter(p => p.status === 'pending').length,
    approved: places.filter(p => p.status === 'approved').length,
    rejected: places.filter(p => p.status === 'rejected').length,
  };

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', direction: 'rtl', fontFamily: 'Heebo, sans-serif', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#0d9e6e,#0bba7e)', padding: '16px 20px 22px', color: '#fff' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <button onClick={() => navigate('/Profile')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, padding: '6px 12px', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'Heebo, sans-serif' }}>
              ← חזרה
            </button>
            <div style={{ fontSize: 20, fontWeight: 900 }}>📍 המיקומים שלי</div>
          </div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>
            {places.length} מיקומים שהוספת למפה הקהילתית
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px 16px' }}>
        {error && (
          <div style={{ background: '#fee2e2', borderRadius: 12, padding: '12px 16px', marginBottom: 16, color: '#dc2626', fontSize: 14, fontWeight: 600 }}>
            ⚠️ {error}
          </div>
        )}

        {/* Add new place CTA */}
        <button
          onClick={() => navigate('/ContributePOI')}
          style={{
            width: '100%', padding: '14px 18px', border: '2px dashed #0d9e6e', borderRadius: 16,
            background: '#f0fdf4', color: '#0d9e6e', fontFamily: 'Heebo, sans-serif',
            fontWeight: 800, fontSize: 15, cursor: 'pointer', marginBottom: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
          ➕ הוסף מיקום חדש
        </button>

        {/* Filter tabs */}
        {places.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
            {(['all', 'pending', 'approved', 'rejected'] as const).map(f => {
              const labels: Record<string, string> = { all: 'הכל', pending: '⏳ ממתין', approved: '✅ מאושר', rejected: '❌ נדחה' };
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '7px 14px', borderRadius: 20, border: '1.5px solid',
                    borderColor: filter === f ? '#0d9e6e' : '#e2e8f0',
                    background: filter === f ? '#0d9e6e' : '#fff',
                    color: filter === f ? '#fff' : '#64748b',
                    fontFamily: 'Heebo, sans-serif', fontWeight: 700, fontSize: 13,
                    cursor: 'pointer',
                  }}>
                  {labels[f]} {counts[f] > 0 && <span style={{ opacity: 0.75 }}>({counts[f]})</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {places.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 20, padding: '48px 24px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>🗺️</div>
            <div style={{ fontWeight: 900, fontSize: 18, color: '#0f172a', marginBottom: 8 }}>
              עדיין לא הוספת מיקומים
            </div>
            <div style={{ color: '#94a3b8', fontSize: 14, maxWidth: 260, margin: '0 auto 20px' }}>
              שתף את המקומות האהובים עליך עם הקהילה וקבל XP על כל אישור!
            </div>
            <button
              onClick={() => navigate('/ContributePOI')}
              style={{ ...primaryBtn, fontSize: 15 }}>
              📍 הוסף מיקום ראשון
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '32px 0', fontSize: 15 }}>
            אין מיקומים עם הסטטוס שנבחר
          </div>
        ) : (
          filtered.map(poi => (
            <PlaceCard
              key={poi.id}
              poi={poi}
              onEdit={() => navigate(`/my-places/${poi.id}/edit`)}
              onDelete={() => handleDelete(poi.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Style helpers ─────────────────────────────────────────────────────────────

const centered: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  direction: 'rtl', fontFamily: 'Heebo, sans-serif', padding: 24,
};

const primaryBtn: React.CSSProperties = {
  padding: '12px 32px', border: 'none', borderRadius: 14,
  background: 'linear-gradient(135deg,#0d9e6e,#0bba7e)', color: '#fff',
  fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
};

function Spinner({ label }: { label: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', direction: 'rtl', fontFamily: 'Heebo, sans-serif' }}>
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0d9e6e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 12px' }}>
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <div style={{ color: '#94a3b8', fontSize: 16 }}>{label}</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
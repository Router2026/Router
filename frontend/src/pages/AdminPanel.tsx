// src/pages/AdminPanel.tsx
// Updated: adds a "Community POIs" tab for the admin to approve, edit, or reject
// pending user-contributed locations.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import type { CommunityPoiAdmin, EditModalProps, PoiStatus, Tab } from '../utils/types';

// Mask email so it's identifiable but not fully readable in screenshots.
// e.g. "omrihalifa0106@gmail.com" → "om***@gm***.com"
function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at < 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  const domainName = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : '';
  const maskedLocal = local.slice(0, Math.min(2, local.length)) + '***';
  const maskedDomain = domainName.slice(0, Math.min(2, domainName.length)) + '***' + tld;
  return `${maskedLocal}@${maskedDomain}`;
}

// ── API helpers (community POIs admin endpoints) ──────────────────────────────

async function fetchAdminPois(status?: PoiStatus): Promise<CommunityPoiAdmin[]> {
  const token = localStorage.getItem('router_auth_token');
  const qs = status ? `?status=${status}` : '';
  const res = await fetch((import.meta.env.VITE_API_URL ?? '') + `/api/admin/community-pois${qs}`, {
    headers: { Authorization: `Bearer ${token ?? ''}` },
  });
  const json = await res.json();
  return json.data ?? [];
}

async function patchAdminPoi(
  id: number,
  payload: Record<string, unknown>
): Promise<CommunityPoiAdmin> {
  const token = localStorage.getItem('router_auth_token');
  const res = await fetch((import.meta.env.VITE_API_URL ?? '') + `/api/admin/community-pois/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token ?? ''}`,
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  return json.data;
}

// ── Inline edit modal ─────────────────────────────────────────────────────────



function EditModal({ poi, onClose, onSaved }: EditModalProps) {
  const [name, setName] = useState(poi.name);
  const [category, setCategory] = useState(poi.category);
  const [description, setDescription] = useState(poi.description ?? '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const updated = await patchAdminPoi(poi.id, {
        action: 'edit', name, category, description: description || undefined,
      });
      onSaved(updated);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <button type="button" aria-label="סגור" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', border: 'none', cursor: 'default', padding: 0 }} />
      <div style={{
        background: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 420,
        direction: 'rtl', position: 'relative', zIndex: 1,
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1a2e2a', marginBottom: 16 }}>
          ✏️ ערוך מיקום
        </h3>

        {[
          { label: 'שם', value: name, set: setName, id: 'edit-modal-name' },
          { label: 'קטגוריה', value: category, set: setCategory, id: 'edit-modal-category' },
        ].map(f => (
          <div key={f.label} style={{ marginBottom: 12 }}>
            <label htmlFor={f.id} style={{
              fontSize: 12, fontWeight: 700, color: '#64748b',
              display: 'block', marginBottom: 4
            }}>{f.label}</label>
            <input id={f.id} value={f.value} onChange={e => f.set(e.target.value)}
              style={{
                width: '100%', border: '2px solid #e2e8f0', borderRadius: 10,
                padding: '10px 12px', fontSize: 14, fontFamily: 'Heebo, sans-serif',
                textAlign: 'right', outline: 'none', boxSizing: 'border-box',
              }} />
          </div>
        ))}

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="edit-modal-description" style={{
            fontSize: 12, fontWeight: 700, color: '#64748b',
            display: 'block', marginBottom: 4
          }}>תיאור</label>
          <textarea id="edit-modal-description" value={description} onChange={e => setDescription(e.target.value)}
            rows={3}
            style={{
              width: '100%', border: '2px solid #e2e8f0', borderRadius: 10,
              padding: '10px 12px', fontSize: 14, fontFamily: 'Heebo, sans-serif',
              textAlign: 'right', resize: 'none', outline: 'none', boxSizing: 'border-box',
            }} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose}
            style={{
              flex: 1, padding: '12px', border: '2px solid #e2e8f0', borderRadius: 12,
              background: '#fff', color: '#64748b', fontWeight: 700, cursor: 'pointer',
              fontFamily: 'Heebo, sans-serif',
            }}>ביטול</button>
          <button onClick={save} disabled={busy}
            style={{
              flex: 1, padding: '12px', border: 'none', borderRadius: 12,
              background: '#0d9e6e', color: '#fff', fontWeight: 800, cursor: 'pointer',
              fontFamily: 'Heebo, sans-serif', opacity: busy ? 0.7 : 1,
            }}>{busy ? '...' : 'שמור'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Community POIs tab ────────────────────────────────────────────────────────

function CommunityPoisTab() {
  const [filter, setFilter] = useState<PoiStatus | 'all'>('pending');
  const [pois, setPois] = useState<CommunityPoiAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [editing, setEditing] = useState<CommunityPoiAdmin | null>(null);
  const [rejectNote, setRejectNote] = useState<{ id: number; note: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchAdminPois(filter === 'all' ? undefined : filter)
      .then(setPois)
      .finally(() => setLoading(false));
  }, [filter]);

  const handleApprove = async (poi: CommunityPoiAdmin) => {
    setBusy(poi.id);
    try {
      const updated = await patchAdminPoi(poi.id, { action: 'approve' });
      if (updated && updated.status) {
        setPois(prev => prev.map(p => p.id === poi.id ? updated : p));
      } else {
        // Refetch to get latest state if response was malformed
        const fresh = await fetchAdminPois(filter === 'all' ? undefined : filter);
        setPois(fresh);
      }
    } catch (err) {
      console.error('Approve failed', err);
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async (id: number, note: string) => {
    setBusy(id);
    try {
      const updated = await patchAdminPoi(id, { action: 'reject', admin_note: note || undefined });
      if (updated && updated.status) {
        setPois(prev => prev.map(p => p.id === id ? updated : p));
      } else {
        const fresh = await fetchAdminPois(filter === 'all' ? undefined : filter);
        setPois(fresh);
      }
    } catch (err) {
      console.error('Reject failed', err);
    } finally {
      setBusy(null);
      setRejectNote(null);
    }
  };

  const handleEditSaved = (updated: CommunityPoiAdmin) => {
    setPois(prev => prev.map(p => p.id === updated.id ? updated : p));
    setEditing(null);
  };

  const statusColors: Record<PoiStatus, string> = {
    pending: '#f59e0b',
    approved: '#0d9e6e',
    rejected: '#ef4444',
  };
  const statusLabels: Record<PoiStatus, string> = {
    pending: 'ממתין',
    approved: 'אושר',
    rejected: 'נדחה',
  };

  const counts = {
    pending: pois.filter(p => p.status === 'pending').length,
    approved: pois.filter(p => p.status === 'approved').length,
    rejected: pois.filter(p => p.status === 'rejected').length,
  };

  return (
    <>
      {/* Filter bar */}
      <div style={{
        background: '#fff', borderRadius: 16, padding: 6,
        display: 'flex', gap: 4, marginBottom: 16,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}>
        {(['all', 'pending', 'approved', 'rejected'] as const).map(f => {
          let filterLabel: string;
          if (f === 'all') { filterLabel = 'הכל'; }
          else if (f === 'pending') { filterLabel = `ממתין (${counts.pending})`; }
          else if (f === 'approved') { filterLabel = `אושר (${counts.approved})`; }
          else { filterLabel = `נדחה (${counts.rejected})`; }
          return (
          <button key={f} onClick={() => setFilter(f)}
            style={{
              flex: 1, padding: '10px 4px', border: 'none', borderRadius: 10,
              background: filter === f ? '#0d9e6e' : 'transparent',
              color: filter === f ? '#fff' : '#64748b',
              fontWeight: 800, fontSize: 12, cursor: 'pointer',
              fontFamily: 'Heebo, sans-serif', transition: 'all 0.2s',
            }}>
            {filterLabel}
          </button>
          );
        })}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>טוען...</div>
      )}
      {!loading && pois.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
          אין מיקומים להצגה
        </div>
      )}
      {!loading && pois.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pois.map(poi => (
            <div key={poi.id} style={{
              background: '#fff', borderRadius: 18, padding: '16px 18px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              border: `1px solid ${statusColors[poi.status]}22`,
            }}>
              {/* Top row: name + status badge */}
              <div style={{
                display: 'flex', alignItems: 'flex-start',
                justifyContent: 'space-between', marginBottom: 8,
              }}>
                <span style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800,
                  background: `${statusColors[poi.status]}1a`,
                  color: statusColors[poi.status],
                }}>
                  {statusLabels[poi.status]}
                </span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: '#1a2e2a' }}>
                    {poi.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                    {poi.category} · {poi.submitter_username ?? 'אנונימי'}
                  </div>
                </div>
              </div>

              {/* Coordinates + region + description */}
              <div style={{ fontSize: 12, color: '#64748b', textAlign: 'right', marginBottom: 4 }}>
                📍 {Number.parseFloat(poi.latitude).toFixed(5)}, {Number.parseFloat(poi.longitude).toFixed(5)}
                {(poi as Record<string, unknown>).region && (
                  <span style={{ marginRight: 8, background: '#f0fdf8', color: '#0d9e6e', borderRadius: 6, padding: '1px 7px', fontWeight: 700 }}>
                    🗺️ {(poi as Record<string, unknown>).region as string}
                  </span>
                )}
              </div>
              {poi.submitter_username && (
                <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right', marginBottom: 6 }}>
                  👤 הועלה על ידי: <strong>{poi.submitter_username}</strong>
                  {poi.submitter_email && ` (${maskEmail(poi.submitter_email)})`}
                </div>
              )}
              {poi.description && (
                <div style={{
                  fontSize: 12, color: '#475569', textAlign: 'right',
                  background: '#f8fafc', borderRadius: 10, padding: '8px 12px', marginBottom: 8,
                  lineHeight: 1.5,
                }}>
                  {poi.description}
                </div>
              )}

              {/* Photo thumbnails */}
              {Array.isArray(poi.photos) && poi.photos.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {poi.photos.slice(0, 4).map(url => (
                    <img key={url} src={url} alt=""
                      style={{
                        width: 52, height: 52, borderRadius: 10,
                        objectFit: 'cover', border: '1px solid #e2e8f0',
                      }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ))}
                </div>
              )}

              {/* Admin note (if rejected) */}
              {poi.admin_note && (
                <div style={{
                  fontSize: 11, color: '#ef4444', textAlign: 'right',
                  background: '#fef2f2', borderRadius: 8, padding: '6px 10px', marginBottom: 8,
                }}>
                  הערה: {poi.admin_note}
                </div>
              )}

              {/* Actions — only for pending */}
              {poi.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  {/* Reject with note */}
                  <button
                    disabled={busy === poi.id}
                    onClick={() => setRejectNote({ id: poi.id, note: '' })}
                    style={{
                      flex: 1, padding: '10px', border: '1.5px solid #fecaca',
                      borderRadius: 12, background: 'transparent',
                      color: '#ef4444', fontWeight: 700, fontSize: 13,
                      cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                    }}>
                    {busy === poi.id ? '...' : '✗ דחה'}
                  </button>

                  {/* Edit */}
                  <button
                    disabled={busy === poi.id}
                    onClick={() => setEditing(poi)}
                    style={{
                      flex: 1, padding: '10px', border: '1.5px solid #e2e8f0',
                      borderRadius: 12, background: '#f8fafc',
                      color: '#475569', fontWeight: 700, fontSize: 13,
                      cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                    }}>
                    ✏️ ערוך
                  </button>

                  {/* Approve */}
                  <button
                    disabled={busy === poi.id}
                    onClick={() => handleApprove(poi)}
                    style={{
                      flex: 1, padding: '10px', border: 'none',
                      borderRadius: 12, background: '#0d9e6e',
                      color: '#fff', fontWeight: 800, fontSize: 13,
                      cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                      opacity: busy === poi.id ? 0.7 : 1,
                    }}>
                    {busy === poi.id ? '...' : '✓ אשר'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reject modal */}
      {rejectNote && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <button type="button" aria-label="סגור" onClick={() => setRejectNote(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', border: 'none', cursor: 'default', padding: 0 }} />
          <div style={{
            background: '#fff', borderRadius: 20, padding: 24,
            width: '100%', maxWidth: 380, direction: 'rtl', position: 'relative', zIndex: 1,
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1a2e2a', marginBottom: 12 }}>
              דחיית מיקום
            </h3>
            <label htmlFor="ap-reject-note" style={{ fontSize: 13, color: '#64748b', display: 'block', marginBottom: 8 }}>
              הערה למשתמש (אופציונלי)
            </label>
            <textarea
              id="ap-reject-note"
              value={rejectNote.note}
              onChange={e => setRejectNote({ ...rejectNote, note: e.target.value })}
              placeholder="לדוגמה: המיקום כבר קיים במפה..."
              rows={3}
              style={{
                width: '100%', border: '2px solid #e2e8f0', borderRadius: 12,
                padding: '10px 12px', fontSize: 14, fontFamily: 'Heebo, sans-serif',
                textAlign: 'right', resize: 'none', outline: 'none',
                marginBottom: 16, boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setRejectNote(null)}
                style={{
                  flex: 1, padding: '12px', border: '2px solid #e2e8f0', borderRadius: 12,
                  background: '#fff', color: '#64748b', fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                }}>ביטול</button>
              <button onClick={() => handleReject(rejectNote.id, rejectNote.note)}
                style={{
                  flex: 1, padding: '12px', border: 'none', borderRadius: 12,
                  background: '#ef4444', color: '#fff', fontWeight: 800,
                  cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                }}>דחה</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <EditModal poi={editing} onClose={() => setEditing(null)} onSaved={handleEditSaved} />
      )}
    </>
  );
}

// ── Main AdminPanel ───────────────────────────────────────────────────────────

export default function AdminPanel(_: Readonly<Record<never, never>>) {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const [tab, setTab] = useState<Tab>('community_pois');
  const [users, setUsers] = useState<unknown[]>([]);
  const [routes, setRoutes] = useState<unknown[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [stats, setStats] = useState({ users: 0, routes: 0, pending_pois: 0 });

  useEffect(() => {
    if (!isLoading && (!user || !(user as Record<string, unknown>).is_admin)) navigate('/');
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (!user || !(user as Record<string, unknown>).is_admin) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingData(true);
    Promise.all([
      api.admin.listUsers(),
      api.admin.listRoutes(),
      fetchAdminPois('pending'),
    ])
      .then(([u, r, pois]) => {
        setUsers(u);
        setRoutes(r);
        setStats({ users: u.length, routes: r.length, pending_pois: pois.length });
      })
      .finally(() => setLoadingData(false));
  }, [user]);

  const handleDeleteUser = async (id: string) => {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    setBusy(id); setConfirmDelete(null);
    await api.admin.deleteUser(id);
    setUsers(prev => prev.filter(u => String(u.id) !== id));
    setStats(s => ({ ...s, users: s.users - 1 }));
    setBusy(null);
  };

  const handleToggleAdmin = async (id: string, current: boolean) => {
    setBusy(id);
    const updated = await api.admin.toggleAdmin(id, !current);
    setUsers(prev =>
      prev.map(u => String((u as Record<string, unknown>).id) === id ? { ...(u as Record<string, unknown>), ...(updated as Record<string, unknown>), is_admin: !current } : u)
    );
    setBusy(null);
  };

  const handleDeleteRoute = async (id: string) => {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    setBusy(id); setConfirmDelete(null);
    await api.admin.deleteRoute(id);
    setRoutes(prev => prev.filter(r => String(r.id) !== id));
    setStats(s => ({ ...s, routes: s.routes - 1 }));
    setBusy(null);
  };

  if (isLoading || loadingData) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>טוען...</div>;
  }

  const TAB_BTN = (t: Tab, label: string, urgent?: boolean) => (
    <button onClick={() => { if (t === 'places') { navigate('/Admin/places'); return; } setTab(t); }}
      style={{
        flex: 1, padding: '12px 6px', border: 'none', borderRadius: 12,
        background: tab === t ? '#0d9e6e' : 'transparent',
        color: tab === t ? '#fff' : '#64748b',
        fontWeight: 800, fontSize: 12, cursor: 'pointer',
        fontFamily: 'Heebo, sans-serif', transition: 'all 0.2s',
        position: 'relative',
      }}>
      {label}
      {urgent && stats.pending_pois > 0 && tab !== t && (
        <span style={{
          position: 'absolute', top: 4, right: 4,
          width: 18, height: 18, borderRadius: '50%',
          background: '#ef4444', color: '#fff',
          fontSize: 10, fontWeight: 900,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{stats.pending_pois}</span>
      )}
    </button>
  );

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', direction: 'rtl' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 100%)', width: '100%' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 48px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => navigate('/')}
              style={{
                background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 12,
                padding: '8px 14px', cursor: 'pointer', color: '#fff', fontSize: 13,
                fontWeight: 700, fontFamily: 'Heebo, sans-serif',
              }}>← חזרה</button>
            <div style={{ textAlign: 'right' }}>
              <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 900, marginBottom: 4 }}>
                🛡 פאנל ניהול
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                ברוך הבא, {user?.username}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            {[
              { label: 'משתמשים', value: stats.users, icon: '👥' },
              { label: 'מסלולים', value: stats.routes, icon: '🗺️' },
              { label: 'ממתין אישור', value: stats.pending_pois, icon: '📍' },
            ].map(s => (
              <div key={s.label} style={{
                flex: 1, background: 'rgba(255,255,255,0.08)',
                borderRadius: 16, padding: '16px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 24 }}>{s.icon}</div>
                <div style={{
                  fontSize: 26, fontWeight: 900, color: '#fff', marginTop: 4,
                  ...(s.label === 'ממתין אישור' && s.value > 0
                    ? { color: '#fbbf24' } : {}),
                }}>{s.value}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{
        maxWidth: 720, margin: '0 auto',
        padding: '0 16px', marginTop: -20, paddingBottom: 100,
      }}>

        {/* Tabs */}
        <div style={{
          background: '#fff', borderRadius: 16, padding: 6,
          display: 'flex', gap: 4, marginBottom: 20,
          boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
        }}>
          {TAB_BTN('community_pois', '📍 מיקומי קהילה', true)}
          {TAB_BTN('places', '🗺️ כל המקומות')}
          {TAB_BTN('users', `👥 משתמשים (${users.length})`)}
          {TAB_BTN('routes', `🗺️ מסלולים (${routes.length})`)}
        </div>

        {/* Community POIs tab */}
        {tab === 'community_pois' && <CommunityPoisTab />}

        {/* Users tab */}
        {tab === 'users' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {users.map(u => {
              let toggleAdminLabel: string;
              if (busy === String(u.id)) { toggleAdminLabel = '...'; }
              else if (u.is_admin) { toggleAdminLabel = 'הסר Admin'; }
              else { toggleAdminLabel = 'הפוך Admin'; }

              let deleteUserLabel: string;
              if (busy === String(u.id)) { deleteUserLabel = '...'; }
              else if (confirmDelete === String(u.id)) { deleteUserLabel = 'מחק?'; }
              else { deleteUserLabel = '🗑'; }

              return (
              <div key={u.id} style={{
                background: '#fff', borderRadius: 16, padding: '16px 18px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                display: 'flex', alignItems: 'center', gap: 14,
                border: `1px solid ${confirmDelete === String(u.id) ? '#fecaca' : '#f1f5f9'}`,
                transition: 'border 0.2s',
              }}>
                <div style={{
                  width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                  background: u.is_admin ? '#0f172a' : '#f0fdf8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>
                  {u.is_admin ? '🛡' : '👤'}
                </div>
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#1a2e2a' }}>
                    {u.full_name || u.username}
                    {u.is_admin && (
                      <span style={{
                        marginRight: 6, fontSize: 11, background: '#0f172a',
                        color: '#fff', borderRadius: 6, padding: '2px 7px', fontWeight: 700,
                      }}>Admin</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{maskEmail(u.email)}</div>
                  <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 1 }}>
                    {u.xp_points} XP · {u.level}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button disabled={busy === String(u.id)} onClick={() => handleToggleAdmin(String(u.id), u.is_admin)}
                    style={{
                      padding: '6px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8,
                      background: u.is_admin ? '#f1f5f9' : 'transparent',
                      cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#475569',
                      fontFamily: 'Heebo, sans-serif',
                    }}>
                    {toggleAdminLabel}
                  </button>
                  <button disabled={busy === String(u.id)} onClick={() => handleDeleteUser(String(u.id))}
                    style={{
                      padding: '6px 12px', borderRadius: 8,
                      border: `1.5px solid ${confirmDelete === String(u.id) ? '#ef4444' : '#fecaca'}`,
                      background: confirmDelete === String(u.id) ? '#ef4444' : 'transparent',
                      cursor: 'pointer', fontSize: 12, fontWeight: 700,
                      color: confirmDelete === String(u.id) ? '#fff' : '#ef4444',
                      fontFamily: 'Heebo, sans-serif',
                    }}>
                    {deleteUserLabel}
                  </button>
                </div>
              </div>
              );
            })}
            {users.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>אין משתמשים</div>
            )}
          </div>
        )}

        {/* Routes tab */}
        {tab === 'routes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {routes.map(r => {
              let deleteRouteLabel: string;
              if (busy === String(r.id)) { deleteRouteLabel = '...'; }
              else if (confirmDelete === String(r.id)) { deleteRouteLabel = 'מחק?'; }
              else { deleteRouteLabel = '🗑'; }

              return (
              <div key={r.id} style={{
                background: '#fff', borderRadius: 16, padding: '16px 18px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                display: 'flex', alignItems: 'center', gap: 14,
                border: `1px solid ${confirmDelete === String(r.id) ? '#fecaca' : '#f1f5f9'}`,
                transition: 'border 0.2s',
              }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                  background: '#f0fdf8', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 20,
                }}>🗺️</div>
                <button type="button" style={{ flex: 1, textAlign: 'right', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                  onClick={() => navigate(`/TripDetail?id=${r.id}`)}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#1a2e2a' }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                    {r.region} · {r.stops?.length || 0} עצירות · {r.total_duration_hours} שעות
                  </div>
                </button>
                <button disabled={busy === String(r.id)} onClick={() => handleDeleteRoute(String(r.id))}
                  style={{
                    padding: '6px 12px', borderRadius: 8, flexShrink: 0,
                    border: `1.5px solid ${confirmDelete === String(r.id) ? '#ef4444' : '#fecaca'}`,
                    background: confirmDelete === String(r.id) ? '#ef4444' : 'transparent',
                    cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    color: confirmDelete === String(r.id) ? '#fff' : '#ef4444',
                    fontFamily: 'Heebo, sans-serif',
                  }}>
                  {deleteRouteLabel}
                </button>
              </div>
              );
            })}
            {routes.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>אין מסלולים</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
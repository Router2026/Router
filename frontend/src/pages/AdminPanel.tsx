import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

type Tab = 'users' | 'routes';

export default function AdminPanel() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [stats, setStats] = useState({ users: 0, routes: 0 });

  useEffect(() => {
    if (!isLoading && (!user || !(user as any).is_admin)) {
      navigate('/');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (!user || !(user as any).is_admin) return;
    setLoadingData(true);
    Promise.all([api.admin.listUsers(), api.admin.listRoutes()])
      .then(([u, r]) => {
        setUsers(u);
        setRoutes(r);
        setStats({ users: u.length, routes: r.length });
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
    setUsers(prev => prev.map(u => String(u.id) === id ? { ...u, ...(updated as any), is_admin: !current } : u));
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

  if (isLoading || loadingData) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>טוען...</div>
  );

  const TAB_BTN = (t: Tab, label: string) => (
    <button onClick={() => setTab(t)} style={{
      flex: 1, padding: '12px', border: 'none', borderRadius: 12,
      background: tab === t ? '#0d9e6e' : 'transparent',
      color: tab === t ? '#fff' : '#64748b',
      fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
      transition: 'all 0.2s',
    }}>{label}</button>
  );

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', direction: 'rtl' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 100%)', width: '100%' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 48px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => navigate('/')} style={{
              background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 12,
              padding: '8px 14px', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 700,
              fontFamily: 'Heebo, sans-serif',
            }}>← חזרה</button>
            <div style={{ textAlign: 'right' }}>
              <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 900, marginBottom: 4 }}>🛡 פאנל ניהול</h1>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>ברוך הבא, {user?.username}</p>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            {[
              { label: 'משתמשים', value: stats.users, icon: '👥' },
              { label: 'מסלולים', value: stats.routes, icon: '🗺️' },
            ].map(s => (
              <div key={s.label} style={{
                flex: 1, background: 'rgba(255,255,255,0.08)', borderRadius: 16,
                padding: '16px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 24 }}>{s.icon}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', marginTop: 4 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px', marginTop: -20, paddingBottom: 100 }}>

        {/* Tabs */}
        <div style={{
          background: '#fff', borderRadius: 16, padding: 6,
          display: 'flex', gap: 4, marginBottom: 20,
          boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
        }}>
          {TAB_BTN('users', `משתמשים (${users.length})`)}
          {TAB_BTN('routes', `מסלולים (${routes.length})`)}
        </div>

        {/* Users Tab */}
        {tab === 'users' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {users.map(u => (
              <div key={u.id} style={{
                background: '#fff', borderRadius: 16, padding: '16px 18px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                display: 'flex', alignItems: 'center', gap: 14,
                border: `1px solid ${confirmDelete === String(u.id) ? '#fecaca' : '#f1f5f9'}`,
                transition: 'border 0.2s',
              }}>
                {/* Avatar */}
                <div style={{
                  width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                  background: u.is_admin ? '#0f172a' : '#f0fdf8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18,
                }}>
                  {u.is_admin ? '🛡' : '👤'}
                </div>
                {/* Info */}
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#1a2e2a' }}>
                    {u.full_name || u.username}
                    {u.is_admin && (
                      <span style={{ marginRight: 6, fontSize: 11, background: '#0f172a', color: '#fff', borderRadius: 6, padding: '2px 7px', fontWeight: 700 }}>Admin</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{u.email}</div>
                  <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 1 }}>
                    {u.xp_points} XP · {u.level}
                  </div>
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    disabled={busy === String(u.id)}
                    onClick={() => handleToggleAdmin(String(u.id), u.is_admin)}
                    style={{
                      padding: '6px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8,
                      background: u.is_admin ? '#f1f5f9' : 'transparent',
                      cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#475569',
                      fontFamily: 'Heebo, sans-serif',
                    }}
                  >
                    {busy === String(u.id) ? '...' : u.is_admin ? 'הסר Admin' : 'הפוך Admin'}
                  </button>
                  <button
                    disabled={busy === String(u.id)}
                    onClick={() => handleDeleteUser(String(u.id))}
                    style={{
                      padding: '6px 12px', borderRadius: 8,
                      border: `1.5px solid ${confirmDelete === String(u.id) ? '#ef4444' : '#fecaca'}`,
                      background: confirmDelete === String(u.id) ? '#ef4444' : 'transparent',
                      cursor: 'pointer', fontSize: 12, fontWeight: 700,
                      color: confirmDelete === String(u.id) ? '#fff' : '#ef4444',
                      fontFamily: 'Heebo, sans-serif',
                    }}
                  >
                    {busy === String(u.id) ? '...' : confirmDelete === String(u.id) ? 'מחק?' : '🗑'}
                  </button>
                </div>
              </div>
            ))}
            {users.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>אין משתמשים</div>}
          </div>
        )}

        {/* Routes Tab */}
        {tab === 'routes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {routes.map(r => (
              <div key={r.id} style={{
                background: '#fff', borderRadius: 16, padding: '16px 18px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                display: 'flex', alignItems: 'center', gap: 14,
                border: `1px solid ${confirmDelete === String(r.id) ? '#fecaca' : '#f1f5f9'}`,
                transition: 'border 0.2s',
              }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                  background: '#f0fdf8', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 20,
                }}>🗺️</div>
                <div style={{ flex: 1, textAlign: 'right', cursor: 'pointer' }}
                  onClick={() => navigate(`/TripDetail?id=${r.id}`)}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#1a2e2a' }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                    {r.region} · {r.stops?.length || 0} עצירות · {r.total_duration_hours} שעות
                  </div>
                </div>
                <button
                  disabled={busy === String(r.id)}
                  onClick={() => handleDeleteRoute(String(r.id))}
                  style={{
                    padding: '6px 12px', borderRadius: 8, flexShrink: 0,
                    border: `1.5px solid ${confirmDelete === String(r.id) ? '#ef4444' : '#fecaca'}`,
                    background: confirmDelete === String(r.id) ? '#ef4444' : 'transparent',
                    cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    color: confirmDelete === String(r.id) ? '#fff' : '#ef4444',
                    fontFamily: 'Heebo, sans-serif',
                  }}
                >
                  {busy === String(r.id) ? '...' : confirmDelete === String(r.id) ? 'מחק?' : '🗑'}
                </button>
              </div>
            ))}
            {routes.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>אין מסלולים</div>}
          </div>
        )}
      </div>
    </div>
  );
}

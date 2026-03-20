// src/pages/ProfileEdit.tsx
// Avatar (URL), bio, favorite regions, social links — PATCH /users/me

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const REGIONS = ['גליל', 'גולן', 'כרמל', 'שרון', 'שפלה', 'ירושלים', 'יהודה', 'נגב', 'ערבה', 'אילת'];

export default function ProfileEdit() {
  const { user }   = useAuth();
  const navigate   = useNavigate();

  const [form, setForm] = useState({
    username:         user?.username         || '',
    full_name:        user?.full_name        || '',
    bio:              user?.bio              || '',
    avatar_url:       user?.avatar_url       || '',
    cover_image:      user?.cover_image      || '',
    favorite_regions: (user?.favorite_regions || []) as string[],
    instagram:        user?.instagram        || '',
    website:          user?.website          || '',
  });

  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  // Redirect unauthenticated users — never call navigate() during render
  useEffect(() => {
    if (!user) navigate('/Login', { replace: true });
  }, [user, navigate]);

  if (!user) return null;

  const set = (key: string, val: unknown) =>
    setForm(f => ({ ...f, [key]: val }));

  const toggleRegion = (r: string) =>
    set('favorite_regions',
      form.favorite_regions.includes(r)
        ? form.favorite_regions.filter(x => x !== r)
        : [...form.favorite_regions, r]
    );

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      await api.users.updateMe(form as any);
      setSaved(true);
      setTimeout(() => { setSaved(false); navigate('/Profile'); }, 1500);
    } catch (err: any) {
      setError(err?.code === 'USERNAME_TAKEN' ? 'שם המשתמש כבר תפוס' : 'שמירה נכשלה, נסה שנית');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 10,
    border: '1.5px solid #e2e8f0', fontSize: 14,
    fontFamily: 'Heebo, sans-serif', outline: 'none',
    boxSizing: 'border-box', direction: 'rtl',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 13, fontWeight: 600, color: '#374151',
    display: 'block', marginBottom: 6,
  };
  const cardStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 18, padding: 20,
    marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  };

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', direction: 'rtl', paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#64748b' }}>‹</button>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#1a2e2a' }}>עריכת פרופיל</div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px' }}>

        {/* Avatar URL */}
        <div style={cardStyle}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1a2e2a', marginBottom: 16 }}>תמונת פרופיל</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
              background: form.avatar_url ? 'none' : 'linear-gradient(135deg,#0d9e6e,#34d399)',
              overflow: 'hidden', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 28, color: '#fff', fontWeight: 800,
            }}>
              {form.avatar_url
                ? <img src={form.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="avatar preview" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                : (form.full_name || form.username || '?').charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>קישור לתמונה (https://)</label>
              <input
                type="url"
                value={form.avatar_url}
                onChange={e => set('avatar_url', e.target.value)}
                placeholder="https://i.imgur.com/example.jpg"
                style={{ ...inputStyle, direction: 'ltr' }}
              />
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                העלה ל-Imgur ואז הדבק את הקישור הישיר
              </div>
            </div>
          </div>
        </div>

        {/* Basic info */}
        <div style={cardStyle}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1a2e2a', marginBottom: 16 }}>מידע אישי</div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>שם מלא</label>
            <input value={form.full_name} onChange={e => set('full_name', e.target.value)} style={inputStyle} placeholder="השם שלך" />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>שם משתמש</label>
            <input value={form.username} onChange={e => set('username', e.target.value)} style={{ ...inputStyle, direction: 'ltr' }} placeholder="username" />
          </div>
          <div>
            <label style={labelStyle}>ביוגרפיה קצרה</label>
            <textarea value={form.bio} onChange={e => set('bio', e.target.value)} rows={3}
              placeholder="ספר על עצמך, האזורים האהובים עליך..."
              style={{ ...inputStyle, resize: 'vertical' } as any} />
          </div>
        </div>

        {/* Favorite regions */}
        <div style={cardStyle}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1a2e2a', marginBottom: 4 }}>אזורים מועדפים</div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 14 }}>בחר עד 5 אזורים</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {REGIONS.map(r => {
              const active = form.favorite_regions.includes(r);
              const atLimit = form.favorite_regions.length >= 5 && !active;
              return (
                <button key={r} onClick={() => !atLimit && toggleRegion(r)} disabled={atLimit}
                  style={{
                    padding: '7px 14px', borderRadius: 20,
                    border: `1.5px solid ${active ? '#0d9e6e' : '#e2e8f0'}`,
                    background: active ? '#ecfdf5' : '#f8fafc',
                    color: active ? '#0d9e6e' : atLimit ? '#cbd5e1' : '#64748b',
                    fontFamily: 'Heebo, sans-serif', fontWeight: active ? 700 : 500,
                    fontSize: 13, cursor: atLimit ? 'default' : 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {active ? '✓ ' : ''}{r}
                </button>
              );
            })}
          </div>
        </div>

        {/* Social links */}
        <div style={cardStyle}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1a2e2a', marginBottom: 16 }}>קישורים חברתיים</div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>📸 Instagram</label>
            <input value={form.instagram} onChange={e => set('instagram', e.target.value)}
              placeholder="@username" style={{ ...inputStyle, direction: 'ltr' }} />
          </div>
          <div>
            <label style={labelStyle}>🌐 אתר אישי</label>
            <input value={form.website} onChange={e => set('website', e.target.value)}
              placeholder="https://mysite.com" style={{ ...inputStyle, direction: 'ltr' }} />
          </div>
        </div>

        {/* Cover image */}
        <div style={cardStyle}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1a2e2a', marginBottom: 12 }}>תמונת כיסוי</div>
          <input value={form.cover_image} onChange={e => set('cover_image', e.target.value)}
            placeholder="https://example.com/cover.jpg" style={{ ...inputStyle, direction: 'ltr' }} />
          {form.cover_image && (
            <img src={form.cover_image} alt="cover preview"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 10, marginTop: 10 }} />
          )}
        </div>

        {error && (
          <div style={{ background: '#fef2f2', borderRadius: 10, padding: '10px 14px', color: '#ef4444', fontWeight: 600, fontSize: 14, marginBottom: 16 }}>
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%', padding: '14px', border: 'none', borderRadius: 14,
            background: saved ? '#16a34a' : saving ? '#94a3b8' : 'linear-gradient(135deg,#0d9e6e,#0bba7e)',
            color: '#fff', fontFamily: 'Heebo, sans-serif',
            fontWeight: 800, fontSize: 16, cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'background 0.3s',
          }}
        >
          {saving ? '⏳ שומר...' : saved ? '✅ נשמר בהצלחה!' : 'שמור שינויים'}
        </button>
      </div>
    </div>
  );
}

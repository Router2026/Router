// src/pages/ProfileEdit.tsx — UPDATED
// Feature 6: loads existing profile data from DB (not just AuthContext which may be stale).
// Feature 7: avatar upload from computer via file picker.

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fileToBase64 } from '../api';
import { useAuth } from '../context/AuthContext';

const REGIONS = ['גליל', 'גולן', 'כרמל', 'שרון', 'שפלה', 'ירושלים', 'יהודה', 'נגב', 'ערבה', 'אילת'];

export default function ProfileEdit() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    username: '', full_name: '', bio: '', avatar_url: '',
    cover_image: '', favorite_regions: [] as string[],
    instagram: '', website: '',
  });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/Login', { replace: true }); return; }
    // Feature 6: always fetch fresh profile from DB
    api.users.me()
      .then(profile => {
        setForm({
          username:         profile.username         || '',
          full_name:        profile.full_name         || '',
          bio:              profile.bio               || '',
          avatar_url:       profile.avatar_url        || '',
          cover_image:      profile.cover_image       || '',
          favorite_regions: profile.favorite_regions  || [],
          instagram:        profile.instagram         || '',
          website:          profile.website           || '',
        });
      })
      .catch(() => {
        // Fallback to AuthContext user data
        setForm({
          username:         user.username         || '',
          full_name:        user.full_name         || '',
          bio:              (user as any).bio      || '',
          avatar_url:       (user as any).avatar_url || '',
          cover_image:      (user as any).cover_image || '',
          favorite_regions: (user as any).favorite_regions || [],
          instagram:        (user as any).instagram || '',
          website:          (user as any).website  || '',
        });
      })
      .finally(() => setLoadingProfile(false));
  }, [user]);

  if (!user) return null;
  if (loadingProfile) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#94a3b8', fontFamily: 'Heebo, sans-serif' }}>
        טוען פרופיל...
      </div>
    );
  }

  const set = (key: string, val: unknown) => setForm(f => ({ ...f, [key]: val }));
  const toggleRegion = (r: string) =>
    set('favorite_regions', form.favorite_regions.includes(r)
      ? form.favorite_regions.filter(x => x !== r)
      : [...form.favorite_regions, r]);

  // File upload helper for avatar / cover
  const handleImageFile = async (
    file: File,
    field: 'avatar_url' | 'cover_image',
    setUploading: (v: boolean) => void,
  ) => {
    if (file.size > 5 * 1024 * 1024) { setError('הקובץ גדול מדי (מקסימום 5 MB)'); return; }
    setUploading(true);
    setError(null);
    try {
      const b64 = await fileToBase64(file);
      set(field, b64);
    } catch {
      setError('שגיאה בטעינת הקובץ');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await api.users.deleteMe();
      logout();
      navigate('/', { replace: true });
    } catch {
      setError('מחיקת החשבון נכשלה, נסה שנית');
      setDeleting(false);
    }
  };

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
  const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 };
  const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 18, padding: 20, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' };

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', direction: 'rtl', paddingBottom: 60 }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#64748b' }}>‹</button>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#1a2e2a' }}>עריכת פרופיל</div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px' }}>

        {/* Avatar */}
        <div style={cardStyle}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1a2e2a', marginBottom: 16 }}>תמונת פרופיל</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', flexShrink: 0, background: form.avatar_url ? 'none' : 'linear-gradient(135deg,#0d9e6e,#34d399)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#fff', fontWeight: 800, border: '3px solid #e2e8f0' }}>
              {form.avatar_url
                ? <img src={form.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="avatar" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; (e.currentTarget as HTMLImageElement).onerror = null; }} />
                : (form.full_name || form.username || '?').charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* File picker — Feature 7 */}
              <input type="file" ref={avatarFileRef} accept="image/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f, 'avatar_url', setAvatarUploading); }} />
              <button onClick={() => avatarFileRef.current?.click()} disabled={avatarUploading}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #0d9e6e', background: '#f0fdf8', color: '#0d9e6e', fontFamily: 'Heebo, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                {avatarUploading ? '⏳ טוען...' : '📁 העלה מהמחשב'}
              </button>
              <label style={{ ...labelStyle, marginBottom: 0 }}>או קישור (URL)</label>
              <input type="url" value={form.avatar_url.startsWith('data:') ? '' : form.avatar_url}
                onChange={e => set('avatar_url', e.target.value)}
                placeholder="https://i.imgur.com/example.jpg"
                style={{ ...inputStyle, direction: 'ltr' }} />
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
                  style={{ padding: '7px 14px', borderRadius: 20, border: `1.5px solid ${active ? '#0d9e6e' : '#e2e8f0'}`, background: active ? '#ecfdf5' : '#f8fafc', color: active ? '#0d9e6e' : atLimit ? '#cbd5e1' : '#64748b', fontFamily: 'Heebo, sans-serif', fontWeight: active ? 700 : 500, fontSize: 13, cursor: atLimit ? 'default' : 'pointer', transition: 'all 0.15s' }}>
                  {active ? '✓ ' : ''}{r}
                </button>
              );
            })}
          </div>
        </div>

        {/* Social */}
        <div style={cardStyle}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1a2e2a', marginBottom: 16 }}>קישורים חברתיים</div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>📸 Instagram</label>
            <input value={form.instagram} onChange={e => set('instagram', e.target.value)} placeholder="@username" style={{ ...inputStyle, direction: 'ltr' }} />
          </div>
          <div>
            <label style={labelStyle}>🌐 אתר אישי</label>
            <input value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://mysite.com" style={{ ...inputStyle, direction: 'ltr' }} />
          </div>
        </div>

        {/* Cover image */}
        <div style={cardStyle}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1a2e2a', marginBottom: 12 }}>תמונת כיסוי</div>
          <input type="file" ref={coverFileRef} accept="image/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f, 'cover_image', setCoverUploading); }} />
          <button onClick={() => coverFileRef.current?.click()} disabled={coverUploading}
            style={{ width: '100%', marginBottom: 10, padding: '8px', borderRadius: 10, border: '1.5px solid #0d9e6e', background: '#f0fdf8', color: '#0d9e6e', fontFamily: 'Heebo, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            {coverUploading ? '⏳ טוען...' : '📁 העלה תמונת כיסוי מהמחשב'}
          </button>
          <input value={form.cover_image.startsWith('data:') ? '' : form.cover_image}
            onChange={e => set('cover_image', e.target.value)}
            placeholder="https://example.com/cover.jpg" style={{ ...inputStyle, direction: 'ltr' }} />
          {form.cover_image && (
            <img src={form.cover_image} alt="cover preview"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; (e.currentTarget as HTMLImageElement).onerror = null; }}
              style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 10, marginTop: 10 }} />
          )}
        </div>

        {error && (
          <div style={{ background: '#fef2f2', borderRadius: 10, padding: '10px 14px', color: '#ef4444', fontWeight: 600, fontSize: 14, marginBottom: 16 }}>
            ⚠️ {error}
          </div>
        )}

        <button onClick={handleSave} disabled={saving}
          style={{ width: '100%', padding: '14px', border: 'none', borderRadius: 14, background: saved ? '#16a34a' : saving ? '#94a3b8' : 'linear-gradient(135deg,#0d9e6e,#0bba7e)', color: '#fff', fontFamily: 'Heebo, sans-serif', fontWeight: 800, fontSize: 16, cursor: saving ? 'not-allowed' : 'pointer', transition: 'background 0.3s' }}>
          {saving ? '⏳ שומר...' : saved ? '✅ נשמר בהצלחה!' : 'שמור שינויים'}
        </button>

        {/* Delete account */}
        <div style={{ marginTop: 32, background: '#fff', borderRadius: 18, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1.5px solid #fee2e2' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#dc2626', marginBottom: 8 }}>מחיקת חשבון</div>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16, lineHeight: 1.6 }}>
            פעולה זו תמחק לצמיתות את החשבון שלך ואת כל הנתונים המשויכים אליו. לא ניתן לבטל פעולה זו.
          </p>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
            הקלד <strong>מחק את החשבון שלי</strong> לאישור:
          </label>
          <input
            value={deleteConfirmText}
            onChange={e => setDeleteConfirmText(e.target.value)}
            placeholder="מחק את החשבון שלי"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #fca5a5', fontSize: 14, fontFamily: 'Heebo, sans-serif', outline: 'none', boxSizing: 'border-box', direction: 'rtl', marginBottom: 12 }}
          />
          <button
            onClick={handleDeleteAccount}
            disabled={deleteConfirmText !== 'מחק את החשבון שלי' || deleting}
            style={{ width: '100%', padding: '12px', border: 'none', borderRadius: 12, background: deleteConfirmText === 'מחק את החשבון שלי' && !deleting ? '#dc2626' : '#f1f5f9', color: deleteConfirmText === 'מחק את החשבון שלי' && !deleting ? '#fff' : '#94a3b8', fontFamily: 'Heebo, sans-serif', fontWeight: 800, fontSize: 15, cursor: deleteConfirmText === 'מחק את החשבון שלי' && !deleting ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}
          >
            {deleting ? '⏳ מוחק חשבון...' : '🗑️ מחק חשבון לצמיתות'}
          </button>
        </div>
      </div>
    </div>
  );
}

// src/pages/EditMyPlace.tsx
// Allows the authenticated owner of a community POI to edit its details and photos.
// Only pending/rejected POIs can be edited — approved ones are locked.

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type CommunityPoiSubmission, fileToBase64 } from '../api';
import { useAuth } from '../context/AuthContext';
import { CATEGORIES } from '../utils/constants';

const DIFFICULTIES = ['קל - משפחות', 'קל', 'בינוני', 'קשה', 'מאתגר'];

// ── Status badge helper ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    pending:  { bg: '#fef3c7', color: '#d97706', label: '⏳ ממתין לאישור' },
    approved: { bg: '#dcfce7', color: '#16a34a', label: '✅ מאושר' },
    rejected: { bg: '#fee2e2', color: '#dc2626', label: '❌ נדחה' },
  };
  const c = cfg[status] ?? cfg.pending;
  return (
    <span style={{
      background: c.bg, color: c.color, borderRadius: 20, padding: '4px 12px',
      fontWeight: 700, fontSize: 13,
    }}>
      {c.label}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function EditMyPlace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [poi, setPoi] = useState<CommunityPoiSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState('טבע');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<string>('');
  const [hasWater, setHasWater] = useState<boolean | null>(null);
  const [hasShade, setHasShade] = useState<boolean | null>(null);
  const [accessible, setAccessible] = useState<boolean | null>(null);
  const [photoCredit, setPhotoCredit] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load existing POI ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!id || !user) { setLoading(false); return; }
    api.communityPois.get(parseInt(id))
      .then(p => {
        // Authorization guard: only owner may access this page
        if (p.user_id !== null && String(p.user_id) !== String(user.id)) {
          setError('אין לך הרשאה לערוך מיקום זה');
          setLoading(false);
          return;
        }
        setPoi(p);
        setName(p.name);
        setCategory(p.category);
        setDescription(p.description ?? '');
        setDifficulty(p.difficulty ?? '');
        setDurationMinutes(p.duration_minutes != null ? String(p.duration_minutes) : '');
        setHasWater(p.has_water ?? null);
        setHasShade(p.has_shade ?? null);
        setAccessible(p.accessible ?? null);
        setPhotoCredit(p.photo_credit ?? '');
        setPhotos(p.photos ?? []);
      })
      .catch(() => setError('לא ניתן לטעון את המיקום'))
      .finally(() => setLoading(false));
  }, [id, user]);

  // ── Photo upload ───────────────────────────────────────────────────────────

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const MAX_PHOTOS = 5;
    if (photos.length + files.length > MAX_PHOTOS) {
      setError(`ניתן להעלות עד ${MAX_PHOTOS} תמונות בסך הכל`);
      return;
    }

    setUploadingPhoto(true);
    setError(null);
    try {
      const urls = await Promise.all(
        files.map(f => api.locations.uploadPendingMedia(f))
      );
      setPhotos(prev => [...prev, ...urls]);
    } catch {
      setError('שגיאה בהעלאת התמונה, נסה שוב');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePhoto = (idx: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!id || !poi) return;
    if (!name.trim()) { setError('יש להזין שם'); return; }

    setSaving(true);
    setError(null);
    try {
      await api.communityPois.update(parseInt(id), {
        name: name.trim(),
        category,
        description: description.trim() || null,
        photos,
        difficulty: difficulty || undefined,
        duration_minutes: durationMinutes ? parseInt(durationMinutes) : null,
        has_water: hasWater,
        has_shade: hasShade,
        accessible,
        photo_credit: photoCredit.trim() || null,
      });
      setSuccess(true);
      setTimeout(() => navigate('/my-places'), 1200);
    } catch (err: any) {
      setError(err?.message || 'שגיאה בשמירה, נסה שוב');
    } finally {
      setSaving(false);
    }
  };

  // ── Render states ──────────────────────────────────────────────────────────

  if (!user) {
    return (
      <div style={centered}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#1a2e2a', marginBottom: 16 }}>יש להתחבר תחילה</div>
        <button onClick={() => navigate('/Login')} style={primaryBtn}>התחבר</button>
      </div>
    );
  }

  if (loading) return <Spinner label="טוען מיקום..." />;

  if (error && !poi) {
    return (
      <div style={centered}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>😕</div>
        <div style={{ fontSize: 16, color: '#ef4444', marginBottom: 16, fontWeight: 700 }}>{error}</div>
        <button onClick={() => navigate(-1)} style={primaryBtn}>חזרה</button>
      </div>
    );
  }

  if (!poi) return null;

  const isLocked = poi.status === 'approved';

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', direction: 'rtl', fontFamily: 'Heebo, sans-serif', paddingBottom: 80 }}>
      {/* ── Header ── */}
      <div style={{ background: 'linear-gradient(135deg,#0d9e6e,#0bba7e)', padding: '16px 20px 20px', color: '#fff', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, maxWidth: 600, margin: '0 auto' }}>
          <button onClick={() => navigate(-1)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, padding: '6px 12px', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'Heebo, sans-serif' }}>← חזרה</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>✏️ עריכת מיקום</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{poi.name}</div>
          </div>
          <StatusBadge status={poi.status} />
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px' }}>

        {/* Approved lock notice */}
        {isLocked && (
          <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 14, padding: '14px 18px', marginBottom: 18, color: '#92400e', fontSize: 14, fontWeight: 600 }}>
            🔒 מיקום זה אושר ופורסם במפה. לעריכה יש לפנות אל הצוות שלנו.
          </div>
        )}

        {/* Admin note */}
        {poi.admin_note && (
          <div style={{ background: '#fff7f7', border: '1.5px solid #fecaca', borderRadius: 14, padding: '14px 18px', marginBottom: 18 }}>
            <div style={{ fontWeight: 800, color: '#dc2626', marginBottom: 4, fontSize: 14 }}>💬 הערת מנהל</div>
            <div style={{ color: '#7f1d1d', fontSize: 14 }}>{poi.admin_note}</div>
          </div>
        )}

        {/* Success */}
        {success && (
          <div style={{ background: '#dcfce7', border: '1.5px solid #bbf7d0', borderRadius: 14, padding: '14px 18px', marginBottom: 18, color: '#166534', fontWeight: 700, fontSize: 14, textAlign: 'center' }}>
            ✅ המיקום עודכן בהצלחה!
          </div>
        )}

        {/* Error */}
        {error && poi && (
          <div style={{ background: '#fee2e2', border: '1.5px solid #fecaca', borderRadius: 14, padding: '12px 16px', marginBottom: 16, color: '#dc2626', fontSize: 14, fontWeight: 600 }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── Form card ── */}
        <div style={card}>
          <Label>שם המיקום *</Label>
          <input
            value={name} onChange={e => setName(e.target.value)}
            disabled={isLocked}
            placeholder="שם המיקום"
            style={input(isLocked)}
          />

          <Label>קטגוריה</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                onClick={() => !isLocked && setCategory(c.id)}
                disabled={isLocked}
                style={{
                  padding: '7px 14px', borderRadius: 20, border: '1.5px solid',
                  borderColor: category === c.id ? '#0d9e6e' : '#e2e8f0',
                  background: category === c.id ? '#f0fdf4' : '#fff',
                  color: category === c.id ? '#0d9e6e' : '#475569',
                  fontFamily: 'Heebo, sans-serif', fontWeight: 700, fontSize: 13,
                  cursor: isLocked ? 'default' : 'pointer', opacity: isLocked ? 0.65 : 1,
                }}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>

          <Label>תיאור</Label>
          <textarea
            value={description} onChange={e => setDescription(e.target.value)}
            disabled={isLocked}
            placeholder="תאר את המיקום..."
            rows={4}
            style={{ ...input(isLocked), resize: 'vertical', minHeight: 90 }}
          />

          <Label>רמת קושי</Label>
          <select
            value={difficulty} onChange={e => setDifficulty(e.target.value)}
            disabled={isLocked}
            style={input(isLocked)}>
            <option value="">— לא נבחר —</option>
            {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          <Label>זמן מוערך (דקות)</Label>
          <input
            type="number" min="0" max="999"
            value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)}
            disabled={isLocked}
            placeholder="למשל: 45"
            style={input(isLocked)}
          />

          {/* Toggles */}
          <Label>מאפיינים</Label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
            {([
              { key: 'hasWater', label: '💧 יש מים', val: hasWater, set: setHasWater },
              { key: 'hasShade', label: '🌳 יש צל', val: hasShade, set: setHasShade },
              { key: 'accessible', label: '♿ נגיש', val: accessible, set: setAccessible },
            ] as const).map(({ key, label, val, set }) => (
              <button
                key={key}
                onClick={() => !isLocked && set(val === true ? null : val === false ? true : false)}
                disabled={isLocked}
                title={val === null ? 'לא ידוע' : val ? 'כן' : 'לא'}
                style={{
                  padding: '8px 14px', borderRadius: 20, border: '1.5px solid',
                  borderColor: val === true ? '#0d9e6e' : val === false ? '#ef4444' : '#e2e8f0',
                  background: val === true ? '#f0fdf4' : val === false ? '#fef2f2' : '#fff',
                  color: val === true ? '#0d9e6e' : val === false ? '#ef4444' : '#94a3b8',
                  fontFamily: 'Heebo, sans-serif', fontWeight: 700, fontSize: 13,
                  cursor: isLocked ? 'default' : 'pointer', opacity: isLocked ? 0.65 : 1,
                }}>
                {label} {val === true ? '✓' : val === false ? '✗' : '?'}
              </button>
            ))}
          </div>

          <Label>קרדיט לצלם</Label>
          <input
            value={photoCredit} onChange={e => setPhotoCredit(e.target.value)}
            disabled={isLocked}
            placeholder="שם הצלם (אופציונלי)"
            style={input(isLocked)}
          />
        </div>

        {/* ── Photos ── */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#1a2e2a' }}>📸 תמונות ({photos.length}/5)</div>
            {!isLocked && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto || photos.length >= 5}
                style={{
                  padding: '8px 14px', border: 'none', borderRadius: 10,
                  background: uploadingPhoto || photos.length >= 5 ? '#e2e8f0' : '#0d9e6e',
                  color: uploadingPhoto || photos.length >= 5 ? '#94a3b8' : '#fff',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                }}>
                {uploadingPhoto ? '⏳ מעלה...' : '+ הוסף תמונה'}
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handlePhotoUpload}
          />

          {photos.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '24px 0', fontSize: 14 }}>
              אין תמונות עדיין
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {photos.map((url, i) => (
                <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', background: '#f1f5f9' }}>
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {!isLocked && (
                    <button
                      onClick={() => removePhoto(i)}
                      style={{
                        position: 'absolute', top: 4, left: 4, width: 24, height: 24,
                        borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: 'none',
                        color: '#fff', fontSize: 14, cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                      }}>
                      ×
                    </button>
                  )}
                  {i === 0 && (
                    <div style={{ position: 'absolute', bottom: 4, right: 4, background: 'rgba(13,158,110,0.85)', color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: 6, padding: '2px 6px' }}>
                      ראשי
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Actions ── */}
        {!isLocked && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleSave}
              disabled={saving || success}
              style={{
                flex: 1, padding: '15px 0', border: 'none', borderRadius: 16,
                background: saving || success ? '#a7f3d0' : 'linear-gradient(135deg,#0d9e6e,#0bba7e)',
                color: '#fff', fontSize: 16, fontWeight: 900, cursor: 'pointer',
                fontFamily: 'Heebo, sans-serif', boxShadow: '0 4px 14px rgba(13,158,110,0.3)',
              }}>
              {saving ? '⏳ שומר...' : success ? '✅ נשמר!' : '💾 שמור שינויים'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Style helpers ──────────────────────────────────────────────────────────────

const centered: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  direction: 'rtl', fontFamily: 'Heebo, sans-serif', padding: 24,
};

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 18, padding: '18px 18px 6px',
  boxShadow: '0 2px 10px rgba(0,0,0,0.06)', marginBottom: 16,
};

const primaryBtn: React.CSSProperties = {
  padding: '12px 32px', border: 'none', borderRadius: 14,
  background: 'linear-gradient(135deg,#0d9e6e,#0bba7e)', color: '#fff',
  fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
};

function input(disabled: boolean): React.CSSProperties {
  return {
    width: '100%', padding: '11px 14px', border: '1.5px solid',
    borderColor: disabled ? '#f0f0f0' : '#e2e8f0',
    borderRadius: 12, fontSize: 15, fontFamily: 'Heebo, sans-serif',
    color: '#1a2e2a', background: disabled ? '#f8fafc' : '#fff',
    outline: 'none', marginBottom: 14, boxSizing: 'border-box',
  };
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>
      {children}
    </div>
  );
}

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
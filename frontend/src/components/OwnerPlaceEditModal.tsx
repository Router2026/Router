// src/components/OwnerPlaceEditModal.tsx
//
// Slide-up modal shown to the owner of an approved community POI from within POIDetail.
// Splits editable fields into two groups:
//
//   1. Text / image fields — saved immediately without re-approval.
//      (name, category, description, difficulty, duration, water/shade/accessible,
//       photo_credit, photos/images)
//
//   2. Location (lat/lng) — behind a warning banner; triggers pending review
//      but keeps the place on the map.

import { useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { api, type POI } from '../api';
import { CATEGORIES } from '../utils/constants';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

// ── helpers ───────────────────────────────────────────────────────────────────

const DIFFICULTIES = ['קל - משפחות', 'קל', 'בינוני', 'קשה', 'מאתגר'];

function Toggle({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean | null) => void }) {
  // Cycles: null → true → false → null
  const next = value === null ? true : value === true ? false : null;
  const bg = value === true ? '#0d9e6e' : value === false ? '#ef4444' : '#d1d5db';
  const knobLeft = value === true ? 22 : value === null ? 12 : 2;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f4f3' }}>
      <span style={{ fontSize: 14, color: '#374151', fontWeight: 600 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{value === null ? 'לא ידוע' : value ? 'כן' : 'לא'}</span>
        <button type="button" onClick={() => onChange(next)} aria-label={label}
          style={{ width: 44, height: 24, borderRadius: 12, background: bg, position: 'relative', cursor: 'pointer', transition: 'background 0.18s', flexShrink: 0, border: 'none', padding: 0 }}>
          <div style={{ position: 'absolute', top: 2, left: knobLeft, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.18s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
        </button>
      </div>
    </div>
  );
}

function MapPicker({ lat, lng, onChange }: { lat: number; lng: number; onChange: (lat: number, lng: number) => void }) {
  function Events() {
    useMapEvents({ click(e) { onChange(e.latlng.lat, e.latlng.lng); } });
    return null;
  }
  return (
    <div style={{ height: 200, borderRadius: 12, overflow: 'hidden', border: '2px solid #e2e8f0', marginBottom: 8 }}>
      <MapContainer center={[lat || 31.5, lng || 35.0]} zoom={12} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {!!(lat && lng) && <Marker position={[lat, lng]} />}
        <Events />
      </MapContainer>
    </div>
  );
}

// ── section tab ───────────────────────────────────────────────────────────────

type Section = 'details' | 'photos' | 'location';

// ── main ─────────────────────────────────────────────────────────────────────

export interface OwnerPlaceEditModalProps {
  poi: POI;
  communityPoiId: number;
  onClose: () => void;
  onSaved: (updatedPoi: POI, pendingReview: boolean) => void;
}

export default function OwnerPlaceEditModal({ poi, communityPoiId, onClose, onSaved }: OwnerPlaceEditModalProps) {
  const [section, setSection] = useState<Section>('details');

  // Text fields
  const [name, setName] = useState(poi.name);
  const [category, setCategory] = useState(poi.category);
  const [description, setDescription] = useState(poi.description ?? '');
  const [difficulty, setDifficulty] = useState(poi.difficulty ?? '');
  const [durationMinutes, setDurationMinutes] = useState(poi.duration_minutes != null ? String(poi.duration_minutes) : '');
  const [hasWater, setHasWater] = useState<boolean | null>(poi.has_water ?? null);
  const [hasShade, setHasShade] = useState<boolean | null>(poi.has_shade ?? null);
  const [accessible, setAccessible] = useState<boolean | null>(poi.accessible ?? null);
  const [photoCredit, setPhotoCredit] = useState(poi.photo_credit ?? '');

  // Photos
  const [photos, setPhotos] = useState<string[]>(poi.images ?? []);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Location
  const [lat, setLat] = useState(poi.latitude);
  const [lng, setLng] = useState(poi.longitude);
  const [locationWarningAccepted, setLocationWarningAccepted] = useState(false);

  const locationChanged = Math.abs(lat - poi.latitude) > 0.00001 || Math.abs(lng - poi.longitude) > 0.00001;

  // Save state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // ── photo upload ────────────────────────────────────────────────────────────

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (photos.length + files.length > 5) { setError('עד 5 תמונות בסך הכל'); return; }
    setUploadingPhoto(true); setError(null);
    try {
      const urls = await Promise.all(files.map(f => api.locations.uploadPendingMedia(f)));
      setPhotos(prev => [...prev, ...urls]);
    } catch { setError('שגיאה בהעלאת התמונה'); }
    finally { setUploadingPhoto(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  // ── save ────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!name.trim()) { setError('יש להזין שם'); return; }
    if (locationChanged && !locationWarningAccepted) {
      setError('יש לאשר את אזהרת שינוי המיקום לפני השמירה');
      setSection('location');
      return;
    }

    setSaving(true); setError(null);
    try {
      const result = await api.communityPois.ownerEdit(communityPoiId, {
        name: name.trim(),
        category,
        description: description.trim() || undefined,
        photos,
        difficulty: difficulty || undefined,
        duration_minutes: durationMinutes ? Number.parseInt(durationMinutes) : null,
        has_water: hasWater,
        has_shade: hasShade,
        accessible,
        photo_credit: photoCredit.trim() || null,
        ...(locationChanged ? { latitude: lat, longitude: lng } : {}),
      });

      setSuccess(true);

      // Merge changes back into the POI object for the parent
      const updatedPoi: POI = {
        ...poi,
        name: name.trim(),
        category,
        description: description.trim(),
        difficulty,
        duration_minutes: durationMinutes ? Number.parseInt(durationMinutes) : undefined,
        has_water: hasWater ?? undefined,
        has_shade: hasShade ?? undefined,
        accessible: accessible ?? undefined,
        photo_credit: photoCredit.trim() || undefined,
        images: photos,
        main_image: photos[0] ?? poi.main_image,
        latitude: lat,
        longitude: lng,
      };

      setTimeout(() => onSaved(updatedPoi, result.pending_review), 900);
    } catch (err) {
      setError((err as Error)?.message || 'שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };

  // ── render ──────────────────────────────────────────────────────────────────

  const tabs: { key: Section; label: string }[] = [
    { key: 'details', label: '📝 פרטים' },
    { key: 'photos',  label: `📸 תמונות (${photos.length})` },
    { key: 'location', label: '📍 מיקום' },
  ];

  return (
    <>
      {/* Backdrop */}
      <button type="button" aria-label="סגור" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 900, backdropFilter: 'blur(2px)', border: 'none', cursor: 'default', padding: 0 }} />

      {/* Sheet */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 901,
        background: '#fff', borderRadius: '22px 22px 0 0',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        fontFamily: 'Heebo, sans-serif', direction: 'rtl',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
          <div style={{ width: 38, height: 4, borderRadius: 2, background: '#d1d5db' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 10px' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>✏️ עריכת מקום</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{poi.name}</div>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', fontSize: 18, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* Section tabs */}
        <div style={{ display: 'flex', padding: '0 16px', gap: 6, marginBottom: 2 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setSection(t.key)} style={{
              flex: 1, padding: '9px 0', border: 'none', borderRadius: 12,
              background: section === t.key ? '#0d9e6e' : '#f1f5f9',
              color: section === t.key ? '#fff' : '#64748b',
              fontFamily: 'Heebo, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              ...(t.key === 'location' && locationChanged ? { outline: '2px solid #f59e0b', outlineOffset: 1 } : {}),
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 24px' }}>

          {/* ── Details ── */}
          {section === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <Label>שם המקום *</Label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="שם המיקום" style={inputStyle} />
              </div>

              <div>
                <Label>קטגוריה</Label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {CATEGORIES.map(c => (
                    <button key={c.id} onClick={() => setCategory(c.id)} style={{
                      padding: '6px 12px', borderRadius: 20, border: '1.5px solid',
                      borderColor: category === c.id ? '#0d9e6e' : '#e2e8f0',
                      background: category === c.id ? '#f0fdf4' : '#fff',
                      color: category === c.id ? '#0d9e6e' : '#64748b',
                      fontFamily: 'Heebo, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    }}>{c.icon} {c.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <Label>תיאור</Label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="תאר את המקום..." rows={3}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }} />
              </div>

              <div>
                <Label>רמת קושי</Label>
                <select value={difficulty} onChange={e => setDifficulty(e.target.value)} style={inputStyle}>
                  <option value="">— לא נבחר —</option>
                  {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div>
                <Label>זמן מוערך (דקות)</Label>
                <input type="number" min="0" max="999" value={durationMinutes}
                  onChange={e => setDurationMinutes(e.target.value)} placeholder="למשל: 45" style={inputStyle} />
              </div>

              <div>
                <Label>מאפיינים</Label>
                <div style={{ background: '#f8fafc', borderRadius: 12, padding: '4px 14px' }}>
                  <Toggle label="💧 יש מים"  value={hasWater}   onChange={setHasWater} />
                  <Toggle label="🌳 יש צל"   value={hasShade}   onChange={setHasShade} />
                  <Toggle label="♿ נגיש"    value={accessible} onChange={setAccessible} />
                </div>
              </div>

              <div>
                <Label>קרדיט לצלם</Label>
                <input value={photoCredit} onChange={e => setPhotoCredit(e.target.value)}
                  placeholder="שם הצלם (אופציונלי)" style={inputStyle} />
              </div>
            </div>
          )}

          {/* ── Photos ── */}
          {section === 'photos' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <Label>תמונות ({photos.length}/5)</Label>
                <button onClick={() => fileRef.current?.click()}
                  disabled={uploadingPhoto || photos.length >= 5}
                  style={{
                    padding: '7px 14px', border: 'none', borderRadius: 10,
                    background: uploadingPhoto || photos.length >= 5 ? '#e2e8f0' : '#0d9e6e',
                    color: uploadingPhoto || photos.length >= 5 ? '#94a3b8' : '#fff',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                  }}>
                  {uploadingPhoto ? '⏳ מעלה...' : '+ הוסף תמונה'}
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotoUpload} />

              {photos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: 14 }}>
                  אין תמונות. לחץ "הוסף תמונה" להתחלה.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  {photos.map((url, i) => (
                    <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', background: '#f1f5f9' }}>
                      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                        style={{ position: 'absolute', top: 4, left: 4, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        ×
                      </button>
                      {i === 0 && (
                        <div style={{ position: 'absolute', bottom: 4, right: 4, background: 'rgba(13,158,110,0.85)', color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: 6, padding: '2px 6px' }}>ראשי</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 14, background: '#f0fdf4', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#065f46', border: '1px solid #d1fae5' }}>
                💡 גרור את התמונה הראשונה בסדר — היא תהיה תמונת הראשי של המקום.
              </div>
            </div>
          )}

          {/* ── Location ── */}
          {section === 'location' && (
            <div>
              {/* Warning banner */}
              <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ fontWeight: 800, color: '#92400e', fontSize: 14, marginBottom: 6 }}>⚠️ שינוי מיקום דורש בדיקה מחדש</div>
                <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.6 }}>
                  שינוי הקואורדינטות יסומן לבדיקה על ידי הצוות שלנו.
                  המקום <strong>ימשיך להיות מוצג במפה</strong> עם המיקום החדש תוך כדי הבדיקה.
                </div>
                {locationChanged && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer' }}>
                    <input type="checkbox" checked={locationWarningAccepted} onChange={e => setLocationWarningAccepted(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: '#0d9e6e' }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>מבין ומאשר</span>
                  </label>
                )}
              </div>

              <Label>לחץ על המפה לקביעת מיקום חדש</Label>
              <MapPicker lat={lat} lng={lng} onChange={(newLat, newLng) => { setLat(newLat); setLng(newLng); }} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <Label>קו רוחב</Label>
                  <input type="number" step="0.000001" value={lat}
                    onChange={e => setLat(Number.parseFloat(e.target.value) || lat)} style={inputStyle} />
                </div>
                <div>
                  <Label>קו אורך</Label>
                  <input type="number" step="0.000001" value={lng}
                    onChange={e => setLng(Number.parseFloat(e.target.value) || lng)} style={inputStyle} />
                </div>
              </div>

              {locationChanged && (
                <div style={{ background: '#fef3c7', borderRadius: 10, padding: '10px 14px', marginTop: 10, fontSize: 13, color: '#92400e', fontWeight: 600 }}>
                  📍 המיקום שונה — יישלח לבדיקה לאחר השמירה
                </div>
              )}
            </div>
          )}

          {/* Error / success */}
          {error && (
            <div style={{ marginTop: 14, background: '#fee2e2', borderRadius: 12, padding: '10px 14px', color: '#dc2626', fontSize: 14, fontWeight: 600 }}>
              ⚠️ {error}
            </div>
          )}
          {success && (
            <div style={{ marginTop: 14, background: '#dcfce7', borderRadius: 12, padding: '10px 14px', color: '#166534', fontSize: 14, fontWeight: 700, textAlign: 'center' }}>
              ✅ נשמר בהצלחה!
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            padding: '13px 0', flex: 0.4, border: '1.5px solid #e2e8f0', borderRadius: 14,
            background: '#fff', color: '#64748b', fontSize: 15, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
          }}>ביטול</button>
          <button onClick={handleSave} disabled={saving || success} style={{
            padding: '13px 0', flex: 1, border: 'none', borderRadius: 14,
            background: saving || success ? '#a7f3d0' : 'linear-gradient(135deg,#0d9e6e,#0bba7e)',
            color: '#fff', fontSize: 15, fontWeight: 900,
            cursor: saving || success ? 'default' : 'pointer', fontFamily: 'Heebo, sans-serif',
            boxShadow: '0 4px 14px rgba(13,158,110,0.28)',
          }}>
            {saving ? '⏳ שומר...' : success ? '✅ נשמר!' : '💾 שמור שינויים'}
          </button>
        </div>
      </div>
    </>
  );
}

// ── style helpers ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 13px', border: '1.5px solid #e2e8f0',
  borderRadius: 12, fontSize: 14, fontFamily: 'Heebo, sans-serif',
  color: '#1a2e2a', background: '#fff', outline: 'none',
  boxSizing: 'border-box',
};

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 5 }}>{children}</div>;
}
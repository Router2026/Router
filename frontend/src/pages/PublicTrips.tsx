/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/PublicTrips.tsx — Instagram-style social feed (enhanced)
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api, type PublicTrip, type RouteComment, fileToBase64 } from '../api';
import { useAuth } from '../context/AuthContext';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const CAT_COLOR: Record<string, string> = {
  טבע: '#16a34a', מעיין: '#0284c7', מצפה: '#d97706',
  נחל: '#0891b2', 'אתר היסטורי': '#7c3aed', גיאולוגיה: '#b45309', חוף: '#0ea5e9',
};
const DIFF_COLOR: Record<string, string> = {
  'קל - משפחות': '#16a34a', 'קל': '#16a34a',
  'בינוני': '#d97706', 'קשה': '#dc2626', 'מאתגר': '#7c3aed',
};
const GROUP_ICON: Record<string, string> = {
  solo: '🚶', couple: '👫', family: '👨‍👩‍👧‍👦', friends: '👥',
  יחיד: '🚶', זוג: '👫', משפחה: '👨‍👩‍👧‍👦', חברים: '👥',
};

// ── Map fit bounds helper ─────────────────────────────────────────────────────
function FitBounds({ points }: Readonly<{ points: [number, number][] }>) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points).pad(0.25));
    } else if (points.length === 1) {
      map.setView(points[0], 13);
    }
  }, [points, map]);
  return null;
}

// ── Leaflet map for card ──────────────────────────────────────────────────────
function RouteMapCard({ trip }: Readonly<{ trip: PublicTrip }>) {
  const stops = trip.locations.filter(l => l.latitude && l.longitude);
  if (!stops.length) return (
    <div style={{ height: 240, background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 32 }}>🗺️</span>
      <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>אין מיקומים במסלול</span>
    </div>
  );

  const points: [number, number][] = stops.map(l => [l.latitude, l.longitude]);
  const center: [number, number] = [
    points.reduce((s, p) => s + p[0], 0) / points.length,
    points.reduce((s, p) => s + p[1], 0) / points.length,
  ];

  return (
    <div style={{ height: 240, position: 'relative' }}>
      <MapContainer
        center={center} zoom={10}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false} dragging={false} scrollWheelZoom={false}
        doubleClickZoom={false} touchZoom={false} attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {points.length > 1 && (
          <Polyline positions={points} color="#0d9e6e" weight={3} opacity={0.9} dashArray="10 6" />
        )}
        {stops.map((loc, i) => {
          const icon = L.divIcon({
            html: `<div style="width:28px;height:28px;border-radius:50%;background:${CAT_COLOR[loc.category] || '#0d9e6e'};border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:900;box-shadow:0 2px 8px rgba(0,0,0,0.35);font-family:Heebo,Arial;">${i + 1}</div>`,
            className: '', iconSize: [28, 28], iconAnchor: [14, 14],
          });
          return <Marker key={loc.location_id ?? i} position={[loc.latitude, loc.longitude]} icon={icon} />;
        })}
        <FitBounds points={points} />
      </MapContainer>
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '3px 10px', backdropFilter: 'blur(4px)' }}>
        📍 {stops.length} עצירות
      </div>
      {/* Gradient overlay at bottom */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, background: 'linear-gradient(transparent, rgba(0,0,0,0.08))', zIndex: 500, pointerEvents: 'none' }} />
    </div>
  );
}

// ── Star rating ───────────────────────────────────────────────────────────────
function StarRating({ value, onChange, readonly, size = 22 }: Readonly<{ value: number; onChange?: (v: number) => void; readonly?: boolean; size?: number }>) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} type="button" onClick={() => !readonly && onChange?.(i)}
          onMouseEnter={() => !readonly && setHover(i)}
          onMouseLeave={() => !readonly && setHover(0)}
          style={{ background: 'none', border: 'none', padding: 0, cursor: readonly ? 'default' : 'pointer', lineHeight: 0 }}>
          <svg width={size} height={size} viewBox="0 0 24 24"
            fill={i <= (hover || value) ? '#f59e0b' : 'none'}
            stroke={i <= (hover || value) ? '#f59e0b' : '#d1d5db'} strokeWidth="2"
            style={{ transition: 'transform 0.12s', transform: !readonly && i <= hover ? 'scale(1.3)' : 'scale(1)' }}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      ))}
    </div>
  );
}

// ── Comments bottom sheet ─────────────────────────────────────────────────────
function CommentsPanel({ tripId, isOpen, onClose, currentUser, onCountChange }: Readonly<{
  tripId: number; isOpen: boolean; onClose: () => void; currentUser: any; onCountChange?: (n: number) => void;
}>) {
  const [comments, setComments] = useState<RouteComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    api.publicTrips.getComments(tripId)
      .then(cs => { setComments(cs); onCountChange?.(cs.length); })
      .catch(() => { })
      .finally(() => setLoading(false));
    setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen, tripId]);

  useEffect(() => {
    if (isOpen) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [comments.length, isOpen]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const c = await api.publicTrips.addComment(tripId, text.trim());
      const updated = [...comments, c];
      setComments(updated);
      onCountChange?.(updated.length);
      setText('');
    } catch { /* intentional */ } finally { setSending(false); }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-end', direction: 'rtl' }}>
      <button type="button" aria-label="סגור" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'default', padding: 0 }} />
      <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 640, margin: '0 auto', maxHeight: '82vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -12px 48px rgba(0,0,0,0.22)', position: 'relative', zIndex: 1 }}>

        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e2e8f0' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '8px 20px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#111' }}>
            💬 תגובות {comments.length > 0 && <span style={{ color: '#94a3b8', fontWeight: 500, fontSize: 14 }}>({comments.length})</span>}
          </div>
          <button onClick={onClose} style={{ border: 'none', background: '#f1f5f9', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 18, fontWeight: 600 }}>×</button>
        </div>

        {/* Comments list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {loading && (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: 32 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
              <div>טוען תגובות...</div>
            </div>
          )}
          {!loading && !comments.length && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
              <div style={{ fontWeight: 700, color: '#374151', marginBottom: 4 }}>אין תגובות עדיין</div>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>היה הראשון להגיב!</div>
            </div>
          )}
          {comments.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-start' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#0d9e6e,#34d399)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#fff', fontWeight: 800 }}>
                {c.avatar_url ? <img src={c.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : c.username.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ background: '#f8fafc', borderRadius: '4px 16px 16px 16px', padding: '10px 14px' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0d9e6e', marginBottom: 3 }}>{c.username}</div>
                  <div style={{ fontSize: 14, color: '#334155', lineHeight: 1.55 }}>{c.content}</div>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, paddingRight: 4 }}>{new Date(c.created_at).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {currentUser && !currentUser.isGuest ? (
          <div style={{ padding: '12px 16px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#0d9e6e,#34d399)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#fff', fontWeight: 800 }}>
              {currentUser.avatar_url ? <img src={currentUser.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : (currentUser.username || 'U').charAt(0).toUpperCase()}
            </div>
            <input
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="הוסף תגובה..."
              style={{ flex: 1, padding: '10px 16px', borderRadius: 22, border: '1.5px solid #e2e8f0', fontSize: 14, fontFamily: 'Heebo, sans-serif', outline: 'none', background: '#f8fafc', transition: 'border-color 0.2s' }}
              onFocus={e => e.currentTarget.style.borderColor = '#0d9e6e'}
              onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
            />
            <button onClick={send} disabled={!text.trim() || sending}
              style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: text.trim() ? 'linear-gradient(135deg,#0d9e6e,#059669)' : '#e2e8f0', color: '#fff', cursor: text.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={text.trim() ? '#fff' : '#94a3b8'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        ) : (
          <div style={{ padding: '16px 20px 24px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            <a href="/login" style={{ color: '#0d9e6e', fontWeight: 700, textDecoration: 'none' }}>התחבר</a> כדי להגיב
          </div>
        )}
      </div>
    </div>
  );
}

// ── Rating modal ──────────────────────────────────────────────────────────────
function RatingModal({ tripId, isOpen, onClose, currentRating, onRated }: Readonly<{
  tripId: number; isOpen: boolean; onClose: () => void; currentRating: number;
  onRated: (avg: number, count: number, user: number) => void;
}>) {
  const [selected, setSelected] = useState(currentRating);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { setSelected(currentRating); }, [currentRating]);

  if (!isOpen) return null;

  const submit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const r = await api.publicTrips.setRating(tripId, selected);
      onRated(r.average_rating, r.ratings_count, selected);
      onClose();
    } catch { /* intentional */ } finally { setSubmitting(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'rtl', padding: 20 }}>
      <button type="button" aria-label="סגור" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', border: 'none', cursor: 'default', padding: 0 }} />
      <div style={{ background: '#fff', borderRadius: 24, padding: '28px 32px', width: '100%', maxWidth: 340, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>⭐</div>
        <div style={{ fontWeight: 800, fontSize: 18, color: '#111', marginBottom: 4 }}>דרג את המסלול</div>
        <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 24 }}>כמה כוכבים מגיע למסלול הזה?</div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <StarRating value={selected} onChange={setSelected} size={36} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: 14, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontSize: 14 }}>ביטול</button>
          <button onClick={submit} disabled={!selected || submitting}
            style={{ flex: 1, padding: '12px', borderRadius: 14, border: 'none', background: selected ? 'linear-gradient(135deg,#f59e0b,#d97706)' : '#e2e8f0', color: selected ? '#fff' : '#94a3b8', fontWeight: 800, cursor: selected ? 'pointer' : 'default', fontFamily: 'Heebo, sans-serif', fontSize: 14, transition: 'all 0.2s' }}>
            {submitting ? 'שומר...' : 'שלח דירוג'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Media Upload Panel ────────────────────────────────────────────────────────
function MediaUploadPanel({ trip, isOpen, onClose, onUpdated, currentUser }: Readonly<{
  trip: PublicTrip; isOpen: boolean; onClose: () => void; onUpdated: (t: PublicTrip) => void; currentUser: any;
}>) {
  const [desc, setDesc] = useState(trip.user_description || '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(trip.image_url || '');
  const [videoPreview, setVideoPreview] = useState(trip.video_url || '');
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState<'image' | 'video' | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;
  const isOwner = currentUser && !currentUser.isGuest && Number(currentUser.id) === trip.user_id;
  if (!isOwner) return null;

  const handleImage = (f: File) => { setImageFile(f); setImagePreview(URL.createObjectURL(f)); };
  const handleVideo = (f: File) => { setVideoFile(f); setVideoPreview(URL.createObjectURL(f)); };

  const save = async () => {
    setSaving(true);
    try {
      let image_url = trip.image_url || undefined;
      let video_url = trip.video_url || undefined;
      if (imageFile) image_url = await fileToBase64(imageFile);
      if (videoFile) video_url = await fileToBase64(videoFile);
      await api.publicTrips.updateMedia(trip.id, { user_description: desc, image_url, video_url });
      onUpdated({ ...trip, user_description: desc, image_url: imagePreview || image_url, video_url: videoPreview || video_url });
      onClose();
    } catch { /* intentional */ } finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'rtl', padding: 16 }}>
      <button type="button" aria-label="סגור" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', border: 'none', cursor: 'default', padding: 0 }} />
      <div style={{ background: '#fff', borderRadius: 24, width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.28)', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 10, borderRadius: '24px 24px 0 0' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#111' }}>✏️ ערוך את המסלול שלך</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>הוסף תמונה, סרטון ותיאור</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: '#f1f5f9', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 20 }}>×</button>
        </div>

        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Description */}
          <div>
            <label htmlFor="pt-edit-desc" style={{ fontWeight: 700, fontSize: 14, color: '#374151', display: 'block', marginBottom: 8 }}>
              📝 תיאור אישי <span style={{ fontWeight: 400, color: '#94a3b8' }}>(מה היה מיוחד? מה כדאי לדעת?)</span>
            </label>
            <textarea
              id="pt-edit-desc"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={4}
              placeholder="ספר לנו על החוויה, הדגשים, מה אהבת, טיפים שימושיים..."
              style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #e2e8f0', borderRadius: 14, fontSize: 14, fontFamily: 'Heebo, sans-serif', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.65, transition: 'border-color 0.2s' }}
              onFocus={e => e.currentTarget.style.borderColor = '#0d9e6e'}
              onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
            />
            <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'left', marginTop: 4 }}>{desc.length} תווים</div>
          </div>

          {/* Image upload */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#374151', display: 'block', marginBottom: 8 }}>🖼️ תמונה ראשית</div>
            <input ref={imageRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleImage(f); }} style={{ display: 'none' }} />
            {imagePreview ? (
              <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden' }}>
                <img src={imagePreview} style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} alt="" />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.5))' }} />
                <button onClick={() => imageRef.current?.click()}
                  style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,0.95)', color: '#374151', border: 'none', borderRadius: 20, padding: '7px 18px', fontSize: 13, cursor: 'pointer', fontWeight: 700, backdropFilter: 'blur(4px)' }}>
                  🔄 החלף תמונה
                </button>
              </div>
            ) : (
              <button type="button"
                onDragOver={e => { e.preventDefault(); setDragOver('image'); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => { e.preventDefault(); setDragOver(null); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('image/')) handleImage(f); }}
                onClick={() => imageRef.current?.click()}
                style={{ border: `2px dashed ${dragOver === 'image' ? '#0d9e6e' : '#d1d5db'}`, borderRadius: 16, padding: '32px 20px', textAlign: 'center', background: dragOver === 'image' ? '#f0fdf4' : '#fafafa', cursor: 'pointer', transition: 'all 0.2s', width: '100%' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📷</div>
                <div style={{ fontWeight: 700, color: '#374151', fontSize: 14 }}>גרור תמונה או לחץ להעלאה</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>JPG, PNG, WEBP עד 10MB</div>
              </button>
            )}
          </div>

          {/* Video upload */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#374151', display: 'block', marginBottom: 8 }}>🎥 סרטון מסלול</div>
            <input ref={videoRef} type="file" accept="video/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleVideo(f); }} style={{ display: 'none' }} />
            {videoPreview ? (
              <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#000' }}>
                <video src={videoPreview} controls style={{ width: '100%', maxHeight: 200, display: 'block' }}>
                  <track kind="captions" />
                </video>
                <button onClick={() => videoRef.current?.click()}
                  style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', borderRadius: 10, padding: '5px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                  🔄 החלף
                </button>
              </div>
            ) : (
              <button type="button"
                onDragOver={e => { e.preventDefault(); setDragOver('video'); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => { e.preventDefault(); setDragOver(null); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('video/')) handleVideo(f); }}
                onClick={() => videoRef.current?.click()}
                style={{ border: `2px dashed ${dragOver === 'video' ? '#7c3aed' : '#d1d5db'}`, borderRadius: 16, padding: '28px 20px', textAlign: 'center', background: dragOver === 'video' ? '#faf5ff' : '#fafafa', cursor: 'pointer', transition: 'all 0.2s', width: '100%' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🎬</div>
                <div style={{ fontWeight: 700, color: '#374151', fontSize: 14 }}>גרור סרטון או לחץ להעלאה</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>MP4, MOV עד 100MB</div>
              </button>
            )}
          </div>

          <button onClick={save} disabled={saving}
            style={{ width: '100%', padding: '15px 0', borderRadius: 16, border: 'none', background: saving ? '#94a3b8' : 'linear-gradient(135deg,#0d9e6e,#059669)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: saving ? 'default' : 'pointer', fontFamily: 'Heebo, sans-serif', boxShadow: saving ? 'none' : '0 4px 14px rgba(13,158,110,0.3)', transition: 'all 0.2s' }}>
            {saving ? '⏳ שומר...' : '💾 שמור שינויים'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Trip Card ─────────────────────────────────────────────────────────────────
function TripCard({ trip: initialTrip, rank, currentUser, navigate }: Readonly<{
  trip: PublicTrip; rank: number; currentUser: any; navigate: (path: string) => void;
}>) {
  const [trip, setTrip] = useState(initialTrip);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(trip.likes_count ?? 0);
  const [likeLoading, setLikeLoading] = useState(false);
  const [likeAnim, setLikeAnim] = useState(false);
  const [userRating, setUserRating] = useState<number>(0);
  const [avgRating, setAvgRating] = useState(trip.average_rating ?? 0);
  const [ratingsCount, setRatingsCount] = useState(trip.ratings_count ?? 0);
  const [showComments, setShowComments] = useState(false);
  const [showMediaUpload, setShowMediaUpload] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [commentsCount, setCommentsCount] = useState(trip.comments_count ?? 0);
  const [mediaTab, setMediaTab] = useState<'map' | 'image' | 'video'>('map');
  const [descExpanded, setDescExpanded] = useState(false);

  useEffect(() => {
    if (currentUser && !currentUser.isGuest) {
      api.publicTrips.getLikes(trip.id)
        .then(({ liked: l, likes_count: lc }) => { setLiked(l); setLikesCount(lc); })
        .catch(() => { });
      api.publicTrips.getRating(trip.id)
        .then(r => { setUserRating(r.user_rating ?? 0); setAvgRating(r.average_rating); setRatingsCount(r.ratings_count); })
        .catch(() => { });
    }
  }, [trip.id, currentUser]);

  const toggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (likeLoading || !currentUser || currentUser.isGuest) return;
    setLikeLoading(true);
    setLikeAnim(true);
    setTimeout(() => setLikeAnim(false), 400);
    try {
      const { liked: l, likes_count: lc } = await api.publicTrips.toggleLike(trip.id);
      setLiked(l); setLikesCount(lc);
    } catch { /* intentional */ } finally { setLikeLoading(false); }
  };

  let rankBorder = 'transparent';
  if (rank === 1) rankBorder = '#f59e0b';
  else if (rank === 2) rankBorder = '#94a3b8';
  else if (rank === 3) rankBorder = '#b45309';
  let rankEmoji: string | null = null;
  if (rank === 1) rankEmoji = '🥇';
  else if (rank === 2) rankEmoji = '🥈';
  else if (rank === 3) rankEmoji = '🥉';
  const isOwner = currentUser && !currentUser.isGuest && Number(currentUser.id) === trip.user_id;
  const hasImage = !!trip.image_url;
  const hasVideo = !!trip.video_url;
  const hasMedia = hasImage || hasVideo;
  const displayDescription = trip.user_description || trip.description;
  const mediaTabs = ['map', ...(hasImage ? ['image'] : []), ...(hasVideo ? ['video'] : [])] as ('map' | 'image' | 'video')[];

  return (
    <>
      <div style={{
        background: '#fff',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: rank <= 3 && avgRating > 0
          ? `0 4px 24px ${rankBorder}30`
          : '0 2px 16px rgba(0,0,0,0.06)',
        border: rank <= 3 && avgRating > 0
          ? `2px solid ${rankBorder}`
          : '2px solid transparent',
        transition: 'box-shadow 0.2s, transform 0.2s',
      }}>

        {/* ── Card Header ─────────────────────────────────────────────── */}
        <div style={{ padding: '13px 15px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Avatar */}
          <button type="button" onClick={() => navigate(`/profile/${trip.user_id}`)}
            style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#0d9e6e,#34d399)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: '#fff', fontWeight: 800, cursor: 'pointer', border: '2px solid #e2e8f0' }}>
            {trip.creator_avatar
              ? <img src={trip.creator_avatar} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
              : trip.creator_username.charAt(0).toUpperCase()}
          </button>

          {/* Username + date */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => navigate(`/profile/${trip.user_id}`)}
                style={{ fontWeight: 800, fontSize: 14, color: '#111827', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
                {trip.creator_username}
              </button>
              {rankEmoji && avgRating > 0 && (
                <span style={{ fontSize: 16 }} title={`מקום #${rank}`}>{rankEmoji}</span>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
              {new Date(trip.created_at).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}
              {trip.region && ` · ${trip.region}`}
            </div>
          </div>

          {/* Badges + Edit */}
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
            {trip.difficulty && (
              <span style={{ fontSize: 10, background: `${DIFF_COLOR[trip.difficulty] || '#64748b'}18`, color: DIFF_COLOR[trip.difficulty] || '#64748b', borderRadius: 8, padding: '3px 8px', fontWeight: 700 }}>
                {trip.difficulty}
              </span>
            )}
            {isOwner && (
              <div style={{ display: 'flex', gap: 5 }}>
                <button onClick={() => setShowMediaUpload(true)}
                  style={{ border: 'none', background: '#f1f5f9', borderRadius: 10, padding: '6px 10px', cursor: 'pointer', fontSize: 14, lineHeight: 1 }} title="ערוך תוכן">✏️</button>
                <button onClick={() => navigate(`/trips/${trip.id}`)}
                  style={{ border: 'none', background: '#ede9fe', borderRadius: 10, padding: '6px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#7c3aed', lineHeight: 1, fontFamily: 'Heebo, sans-serif', whiteSpace: 'nowrap' }} title="ערוך מסלול">ערוך</button>
              </div>
            )}
          </div>
        </div>

        {/* ── Title ───────────────────────────────────────────────────── */}
        <div style={{ paddingInline: 15, paddingBottom: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', lineHeight: 1.3 }}>{trip.title}</div>
        </div>

        {/* ── Media tabs ──────────────────────────────────────────────── */}
        {hasMedia && (
          <div style={{ display: 'flex', paddingInline: 15, paddingBottom: 6, gap: 0, borderBottom: '1px solid #f1f5f9' }}>
            {mediaTabs.map(tab => (
              <button key={tab} onClick={() => setMediaTab(tab)}
                style={{ flex: 1, padding: '7px 0', border: 'none', background: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', color: mediaTab === tab ? '#0d9e6e' : '#94a3b8', borderBottom: mediaTab === tab ? '2px solid #0d9e6e' : '2px solid transparent', fontFamily: 'Heebo, sans-serif', transition: 'all 0.15s' }}>
                {(() => {
                  if (tab === 'map') return '🗺️ מפה';
                  if (tab === 'image') return '🖼️ תמונה';
                  return '🎥 סרטון';
                })()}
              </button>
            ))}
          </div>
        )}

        {/* ── Media area ──────────────────────────────────────────────── */}
        <button type="button" style={{ cursor: 'pointer', position: 'relative', background: 'none', border: 'none', padding: 0, width: '100%', display: 'block' }} onClick={() => navigate(`/trips/${trip.id}`)}>
          {(!hasMedia || mediaTab === 'map') && <RouteMapCard trip={trip} />}
          {hasImage && mediaTab === 'image' && (
            <div style={{ height: 260, overflow: 'hidden', position: 'relative' }}>
              <img src={trip.image_url!} alt={trip.title} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.3))' }} />
            </div>
          )}
          {hasVideo && mediaTab === 'video' && (
            <div style={{ background: '#0f172a' }}>
              <video src={trip.video_url!} controls style={{ width: '100%', maxHeight: 300, display: 'block' }}>
                <track kind="captions" />
              </video>
            </div>
          )}
          {/* View full trip overlay hint */}
          {(!hasMedia || mediaTab === 'map') && (
            <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,0.92)', borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 700, color: '#374151', backdropFilter: 'blur(4px)', zIndex: 600, whiteSpace: 'nowrap' }}>
              לחץ לצפייה במסלול ›
            </div>
          )}
        </button>

        {/* ── Social action bar ───────────────────────────────────────── */}
        <div style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', gap: 14 }}>

          {/* Like */}
          <button onClick={toggleLike} disabled={likeLoading}
            style={{ display: 'flex', alignItems: 'center', gap: 5, border: 'none', background: 'none', cursor: currentUser && !currentUser.isGuest ? 'pointer' : 'default', padding: 4, borderRadius: 8 }}>
            <svg width="24" height="24" viewBox="0 0 24 24"
              fill={liked ? '#ef4444' : 'none'}
              stroke={liked ? '#ef4444' : '#64748b'} strokeWidth="2"
              style={{ transition: 'all 0.25s', transform: (() => { if (likeAnim) return 'scale(1.4)'; if (liked) return 'scale(1.1)'; return 'scale(1)'; })() }}>
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <span style={{ fontSize: 14, fontWeight: 700, color: liked ? '#ef4444' : '#64748b' }}>{likesCount}</span>
          </button>

          {/* Comment */}
          <button onClick={() => setShowComments(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, border: 'none', background: 'none', cursor: 'pointer', padding: 4, borderRadius: 8 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#64748b' }}>{commentsCount}</span>
          </button>

          {/* Rate */}
          <button onClick={() => currentUser && !currentUser.isGuest && setShowRatingModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', cursor: currentUser && !currentUser.isGuest ? 'pointer' : 'default', padding: 4, borderRadius: 8 }}>
            <svg width="22" height="22" viewBox="0 0 24 24"
              fill={userRating > 0 ? '#f59e0b' : 'none'}
              stroke={userRating > 0 ? '#f59e0b' : '#94a3b8'} strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 700, color: avgRating > 0 ? '#f59e0b' : '#94a3b8' }}>
              {avgRating > 0 ? avgRating.toFixed(1) : '—'}
            </span>
            {ratingsCount > 0 && <span style={{ fontSize: 11, color: '#94a3b8' }}>({ratingsCount})</span>}
          </button>

          {/* Spacer + stops count */}
          <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>📍 {trip.location_count} עצירות</span>
            {trip.total_duration_hours && (
              <span style={{ fontSize: 12, color: '#94a3b8' }}>· ⏱ {trip.total_duration_hours} שע'</span>
            )}
          </div>
        </div>

        {/* ── Description ─────────────────────────────────────────────── */}
        {displayDescription && (
          <div style={{ paddingInline: 15, paddingBottom: 10 }}>
            <div style={{ fontSize: 14, color: '#334155', lineHeight: 1.6 }}>
              {trip.user_description && (
                <span style={{ fontWeight: 800, color: '#0f172a', marginLeft: 5 }}>{trip.creator_username}</span>
              )}
              <span style={{
                display: descExpanded ? 'inline' : '-webkit-box',
                WebkitLineClamp: descExpanded ? undefined : 2,
                WebkitBoxOrient: 'vertical' as any,
                overflow: descExpanded ? 'visible' : 'hidden',
              }}>
                {displayDescription}
              </span>
              {displayDescription.length > 100 && (
                <button onClick={() => setDescExpanded(v => !v)}
                  style={{ border: 'none', background: 'none', color: '#94a3b8', fontSize: 13, cursor: 'pointer', marginRight: 4, padding: 0 }}>
                  {descExpanded ? ' פחות' : '... עוד'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── View all comments link ───────────────────────────────────── */}
        {commentsCount > 0 && (
          <div style={{ paddingInline: 15, paddingBottom: 8 }}>
            <button onClick={() => setShowComments(true)}
              style={{ border: 'none', background: 'none', color: '#94a3b8', fontSize: 13, cursor: 'pointer', padding: 0 }}>
              צפה בכל {commentsCount} התגובות
            </button>
          </div>
        )}

        {/* ── Location chips ───────────────────────────────────────────── */}
        {trip.locations.length > 0 && (
          <div style={{ display: 'flex', gap: 6, paddingInline: 15, paddingBottom: 10, flexWrap: 'wrap' }}>
            {trip.locations.slice(0, 4).map((loc, i) => (
              <span key={loc.location_id ?? i} style={{ background: '#f0fdf4', color: '#0d9e6e', borderRadius: 10, padding: '3px 10px', fontSize: 11, fontWeight: 600, border: '1px solid #d1fae5' }}>
                {i + 1}. {loc.name}
              </span>
            ))}
            {trip.locations.length > 4 && (
              <span style={{ fontSize: 11, color: '#94a3b8', padding: '3px 4px' }}>+{trip.locations.length - 4}</span>
            )}
          </div>
        )}

        {/* ── Tags row ─────────────────────────────────────────────────── */}
        {(trip.style || trip.group_type) && (
          <div style={{ display: 'flex', gap: 6, paddingInline: 15, paddingBottom: 10, flexWrap: 'wrap' }}>
            {trip.style && <span style={{ fontSize: 11, background: '#f8fafc', color: '#475569', borderRadius: 8, padding: '3px 9px', fontWeight: 600, border: '1px solid #e2e8f0' }}>{trip.style}</span>}
            {trip.group_type && GROUP_ICON[trip.group_type] && <span style={{ fontSize: 11, background: '#f8fafc', color: '#475569', borderRadius: 8, padding: '3px 9px', fontWeight: 600, border: '1px solid #e2e8f0' }}>{GROUP_ICON[trip.group_type]}</span>}
          </div>
        )}

        {/* ── CTA button ────────────────────────────────────────────────── */}
        <div style={{ padding: '0 15px 14px' }}>
          <button onClick={() => navigate(`/trips/${trip.id}`)}
            style={{ width: '100%', padding: '10px 0', borderRadius: 13, border: '1.5px solid #d1fae5', background: '#f0fdf4', color: '#0d9e6e', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', transition: 'all 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#0d9e6e'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f0fdf4'; (e.currentTarget as HTMLElement).style.color = '#0d9e6e'; }}>
            צפה במסלול המלא ←
          </button>
        </div>
      </div>

      <CommentsPanel
        tripId={trip.id}
        isOpen={showComments}
        onClose={() => setShowComments(false)}
        currentUser={currentUser}
        onCountChange={n => setCommentsCount(n)}
      />

      <RatingModal
        tripId={trip.id}
        isOpen={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        currentRating={userRating}
        onRated={(avg, count, user) => { setAvgRating(avg); setRatingsCount(count); setUserRating(user); }}
      />

      <MediaUploadPanel
        trip={trip}
        isOpen={showMediaUpload}
        onClose={() => setShowMediaUpload(false)}
        onUpdated={updated => setTrip(updated)}
        currentUser={currentUser}
      />
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PublicTrips() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [trips, setTrips] = useState<PublicTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [selRegion, setSelRegion] = useState('');
  const [selDifficulty, setSelDifficulty] = useState('');
  const [selStyle, setSelStyle] = useState('');
  const [selGroupType, setSelGroupType] = useState('');
  const [allRegions, setAllRegions] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const DIFFICULTIES = ['קל', 'קל - משפחות', 'בינוני', 'קשה', 'מאתגר'];
  const STYLES = ['טבע', 'היסטוריה', 'ספורט', 'רכב שטח', 'אופניים', 'ים', 'הרים'];
  const GROUP_TYPES = [
    { key: 'solo', label: '🚶 יחיד' },
    { key: 'couple', label: '👫 זוג' },
    { key: 'family', label: '👨‍👩‍👧‍👦 משפחה' },
    { key: 'friends', label: '👥 חברים' },
  ];

  const load = useCallback(() => {
    setLoading(true);
    api.publicTrips.list({
      region: selRegion || undefined,
      difficulty: selDifficulty || undefined,
      style: selStyle || undefined,
      group_type: selGroupType || undefined,
    })
      .then(data => {
        let filtered = data;
        if (searchText.trim()) {
          const q = searchText.trim().toLowerCase();
          filtered = data.filter(t =>
            t.title?.toLowerCase().includes(q) ||
            t.creator_username?.toLowerCase().includes(q) ||
            t.region?.toLowerCase().includes(q) ||
            t.user_description?.toLowerCase().includes(q)
          );
        }
        const sorted = [...filtered].sort((a, b) => {
          const rA = (a.average_rating ?? 0) * 100 + (a.ratings_count ?? 0);
          const rB = (b.average_rating ?? 0) * 100 + (b.ratings_count ?? 0);
          if (rB !== rA) return rB - rA;
          return (b.likes_count ?? 0) - (a.likes_count ?? 0);
        });
        setTrips(sorted);
        // collect distinct regions for chips
        const regions = [...new Set(data.map(t => t.region).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b));
        setAllRegions(regions);
      })
      .catch(() => setTrips([]))
      .finally(() => setLoading(false));
  }, [selRegion, selDifficulty, selStyle, selGroupType, searchText]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(load, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [load]);

  const activeFilters = [selRegion, selDifficulty, selStyle, selGroupType].filter(Boolean).length;
  const clearFilters = () => { setSelRegion(''); setSelDifficulty(''); setSelStyle(''); setSelGroupType(''); setSearchText(''); };

  return (
    <div style={{ background: '#f1f5f9', minHeight: '100vh', direction: 'rtl', paddingBottom: 80, fontFamily: 'Heebo, sans-serif' }}>

      {/* ── Hero header ──────────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg,#0d9e6e 0%,#059669 55%,#047857 100%)', padding: '28px 20px 72px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -50, left: -50, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: 5, right: -40, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', top: 30, right: 60, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

        <div style={{ maxWidth: 640, margin: '0 auto', position: 'relative' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase' }}>קהילת מטיילים</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
            🗺️ מסלולים ציבוריים
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>
            מדורג לפי ציוני הקהילה
            {trips.length > 0 && ` · ${trips.length} מסלולים`}
          </div>
        </div>
      </div>

      {/* ── Floating filter card ─────────────────────────────────────── */}
      <div style={{ maxWidth: 640, margin: '-40px auto 20px', padding: '0 16px', position: 'relative', zIndex: 10 }}>
        <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.13)', padding: '14px 16px' }}>

          {/* Search row */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="חפש מסלול, יוצר, אזור..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ flex: 1, border: 'none', fontSize: 14, outline: 'none', fontFamily: 'Heebo, sans-serif', color: '#0f172a', background: 'transparent' }}
            />
            {activeFilters > 0 && (
              <button onClick={clearFilters}
                style={{ border: 'none', background: '#fee2e2', borderRadius: 20, padding: '4px 12px', cursor: 'pointer', color: '#ef4444', fontSize: 12, fontWeight: 700, flexShrink: 0, fontFamily: 'Heebo, sans-serif' }}>
                נקה ({activeFilters})
              </button>
            )}
          </div>

          {/* Region chips */}
          {allRegions.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>📍 אזור</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {allRegions.map(r => (
                  <button key={r} onClick={() => setSelRegion(selRegion === r ? '' : r)}
                    style={{ padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${selRegion === r ? '#0d9e6e' : '#e2e8f0'}`, background: selRegion === r ? '#0d9e6e' : '#fff', color: selRegion === r ? '#fff' : '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', transition: 'all 0.15s' }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Difficulty chips */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>💪 קושי</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DIFFICULTIES.map(d => (
                <button key={d} onClick={() => setSelDifficulty(selDifficulty === d ? '' : d)}
                  style={{ padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${selDifficulty === d ? DIFF_COLOR[d] || '#64748b' : '#e2e8f0'}`, background: selDifficulty === d ? (DIFF_COLOR[d] || '#64748b') : '#fff', color: selDifficulty === d ? '#fff' : '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', transition: 'all 0.15s' }}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Style + Group type row */}
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>🏕️ סגנון</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {STYLES.map(s => (
                  <button key={s} onClick={() => setSelStyle(selStyle === s ? '' : s)}
                    style={{ padding: '5px 10px', borderRadius: 20, border: `1.5px solid ${selStyle === s ? '#7c3aed' : '#e2e8f0'}`, background: selStyle === s ? '#7c3aed' : '#fff', color: selStyle === s ? '#fff' : '#475569', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', transition: 'all 0.15s' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Group type */}
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>👥 סוג קבוצה</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {GROUP_TYPES.map(g => (
                <button key={g.key} onClick={() => setSelGroupType(selGroupType === g.key ? '' : g.key)}
                  style={{ flex: 1, padding: '6px 8px', borderRadius: 12, border: `1.5px solid ${selGroupType === g.key ? '#0284c7' : '#e2e8f0'}`, background: selGroupType === g.key ? '#0284c7' : '#fff', color: selGroupType === g.key ? '#fff' : '#475569', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', transition: 'all 0.15s', textAlign: 'center' }}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Feed ─────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px' }}>

        {loading && (
          <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0d9e6e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 12px' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            טוען מסלולים...
          </div>
        )}

        {!loading && !trips.length && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🏔️</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1a2e2a', marginBottom: 8 }}>אין מסלולים עדיין</div>
            <div style={{ color: '#94a3b8', marginBottom: 28, fontSize: 14 }}>
              {(searchText || activeFilters > 0) ? `לא נמצאו מסלולים עבור "${(searchText || activeFilters > 0)}"` : 'היה ראשון ליצור מסלול ולשתף אותו!'}
            </div>
            {!(searchText || activeFilters > 0) && (
              <button onClick={() => navigate('/RouteGenerator')}
                style={{ padding: '13px 32px', borderRadius: 16, border: 'none', background: 'linear-gradient(135deg,#0d9e6e,#059669)', color: '#fff', fontFamily: 'Heebo, sans-serif', cursor: 'pointer', fontWeight: 800, fontSize: 15, boxShadow: '0 4px 14px rgba(13,158,110,0.3)' }}>
                + צור מסלול
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {trips.map((trip, idx) => (
            <TripCard
              key={trip.id}
              trip={trip}
              rank={idx + 1}
              currentUser={user}
              navigate={navigate}
            />
          ))}
        </div>

        {/* Bottom padding */}
        {trips.length > 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0 16px', color: '#94a3b8', fontSize: 13 }}>
            סה"כ {trips.length} מסלולים · מדורגים לפי ציון קהילה
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}
// src/pages/PublicTrips.tsx — Instagram-style social feed
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api, type PublicTrip, type RouteComment, fileToBase64 } from '../api';
import { useAuth } from '../context/AuthContext';

// Fix leaflet default icon
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

// ── Leaflet map for card ─────────────────────────────────────────────────────
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points).pad(0.22));
    } else if (points.length === 1) {
      map.setView(points[0], 13);
    }
  }, [points, map]);
  return null;
}

function RouteMapCard({ trip }: { trip: PublicTrip }) {
  const stops = trip.locations.filter(l => l.latitude && l.longitude);
  if (!stops.length) return (
    <div style={{ height: 220, background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#94a3b8', gap: 8 }}>
      🗺️ אין מיקומים במסלול
    </div>
  );

  const points: [number, number][] = stops.map(l => [l.latitude, l.longitude]);
  const center: [number, number] = [
    points.reduce((s, p) => s + p[0], 0) / points.length,
    points.reduce((s, p) => s + p[1], 0) / points.length,
  ];

  return (
    <div style={{ height: 220, position: 'relative' }}>
      <MapContainer
        center={center}
        zoom={10}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {points.length > 1 && (
          <Polyline positions={points} color="#0d9e6e" weight={3} opacity={0.8} dashArray="8 5" />
        )}
        {stops.map((loc, i) => {
          const icon = L.divIcon({
            html: `<div style="width:30px;height:30px;border-radius:50%;background:${CAT_COLOR[loc.category] || '#0d9e6e'};border:3px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:900;box-shadow:0 2px 8px rgba(0,0,0,0.35);font-family:Heebo,Arial;">${i + 1}</div>`,
            className: '',
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          });
          return <Marker key={i} position={[loc.latitude, loc.longitude]} icon={icon} />;
        })}
        <FitBounds points={points} />
      </MapContainer>
      {/* Stop count badge */}
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 12, fontWeight: 700, borderRadius: 20, padding: '4px 10px', backdropFilter: 'blur(4px)' }}>
        📍 {stops.length} עצירות
      </div>
    </div>
  );
}

// ── Star rating ──────────────────────────────────────────────────────────────
function StarRating({ value, onChange, readonly, size = 22 }: { value: number; onChange?: (v: number) => void; readonly?: boolean; size?: number }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24"
          fill={i <= (hover || value) ? '#f59e0b' : 'none'}
          stroke="#f59e0b" strokeWidth="2"
          style={{ cursor: readonly ? 'default' : 'pointer', transition: 'transform 0.1s', transform: !readonly && i <= hover ? 'scale(1.25)' : 'scale(1)' }}
          onMouseEnter={() => !readonly && setHover(i)}
          onMouseLeave={() => !readonly && setHover(0)}
          onClick={() => !readonly && onChange?.(i)}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
}

// ── Comments panel ────────────────────────────────────────────────────────────
function CommentsPanel({ tripId, isOpen, onClose, currentUser }: {
  tripId: number; isOpen: boolean; onClose: () => void; currentUser: any;
}) {
  const [comments, setComments] = useState<RouteComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    api.publicTrips.getComments(tripId)
      .then(setComments)
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [isOpen, tripId]);

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments, isOpen]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const c = await api.publicTrips.addComment(tripId, text.trim());
      setComments(prev => [...prev, c]);
      setText('');
    } catch { } finally { setSending(false); }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-end', background: 'rgba(0,0,0,0.55)', direction: 'rtl' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 620, margin: '0 auto', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -8px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: 16 }}>💬 תגובות</span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: '#64748b' }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {loading && <div style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>טוען...</div>}
          {!loading && !comments.length && <div style={{ textAlign: 'center', color: '#94a3b8', padding: 30 }}>אין תגובות עדיין. היה ראשון!</div>}
          {comments.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-start' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#0d9e6e,#34d399)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#fff', fontWeight: 800 }}>
                {c.avatar_url ? <img src={c.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : c.username.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, background: '#f8fafc', borderRadius: 14, padding: '10px 14px' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#0d9e6e', marginBottom: 3 }}>{c.username}</div>
                <div style={{ fontSize: 14, color: '#334155', lineHeight: 1.5 }}>{c.content}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{new Date(c.created_at).toLocaleDateString('he-IL')}</div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        {currentUser && !currentUser.isGuest && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="הוסף תגובה..."
              style={{ flex: 1, padding: '10px 16px', borderRadius: 20, border: '1.5px solid #e2e8f0', fontSize: 14, fontFamily: 'Heebo, sans-serif', outline: 'none', background: '#f8fafc' }}
            />
            <button onClick={send} disabled={!text.trim() || sending}
              style={{ padding: '10px 18px', borderRadius: 20, border: 'none', background: text.trim() ? 'linear-gradient(135deg,#0d9e6e,#059669)' : '#e2e8f0', color: text.trim() ? '#fff' : '#94a3b8', fontWeight: 700, cursor: text.trim() ? 'pointer' : 'default', fontSize: 13, fontFamily: 'Heebo, sans-serif', transition: 'all 0.2s' }}>
              שלח
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Media Upload Panel ────────────────────────────────────────────────────────
function MediaUploadPanel({ trip, isOpen, onClose, onUpdated, currentUser }: {
  trip: PublicTrip; isOpen: boolean; onClose: () => void; onUpdated: (t: PublicTrip) => void; currentUser: any;
}) {
  const [desc, setDesc] = useState(trip.user_description || '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(trip.image_url || '');
  const [videoPreview, setVideoPreview] = useState(trip.video_url || '');
  const [saving, setSaving] = useState(false);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const isOwner = currentUser && !currentUser.isGuest && currentUser.id === trip.user_id;
  if (!isOwner) return null;

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  };
  const handleVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setVideoFile(f);
    setVideoPreview(URL.createObjectURL(f));
  };

  const save = async () => {
    setSaving(true);
    try {
      let image_url = trip.image_url || undefined;
      let video_url = trip.video_url || undefined;
      if (imageFile) {
        const b64 = await fileToBase64(imageFile);
        image_url = b64;
      }
      if (videoFile) {
        const b64 = await fileToBase64(videoFile);
        video_url = b64;
      }
      await api.publicTrips.updateMedia(trip.id, { user_description: desc, image_url, video_url });
      onUpdated({ ...trip, user_description: desc, image_url: imagePreview || image_url, video_url: videoPreview || video_url });
      onClose();
    } catch { } finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', direction: 'rtl', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 24, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: 17 }}>✏️ ערוך תוכן מסלול</span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 24, cursor: 'pointer', color: '#64748b' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label style={{ fontWeight: 700, fontSize: 14, color: '#374151', display: 'block', marginBottom: 8 }}>📝 תיאור אישי על המסלול</label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={4}
              placeholder="ספר לנו על החוויה, הדגשים, מה אהבת..."
              style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #e2e8f0', borderRadius: 14, fontSize: 14, fontFamily: 'Heebo, sans-serif', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6 }}
            />
          </div>
          <div>
            <label style={{ fontWeight: 700, fontSize: 14, color: '#374151', display: 'block', marginBottom: 8 }}>🖼️ תמונה ראשית</label>
            <input ref={imageRef} type="file" accept="image/*" onChange={handleImage} style={{ display: 'none' }} />
            {imagePreview
              ? <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', marginBottom: 8 }}>
                <img src={imagePreview} style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} alt="" />
                <button onClick={() => imageRef.current?.click()} style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: 10, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>החלף</button>
              </div>
              : <button onClick={() => imageRef.current?.click()} style={{ width: '100%', padding: '24px 0', border: '2px dashed #d1d5db', borderRadius: 14, background: '#f9fafb', color: '#6b7280', fontSize: 14, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>📷 העלה תמונה</button>
            }
          </div>
          <div>
            <label style={{ fontWeight: 700, fontSize: 14, color: '#374151', display: 'block', marginBottom: 8 }}>🎥 סרטון</label>
            <input ref={videoRef} type="file" accept="video/*" onChange={handleVideo} style={{ display: 'none' }} />
            {videoPreview
              ? <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', marginBottom: 8 }}>
                <video src={videoPreview} controls style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block', borderRadius: 14 }} />
                <button onClick={() => videoRef.current?.click()} style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: 10, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>החלף</button>
              </div>
              : <button onClick={() => videoRef.current?.click()} style={{ width: '100%', padding: '24px 0', border: '2px dashed #d1d5db', borderRadius: 14, background: '#f9fafb', color: '#6b7280', fontSize: 14, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>🎬 העלה סרטון</button>
            }
          </div>
          <button onClick={save} disabled={saving}
            style={{ width: '100%', padding: '14px 0', borderRadius: 16, border: 'none', background: 'linear-gradient(135deg,#0d9e6e,#059669)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: saving ? 'default' : 'pointer', fontFamily: 'Heebo, sans-serif', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'שומר...' : '💾 שמור שינויים'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Trip Card ─────────────────────────────────────────────────────────────────
function TripCard({ trip: initialTrip, rank, currentUser, navigate }: {
  trip: PublicTrip; rank: number; currentUser: any; navigate: (path: string) => void;
}) {
  const [trip, setTrip] = useState(initialTrip);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(trip.likes_count ?? 0);
  const [likeLoading, setLikeLoading] = useState(false);
  const [userRating, setUserRating] = useState<number>(0);
  const [avgRating, setAvgRating] = useState(trip.average_rating ?? 0);
  const [ratingsCount, setRatingsCount] = useState(trip.ratings_count ?? 0);
  const [showComments, setShowComments] = useState(false);
  const [showMediaUpload, setShowMediaUpload] = useState(false);
  const [commentsCount, setCommentsCount] = useState(trip.comments_count ?? 0);
  const [showRatingModal, setShowRatingModal] = useState(false);
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
    try {
      const { liked: l, likes_count: lc } = await api.publicTrips.toggleLike(trip.id);
      setLiked(l);
      setLikesCount(lc);
    } catch { } finally { setLikeLoading(false); }
  };

  const handleRate = async (val: number) => {
    if (!currentUser || currentUser.isGuest) return;
    try {
      const r = await api.publicTrips.setRating(trip.id, val);
      setUserRating(val);
      setAvgRating(r.average_rating);
      setRatingsCount(r.ratings_count);
      setShowRatingModal(false);
    } catch { }
  };

  const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
  const isOwner = currentUser && !currentUser.isGuest && currentUser.id === trip.user_id;
  const hasImage = !!trip.image_url;
  const hasVideo = !!trip.video_url;
  const hasMedia = hasImage || hasVideo;

  const displayDescription = trip.user_description || trip.description;

  return (
    <>
      <div style={{
        background: '#fff',
        borderRadius: 22,
        boxShadow: '0 2px 20px rgba(0,0,0,0.07)',
        overflow: 'hidden',
        transition: 'box-shadow 0.2s',
        border: rank <= 3 && avgRating > 0 ? '2px solid ' + (rank === 1 ? '#f59e0b' : rank === 2 ? '#94a3b8' : '#b45309') : '2px solid transparent',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div onClick={() => navigate(`/profile/${trip.user_id}`)}
            style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#0d9e6e,#34d399)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: '#fff', fontWeight: 800, cursor: 'pointer', border: '2px solid #e2e8f0' }}>
            {trip.creator_avatar
              ? <img src={trip.creator_avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
              : trip.creator_username.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span onClick={() => navigate(`/profile/${trip.user_id}`)}
                style={{ fontWeight: 800, fontSize: 14, color: '#111827', cursor: 'pointer' }}>
                {trip.creator_username}
              </span>
              {rankEmoji && avgRating > 0 && (
                <span style={{ fontSize: 18 }} title={`מקום #${rank}`}>{rankEmoji}</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>
              {new Date(trip.created_at).toLocaleDateString('he-IL')}
              {trip.region && ` · ${trip.region}`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {/* Badges */}
            {trip.difficulty && (
              <span style={{ fontSize: 11, background: `${DIFF_COLOR[trip.difficulty] || '#64748b'}18`, color: DIFF_COLOR[trip.difficulty] || '#64748b', borderRadius: 8, padding: '3px 8px', fontWeight: 700 }}>{trip.difficulty}</span>
            )}
            {isOwner && (
              <button onClick={() => setShowMediaUpload(true)}
                style={{ border: 'none', background: '#f1f5f9', borderRadius: 10, padding: '6px 10px', cursor: 'pointer', fontSize: 14 }} title="ערוך תוכן">✏️</button>
            )}
          </div>
        </div>

        {/* Title */}
        <div style={{ paddingInline: 16, paddingBottom: 6 }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#0f172a', lineHeight: 1.3 }}>{trip.title}</div>
        </div>

        {/* Media tabs */}
        {hasMedia && (
          <div style={{ display: 'flex', gap: 0, paddingInline: 16, paddingBottom: 8 }}>
            {(['map', ...(hasImage ? ['image'] : []), ...(hasVideo ? ['video'] : [])] as ('map' | 'image' | 'video')[]).map(tab => (
              <button key={tab} onClick={() => setMediaTab(tab)}
                style={{ flex: 1, padding: '6px 0', border: 'none', background: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', color: mediaTab === tab ? '#0d9e6e' : '#94a3b8', borderBottom: mediaTab === tab ? '2px solid #0d9e6e' : '2px solid transparent', fontFamily: 'Heebo, sans-serif', transition: 'all 0.15s' }}>
                {tab === 'map' ? '🗺️ מפה' : tab === 'image' ? '🖼️ תמונה' : '🎥 סרטון'}
              </button>
            ))}
          </div>
        )}

        {/* Map / Image / Video */}
        <div style={{ cursor: 'pointer' }} onClick={() => navigate(`/trips/${trip.id}`)}>
          {(!hasMedia || mediaTab === 'map') && <RouteMapCard trip={trip} />}
          {hasImage && mediaTab === 'image' && (
            <div style={{ height: 240, overflow: 'hidden' }}>
              <img src={trip.image_url!} alt={trip.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          )}
          {hasVideo && mediaTab === 'video' && (
            <div style={{ background: '#000' }}>
              <video src={trip.video_url!} controls style={{ width: '100%', maxHeight: 280, display: 'block' }} onClick={e => e.stopPropagation()} />
            </div>
          )}
        </div>

        {/* Social bar */}
        <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f1f5f9' }}>
          {/* Like */}
          <button onClick={toggleLike} disabled={likeLoading}
            style={{ display: 'flex', alignItems: 'center', gap: 5, border: 'none', background: 'none', cursor: currentUser && !currentUser.isGuest ? 'pointer' : 'default', padding: 0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24"
              fill={liked ? '#ef4444' : 'none'}
              stroke={liked ? '#ef4444' : '#64748b'} strokeWidth="2"
              style={{ transition: 'all 0.2s', transform: liked ? 'scale(1.15)' : 'scale(1)' }}>
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <span style={{ fontSize: 14, fontWeight: 700, color: liked ? '#ef4444' : '#64748b' }}>{likesCount}</span>
          </button>

          {/* Comment */}
          <button onClick={() => setShowComments(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#64748b' }}>{commentsCount}</span>
          </button>

          {/* Rate */}
          <button onClick={() => currentUser && !currentUser.isGuest && setShowRatingModal(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, border: 'none', background: 'none', cursor: currentUser && !currentUser.isGuest ? 'pointer' : 'default', padding: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24"
              fill={userRating > 0 ? '#f59e0b' : 'none'}
              stroke="#f59e0b" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b' }}>{avgRating > 0 ? avgRating.toFixed(1) : '—'}</span>
            {ratingsCount > 0 && <span style={{ fontSize: 12, color: '#94a3b8' }}>({ratingsCount})</span>}
          </button>

          <div style={{ marginRight: 'auto' }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>📍 {trip.location_count} עצירות</span>
          </div>
        </div>

        {/* Rating inline picker */}
        {showRatingModal && (
          <div style={{ padding: '12px 16px', background: '#fffbeb', borderBottom: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14, color: '#92400e', fontWeight: 700 }}>דרג את המסלול:</span>
            <StarRating value={userRating} onChange={handleRate} size={28} />
            <button onClick={() => setShowRatingModal(false)} style={{ marginRight: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18 }}>×</button>
          </div>
        )}

        {/* Description */}
        {displayDescription && (
          <div style={{ padding: '10px 16px', paddingBottom: 4 }}>
            <div style={{ fontSize: 14, color: '#334155', lineHeight: 1.6 }}>
              {trip.user_description && (
                <span style={{ fontWeight: 700, color: '#0d9e6e', marginLeft: 4 }}>{trip.creator_username}</span>
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

        {/* Stop chips */}
        {trip.locations.length > 0 && (
          <div style={{ display: 'flex', gap: 6, padding: '8px 16px', flexWrap: 'wrap', paddingBottom: 14 }}>
            {trip.locations.slice(0, 4).map((loc, i) => (
              <span key={i} style={{ background: '#f0fdf4', color: '#0d9e6e', borderRadius: 10, padding: '3px 10px', fontSize: 12, fontWeight: 600, border: '1px solid #d1fae5' }}>
                {i + 1}. {loc.name}
              </span>
            ))}
            {trip.locations.length > 4 && (
              <span style={{ fontSize: 12, color: '#94a3b8', padding: '3px 6px' }}>+{trip.locations.length - 4}</span>
            )}
          </div>
        )}

        {/* Tags row */}
        {(trip.style || trip.total_duration_hours || trip.group_type) && (
          <div style={{ display: 'flex', gap: 6, padding: '0 16px 14px', flexWrap: 'wrap' }}>
            {trip.style && <span style={{ fontSize: 11, background: '#f8fafc', color: '#475569', borderRadius: 8, padding: '3px 9px', fontWeight: 600, border: '1px solid #e2e8f0' }}>{trip.style}</span>}
            {trip.total_duration_hours && <span style={{ fontSize: 11, background: '#f8fafc', color: '#475569', borderRadius: 8, padding: '3px 9px', fontWeight: 600, border: '1px solid #e2e8f0' }}>⏱ {trip.total_duration_hours} שע'</span>}
            {trip.group_type && GROUP_ICON[trip.group_type] && <span style={{ fontSize: 11, background: '#f8fafc', color: '#475569', borderRadius: 8, padding: '3px 9px', fontWeight: 600, border: '1px solid #e2e8f0' }}>{GROUP_ICON[trip.group_type]}</span>}
          </div>
        )}

        {/* Full trip CTA */}
        <div style={{ padding: '0 16px 14px' }}>
          <button onClick={() => navigate(`/trips/${trip.id}`)}
            style={{ width: '100%', padding: '10px 0', borderRadius: 14, border: '1.5px solid #d1fae5', background: '#f0fdf4', color: '#0d9e6e', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', transition: 'all 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#0d9e6e'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f0fdf4'; (e.currentTarget as HTMLButtonElement).style.color = '#0d9e6e'; }}>
            צפה במסלול המלא ←
          </button>
        </div>
      </div>

      <CommentsPanel
        tripId={trip.id}
        isOpen={showComments}
        onClose={() => { setShowComments(false); api.publicTrips.getComments(trip.id).then(cs => setCommentsCount(cs.length)).catch(() => { }); }}
        currentUser={currentUser}
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
  const [regionFilter, setRegionFilter] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.publicTrips.list({ region: regionFilter || undefined })
      .then(data => {
        // Sort by average rating desc, then by likes
        const sorted = [...data].sort((a, b) => {
          const rA = (a.average_rating ?? 0) * 100 + (a.ratings_count ?? 0);
          const rB = (b.average_rating ?? 0) * 100 + (b.ratings_count ?? 0);
          if (rB !== rA) return rB - rA;
          return (b.likes_count ?? 0) - (a.likes_count ?? 0);
        });
        setTrips(sorted);
      })
      .catch(() => setTrips([]))
      .finally(() => setLoading(false));
  }, [regionFilter]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(load, 320);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [load]);

  return (
    <div style={{ background: '#f1f5f9', minHeight: '100vh', direction: 'rtl', paddingBottom: 80, fontFamily: 'Heebo, sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#0d9e6e 0%,#059669 60%,#047857 100%)', padding: '28px 20px 72px', position: 'relative', overflow: 'hidden' }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -40, left: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
        <div style={{ position: 'absolute', bottom: 10, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />

        <div style={{ maxWidth: 620, margin: '0 auto', position: 'relative' }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 4, fontWeight: 600, letterSpacing: 1 }}>קהילת מטיילים</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', marginBottom: 6 }}>🗺️ מסלולים ציבוריים</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.82)', marginBottom: 0 }}>
            מדורג לפי ציוני הקהילה · {trips.length > 0 ? `${trips.length} מסלולים` : ''}
          </div>
        </div>
      </div>

      {/* Search floating card */}
      <div style={{ maxWidth: 620, margin: '-40px auto 20px', padding: '0 16px', position: 'relative', zIndex: 10 }}>
        <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.12)', padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            placeholder="חפש לפי אזור, קושי..."
            value={regionFilter}
            onChange={e => setRegionFilter(e.target.value)}
            style={{ flex: 1, border: 'none', fontSize: 14, outline: 'none', fontFamily: 'Heebo, sans-serif', color: '#0f172a', background: 'transparent' }}
          />
          {regionFilter && (
            <button onClick={() => setRegionFilter('')} style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18, padding: 0, lineHeight: 1 }}>×</button>
          )}
        </div>
      </div>

      {/* Feed */}
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '0 16px' }}>
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
            <div style={{ fontSize: 52, marginBottom: 12 }}>🏔️</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1a2e2a', marginBottom: 6 }}>אין מסלולים עדיין</div>
            <div style={{ color: '#94a3b8', marginBottom: 24 }}>היה ראשון ליצור מסלול ולשתף אותו!</div>
            <button onClick={() => navigate('/RouteGenerator')}
              style={{ padding: '13px 32px', borderRadius: 16, border: 'none', background: 'linear-gradient(135deg,#0d9e6e,#059669)', color: '#fff', fontFamily: 'Heebo, sans-serif', cursor: 'pointer', fontWeight: 800, fontSize: 15 }}>
              + צור מסלול
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api, type PublicTrip, type RouteComment } from '../api';
import { useAuth } from '../context/AuthContext';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DIFF_COLOR: Record<string, string> = {
  'קל - משפחות': '#16a34a', 'קל': '#16a34a',
  'בינוני': '#d97706', 'קשה': '#dc2626', 'מאתגר': '#7c3aed',
};
const CAT_COLOR: Record<string, string> = {
  טבע: '#16a34a', מעיין: '#0284c7', מצפה: '#d97706',
  נחל: '#0891b2', 'אתר היסטורי': '#7c3aed', גיאולוגיה: '#b45309', חוף: '#0ea5e9',
};
const GROUP_ICON: Record<string, string> = {
  solo: '🚶', couple: '👫', family: '👨‍👩‍👧‍👦', friends: '👥',
  יחיד: '🚶', זוג: '👫', משפחה: '👨‍👩‍👧‍👦', חברים: '👥',
};

// ── Star rating interactive ──────────────────────────────────────────────────
function StarRating({ value, onChange, readonly }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1,2,3,4,5].map(i => (
        <svg key={i} width={readonly ? 14 : 28} height={readonly ? 14 : 28} viewBox="0 0 24 24"
          fill={i <= (hover || value) ? '#f59e0b' : 'none'}
          stroke="#f59e0b" strokeWidth="2"
          style={{ cursor: readonly ? 'default' : 'pointer', transition: 'transform 0.1s', transform: !readonly && i <= hover ? 'scale(1.2)' : 'scale(1)' }}
          onMouseEnter={() => !readonly && setHover(i)}
          onMouseLeave={() => !readonly && setHover(0)}
          onClick={() => !readonly && onChange?.(i)}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
}

// ── Map helpers ───────────────────────────────────────────────────────────────
function PhotoStopMarker({ loc, index }: { loc: any; index: number }) {
  const map = useMap();
  const icon = L.divIcon({
    html: loc.main_image
      ? `<div style="position:relative;width:52px;height:52px;border-radius:12px;overflow:hidden;border:3px solid #0d9e6e;box-shadow:0 3px 12px rgba(0,0,0,0.35);cursor:pointer;">
          <img src="${loc.main_image}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;background:#0d9e6e;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:900\\'>${index+1}</div>'"/>
          <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.65));color:#fff;font-size:9px;font-weight:700;padding:4px 4px 3px;text-align:center;font-family:Heebo,Arial;">${index+1}</div>
        </div>`
      : `<div style="width:40px;height:40px;border-radius:12px;background:${CAT_COLOR[loc.category]||'#0d9e6e'};border:3px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:15px;font-weight:900;box-shadow:0 3px 10px rgba(0,0,0,0.3);font-family:Heebo,Arial;">${index+1}</div>`,
    className: '',
    iconSize: loc.main_image ? [52, 52] : [40, 40],
    iconAnchor: loc.main_image ? [26, 26] : [20, 20],
  });
  return (
    <Marker position={[loc.latitude, loc.longitude]} icon={icon}
      eventHandlers={{ click: () => map.flyTo([loc.latitude, loc.longitude], Math.max(map.getZoom(), 13), { duration: 0.6 }) }} />
  );
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points).pad(0.18));
  }, [points, map]);
  return null;
}

// ── Media upload helper ────────────────────────────────────────────────────
function toBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PublicTripDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [trip, setTrip] = useState<PublicTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Social state
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [likeLoading, setLikeLoading] = useState(false);
  const [comments, setComments] = useState<RouteComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [avgRating, setAvgRating] = useState(0);
  const [ratingsCount, setRatingsCount] = useState(0);
  const [userRating, setUserRating] = useState(0);
  const [ratingLoading, setRatingLoading] = useState(false);

  // Owner edit state
  const [editDesc, setEditDesc] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [savingMedia, setSavingMedia] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const tripId = parseInt(id ?? '', 10);
  const isOwner = user && trip && user.id === trip.user_id;

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.publicTrips.get(tripId)
      .then(t => {
        setTrip(t);
        setLikesCount(t.likes_count ?? 0);
        setAvgRating(t.average_rating ?? 0);
        setRatingsCount(t.ratings_count ?? 0);
        setEditDesc(t.user_description ?? '');
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!tripId) return;
    api.publicTrips.getLikes(tripId).then(r => { setLiked(r.liked); setLikesCount(r.likes_count); }).catch(() => {});
    api.publicTrips.getComments(tripId).then(setComments).catch(() => {});
    api.publicTrips.getRating(tripId).then(r => {
      setAvgRating(r.average_rating);
      setRatingsCount(r.ratings_count);
      setUserRating(r.user_rating ?? 0);
    }).catch(() => {});
  }, [tripId]);

  const handleLike = async () => {
    if (!user) { navigate('/login'); return; }
    setLikeLoading(true);
    try {
      const res = await api.publicTrips.toggleLike(tripId);
      setLiked(res.liked);
      setLikesCount(res.likes_count);
    } catch {} finally { setLikeLoading(false); }
  };

  const handleRate = async (r: number) => {
    if (!user) { navigate('/login'); return; }
    setRatingLoading(true);
    try {
      const res = await api.publicTrips.setRating(tripId, r);
      setUserRating(res.user_rating);
      setAvgRating(res.average_rating);
      setRatingsCount(res.ratings_count);
    } catch {} finally { setRatingLoading(false); }
  };

  const handleComment = async () => {
    if (!user) { navigate('/login'); return; }
    if (!commentText.trim()) return;
    setCommentLoading(true);
    try {
      const c = await api.publicTrips.addComment(tripId, commentText);
      setComments(prev => [c, ...prev]);
      setCommentText('');
    } catch {} finally { setCommentLoading(false); }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      await api.publicTrips.deleteComment(tripId, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch {}
  };

  const handleSaveDesc = async () => {
    setSavingMedia(true);
    try {
      await api.publicTrips.updateMedia(tripId, { user_description: editDesc });
      setTrip(prev => prev ? { ...prev, user_description: editDesc } : prev);
      setEditMode(false);
    } catch {} finally { setSavingMedia(false); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const base64 = await toBase64(file);
      // Upload via location media endpoint and use the returned URL
      // For routes we store the URL directly (base64 as data URL for simplicity)
      await api.publicTrips.updateMedia(tripId, { image_url: base64 });
      setTrip(prev => prev ? { ...prev, image_url: base64 } : prev);
    } catch {} finally { setUploadingImage(false); }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    try {
      const base64 = await toBase64(file);
      await api.publicTrips.updateMedia(tripId, { video_url: base64 });
      setTrip(prev => prev ? { ...prev, video_url: base64 } : prev);
    } catch {} finally { setUploadingVideo(false); }
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Heebo, sans-serif' }}>
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0d9e6e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (notFound || !trip) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', direction: 'rtl', fontFamily: 'Heebo, sans-serif' }}>
      <div style={{ fontSize: 48 }}>😕</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 12 }}>המסלול לא נמצא</div>
      <button onClick={() => navigate('/trips')} style={{ marginTop: 20, padding: '10px 24px', borderRadius: 12, border: 'none', background: '#0d9e6e', color: '#fff', fontFamily: 'Heebo, sans-serif', cursor: 'pointer', fontWeight: 700 }}>חזור למסלולים</button>
    </div>
  );

  const validStops = trip.locations.filter(l => l.latitude && l.longitude);
  const pts = validStops.map(l => [l.latitude, l.longitude] as [number, number]);
  const center = pts.length ? pts[0] : [31.5, 34.8] as [number, number];

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', direction: 'rtl', paddingBottom: 60, fontFamily: 'Heebo, sans-serif' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Back bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#64748b', fontFamily: 'Heebo, sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}>← חזור</button>
        {/* Like button in header */}
        <button
          onClick={handleLike}
          disabled={likeLoading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 12, border: `2px solid ${liked ? '#ef4444' : '#e2e8f0'}`, background: liked ? '#fef2f2' : '#fff', color: liked ? '#ef4444' : '#64748b', fontFamily: 'Heebo, sans-serif', cursor: 'pointer', fontWeight: 700, fontSize: 14, transition: 'all 0.2s' }}>
          {liked ? '❤️' : '🤍'} {likesCount > 0 && likesCount}
        </button>
      </div>

      {/* Cover image if set */}
      {trip.image_url && (
        <div style={{ height: 220, overflow: 'hidden', position: 'relative' }}>
          <img src={trip.image_url} alt={trip.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.5))' }} />
        </div>
      )}

      {/* Map with photo markers */}
      {pts.length > 0 && (
        <div style={{ height: 280, position: 'relative' }}>
          <MapContainer center={center} zoom={9} style={{ height: '100%', width: '100%' }} zoomControl attributionControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {pts.length > 1 && (
              <Polyline positions={pts} pathOptions={{ color: '#0d9e6e', weight: 3, opacity: 0.85, dashArray: '8,6' }} />
            )}
            {validStops.map((loc, i) => <PhotoStopMarker key={i} loc={loc} index={i} />)}
            <FitBounds points={pts} />
          </MapContainer>
        </div>
      )}

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px' }}>

        {/* Title + meta card */}
        <div style={{ background: '#fff', borderRadius: 18, padding: '20px', marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#1a2e2a', marginBottom: 8 }}>{trip.title}</div>

          {/* Rating display */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <StarRating value={avgRating} readonly />
            <span style={{ fontSize: 14, color: '#64748b', fontWeight: 600 }}>
              {avgRating > 0 ? avgRating.toFixed(1) : 'אין דירוג'} {ratingsCount > 0 && `(${ratingsCount})`}
            </span>
          </div>

          {/* Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {(trip as any).region && <span style={{ fontSize: 13, background: '#f0fdf4', color: '#0d9e6e', borderRadius: 10, padding: '5px 12px', fontWeight: 700 }}>📍 {(trip as any).region}</span>}
            {(trip as any).difficulty && <span style={{ fontSize: 13, background: `${DIFF_COLOR[(trip as any).difficulty]||'#64748b'}18`, color: DIFF_COLOR[(trip as any).difficulty]||'#64748b', borderRadius: 10, padding: '5px 12px', fontWeight: 700 }}>{(trip as any).difficulty}</span>}
            {(trip as any).style && <span style={{ fontSize: 13, background: '#f8fafc', color: '#475569', borderRadius: 10, padding: '5px 12px', fontWeight: 600 }}>{(trip as any).style}</span>}
            {(trip as any).total_duration_hours ? <span style={{ fontSize: 13, background: '#f8fafc', color: '#64748b', borderRadius: 10, padding: '5px 12px', fontWeight: 600 }}>⏱ {(trip as any).total_duration_hours} שע'</span> : null}
            {(trip as any).total_distance_km ? <span style={{ fontSize: 13, background: '#f8fafc', color: '#64748b', borderRadius: 10, padding: '5px 12px', fontWeight: 600 }}>📏 {parseFloat((trip as any).total_distance_km).toFixed(1)} ק"מ</span> : null}
            {(trip as any).group_type && GROUP_ICON[(trip as any).group_type] && <span style={{ fontSize: 13, background: '#f8fafc', color: '#64748b', borderRadius: 10, padding: '5px 12px', fontWeight: 600 }}>{GROUP_ICON[(trip as any).group_type]}</span>}
          </div>

          {/* Description */}
          {trip.description && <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, marginBottom: 12 }}>{trip.description}</div>}

          {/* Creator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 14, borderTop: '1px solid #f0f0f0' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: trip.creator_avatar ? 'none' : 'linear-gradient(135deg,#0d9e6e,#34d399)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700 }}>
              {trip.creator_avatar ? <img src={trip.creator_avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : trip.creator_username.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2e2a' }}>{trip.creator_username}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>⚡ {trip.creator_xp} XP</div>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginRight: 'auto' }}>{new Date(trip.created_at).toLocaleDateString('he-IL')}</div>
          </div>
        </div>

        {/* Owner edit panel */}
        {isOwner && (
          <div style={{ background: '#fff', borderRadius: 18, padding: '18px', marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '2px dashed #d1fae5' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0d9e6e', marginBottom: 12 }}>✏️ עריכת המסלול שלך</div>

            {/* Description */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>תיאור אישי</div>
              <textarea
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                placeholder="ספר על המסלול — מה מיוחד בו, מתי כדאי לבוא, טיפים..."
                rows={4}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'Heebo, sans-serif', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6 }}
              />
              <button
                onClick={handleSaveDesc}
                disabled={savingMedia}
                style={{ marginTop: 8, padding: '9px 20px', borderRadius: 10, border: 'none', background: '#0d9e6e', color: '#fff', fontFamily: 'Heebo, sans-serif', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                {savingMedia ? 'שומר...' : 'שמור תיאור'}
              </button>
            </div>

            {/* Image upload */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>תמונת שער</div>
              <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploadingImage}
                  style={{ padding: '9px 18px', borderRadius: 10, border: '1.5px solid #0d9e6e', background: '#f0fdf4', color: '#0d9e6e', fontFamily: 'Heebo, sans-serif', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                  {uploadingImage ? '⏳ מעלה...' : '🖼️ העלאת תמונה'}
                </button>
                {trip.image_url && <div style={{ fontSize: 12, color: '#16a34a' }}>✓ תמונה הועלתה</div>}
              </div>
            </div>

            {/* Video upload */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>וידאו מסלול</div>
              <input ref={videoInputRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleVideoUpload} />
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  onClick={() => videoInputRef.current?.click()}
                  disabled={uploadingVideo}
                  style={{ padding: '9px 18px', borderRadius: 10, border: '1.5px solid #7c3aed', background: '#faf5ff', color: '#7c3aed', fontFamily: 'Heebo, sans-serif', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                  {uploadingVideo ? '⏳ מעלה...' : '🎬 העלאת וידאו'}
                </button>
                {trip.video_url && <div style={{ fontSize: 12, color: '#7c3aed' }}>✓ וידאו הועלה</div>}
              </div>
            </div>
          </div>
        )}

        {/* User description (public view) */}
        {trip.user_description && !isOwner && (
          <div style={{ background: '#fff', borderRadius: 18, padding: '18px', marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', borderRight: '4px solid #0d9e6e' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0d9e6e', marginBottom: 8 }}>💬 מהיוצר</div>
            <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.65, fontStyle: 'italic' }}>{trip.user_description}</div>
          </div>
        )}

        {/* Video player */}
        {trip.video_url && (
          <div style={{ background: '#fff', borderRadius: 18, padding: '18px', marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1a2e2a', marginBottom: 10 }}>🎬 וידאו מסלול</div>
            <video controls style={{ width: '100%', borderRadius: 12, maxHeight: 300 }} src={trip.video_url} />
          </div>
        )}

        {/* Rate this trip */}
        <div style={{ background: '#fff', borderRadius: 18, padding: '18px', marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1a2e2a', marginBottom: 10 }}>⭐ דרג את המסלול</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <StarRating value={userRating} onChange={handleRate} readonly={ratingLoading} />
            {userRating > 0 && <span style={{ fontSize: 13, color: '#0d9e6e', fontWeight: 700 }}>הדירוג שלך: {userRating}/5</span>}
            {!user && <span style={{ fontSize: 13, color: '#94a3b8' }}>התחבר כדי לדרג</span>}
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: '#94a3b8' }}>
            ממוצע: {avgRating > 0 ? avgRating.toFixed(1) : '—'} {ratingsCount > 0 && `מתוך ${ratingsCount} דירוגים`}
          </div>
        </div>

        {/* Stops list */}
        <div style={{ background: '#fff', borderRadius: 18, padding: '20px', marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#1a2e2a', marginBottom: 14 }}>📍 {trip.locations.length} עצירות במסלול</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {trip.locations.map((loc, i) => (
              <div
                key={i}
                onClick={() => loc.location_id && navigate(`/POIDetail?id=${loc.location_id}`)}
                style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderBottom: i < trip.locations.length-1 ? '1px solid #f0f0f0' : 'none', cursor: loc.location_id ? 'pointer' : 'default' }}
              >
                <div style={{ minWidth: 28, height: 28, borderRadius: '50%', background: CAT_COLOR[loc.category]||'#0d9e6e', color: '#fff', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>{i+1}</div>
                {loc.main_image && <img src={loc.main_image} alt="" style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2e2a' }}>{loc.name}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: CAT_COLOR[loc.category]||'#64748b', fontWeight: 600 }}>{loc.category}</span>
                    {loc.region_name && <span style={{ fontSize: 12, color: '#94a3b8' }}>{loc.region_name}</span>}
                  </div>
                </div>
                {loc.location_id ? <div style={{ fontSize: 18, color: '#cbd5e1', marginTop: 6 }}>›</div> : null}
              </div>
            ))}
          </div>

          {validStops.length > 0 && (
            <button
              onClick={() => window.open(`https://waze.com/ul?ll=${validStops[0].latitude},${validStops[0].longitude}&navigate=yes`, '_blank')}
              style={{ width: '100%', marginTop: 20, padding: '14px', border: 'none', borderRadius: 14, background: 'linear-gradient(135deg,#0d9e6e,#0bba7e)', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 14px rgba(13,158,110,0.25)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>
              נווט לנקודת ההתחלה
            </button>
          )}
        </div>

        {/* Comments */}
        <div style={{ background: '#fff', borderRadius: 18, padding: '18px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1a2e2a', marginBottom: 14 }}>
            💬 תגובות {comments.length > 0 && `(${comments.length})`}
          </div>

          {/* Add comment */}
          {user ? (
            <div style={{ marginBottom: 16 }}>
              <textarea
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="כתוב תגובה..."
                rows={3}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'Heebo, sans-serif', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6 }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  onClick={handleComment}
                  disabled={commentLoading || !commentText.trim()}
                  style={{ padding: '9px 22px', borderRadius: 10, border: 'none', background: commentText.trim() ? '#0d9e6e' : '#e2e8f0', color: commentText.trim() ? '#fff' : '#94a3b8', fontFamily: 'Heebo, sans-serif', cursor: 'pointer', fontWeight: 700, fontSize: 13, transition: 'all 0.2s' }}>
                  {commentLoading ? 'שולח...' : 'פרסם תגובה'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 14, fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '12px', background: '#f8fafc', borderRadius: 10 }}>
              <button onClick={() => navigate('/login')} style={{ color: '#0d9e6e', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontSize: 13 }}>התחבר</button> כדי להגיב
            </div>
          )}

          {/* Comments list */}
          {comments.length === 0 && (
            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, padding: '20px 0' }}>אין תגובות עדיין — היה ראשון!</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {comments.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: c.avatar_url ? 'none' : 'linear-gradient(135deg,#0d9e6e,#34d399)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#fff', fontWeight: 700 }}>
                  {c.avatar_url ? <img src={c.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : c.username.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, background: '#f8fafc', borderRadius: 12, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1a2e2a' }}>{c.username}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(c.created_at).toLocaleDateString('he-IL')}</span>
                    {user && (user.id === c.user_id || (user as any).is_admin) && (
                      <button onClick={() => handleDeleteComment(c.id)} style={{ marginRight: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#ef4444', fontFamily: 'Heebo, sans-serif' }}>מחק</button>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.55 }}>{c.content}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

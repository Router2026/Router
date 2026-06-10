/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/PublicTripDetail.tsx — Enhanced detail page with full social features
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api, type PublicTrip, type RouteComment, type RouteImage, type CommunityMedia } from '../api';
import { useAuth } from '../context/AuthContext';
import Disclaimer from '../components/Disclaimer';
import { getImageUrl } from '../utils/imageUtils';

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

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points).pad(0.2));
    else if (points.length === 1) map.setView(points[0], 13);
  }, [points, map]);
  return null;
}

function StopMarker({ loc, index }: { loc: any; index: number }) {
  const map = useMap();
  const icon = L.divIcon({
    html: loc.main_image
      ? `<div style="position:relative;width:48px;height:48px;border-radius:12px;overflow:hidden;border:3px solid #0d9e6e;box-shadow:0 3px 12px rgba(0,0,0,0.35);cursor:pointer;">
          <img src="${loc.main_image}" style="width:100%;height:100%;object-fit:cover;" onerror="this.onerror=null;this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;background:#0d9e6e;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;font-weight:900\\'>${index + 1}</div>'"/>
          <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.7));color:#fff;font-size:9px;font-weight:800;padding:4px;text-align:center;font-family:Heebo,Arial;">${index + 1}</div>
        </div>`
      : `<div style="width:36px;height:36px;border-radius:12px;background:${CAT_COLOR[loc.category] || '#0d9e6e'};border:3px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:900;box-shadow:0 3px 10px rgba(0,0,0,0.3);font-family:Heebo,Arial;">${index + 1}</div>`,
    className: '',
    iconSize: loc.main_image ? [48, 48] : [36, 36],
    iconAnchor: loc.main_image ? [24, 24] : [18, 18],
  });
  return (
    <Marker position={[loc.latitude, loc.longitude]} icon={icon}
      eventHandlers={{ click: () => map.flyTo([loc.latitude, loc.longitude], Math.max(map.getZoom(), 13), { duration: 0.6 }) }} />
  );
}

function StarRating({ value, onChange, readonly, size = 26 }: { value: number; onChange?: (v: number) => void; readonly?: boolean; size?: number }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} type="button" onClick={() => !readonly && onChange?.(i)}
          onMouseEnter={() => !readonly && setHover(i)}
          onMouseLeave={() => !readonly && setHover(0)}
          style={{ background: 'none', border: 'none', padding: 0, cursor: readonly ? 'default' : 'pointer', lineHeight: 0 }}>
          <svg width={size} height={size} viewBox="0 0 24 24"
            fill={i <= (hover || value) ? '#f59e0b' : 'none'}
            stroke={i <= (hover || value) ? '#f59e0b' : '#d1d5db'} strokeWidth="2"
            style={{ transition: 'transform 0.12s', transform: !readonly && i <= hover ? 'scale(1.25)' : 'scale(1)' }}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      ))}
    </div>
  );
}

function filterOutExistingStops(
  results: any[],
  editStops: Array<{ id: number }>,
): any[] {
  return results.filter(r => !editStops.find(s => s.id === Number.parseInt(r.id)));
}



export default function PublicTripDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isGuest = !user || (user as any).isGuest === true;
  const [trip, setTrip] = useState<PublicTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Social
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [likeLoading, setLikeLoading] = useState(false);
  const [likeAnim, setLikeAnim] = useState(false);
  const [comments, setComments] = useState<RouteComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [avgRating, setAvgRating] = useState(0);
  const [ratingsCount, setRatingsCount] = useState(0);
  const [userRating, setUserRating] = useState(0);
  const [ratingLoading, setRatingLoading] = useState(false);

  // Owner edit
  const [editDesc, setEditDesc] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [savingMedia, setSavingMedia] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [dragOverImage, setDragOverImage] = useState(false);
  const [dragOverVideo, setDragOverVideo] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const [activeMediaTab, setActiveMediaTab] = useState<'image' | 'video'>('image');
  const [routeImages, setRouteImages] = useState<RouteImage[]>([]);
  const [uploadingRouteImage, setUploadingRouteImage] = useState(false);
  const [selectedGalleryImg, setSelectedGalleryImg] = useState<string | null>(null);
  const [editPOI, setEditPOI] = useState('');
  const [editRecommendedStops, setEditRecommendedStops] = useState('');
  const routeImageInputRef = useRef<HTMLInputElement>(null);

  // Community media (any logged-in user)
  const [communityMedia, setCommunityMedia] = useState<CommunityMedia[]>([]);
  const [addingMedia, setAddingMedia] = useState(false);
  const [communityMediaTab, setCommunityMediaTab] = useState<'image' | 'video'>('image');
  const communityImageRef = useRef<HTMLInputElement>(null);
  const communityVideoRef = useRef<HTMLInputElement>(null);
  const [showAddMedia, setShowAddMedia] = useState(false);
  const [mediaCaption, setMediaCaption] = useState('');

  // Stops editor state
  const [editTab, setEditTab] = useState<'content' | 'stops'>('content');
  const [editStops, setEditStops] = useState<Array<{ id: number; name: string; category: string; main_image: string | null }>>([]);
  const [stopSearch, setStopSearch] = useState('');
  const [stopSearchResults, setStopSearchResults] = useState<any[]>([]);
  const [searchingStops, setSearchingStops] = useState(false);
  const [savingStops, setSavingStops] = useState(false);
  const stopSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tripId = Number.parseInt(id ?? '', 10);
  const isOwner = user && trip && Number(user.id) === trip.user_id;

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
        setEditPOI((t as any).points_of_interest ?? '');
        setEditRecommendedStops((t as any).recommended_stops ?? '');
        setEditStops(t.locations.map(l => ({ id: l.location_id, name: l.name, category: l.category, main_image: l.main_image })));
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!tripId) return;
    api.publicTrips.getLikes(tripId).then(r => { setLiked(r.liked); setLikesCount(r.likes_count); }).catch(() => { });
    api.publicTrips.getComments(tripId).then(setComments).catch(() => { });
    api.publicTrips.getImages(tripId).then(setRouteImages).catch(() => { });
    api.publicTrips.getCommunityMedia(tripId).then(setCommunityMedia).catch(() => { });
    api.publicTrips.getRating(tripId).then(r => {
      setAvgRating(r.average_rating); setRatingsCount(r.ratings_count); setUserRating(r.user_rating ?? 0);
    }).catch(() => { });
  }, [tripId]);

  const handleLike = async () => {
    if (!user) { navigate('/login'); return; }
    setLikeLoading(true);
    setLikeAnim(true);
    setTimeout(() => setLikeAnim(false), 400);
    try {
      const res = await api.publicTrips.toggleLike(tripId);
      setLiked(res.liked); setLikesCount(res.likes_count);
    } catch { /* intentional */ } finally { setLikeLoading(false); }
  };

  const handleRate = async (r: number) => {
    if (!user) { navigate('/login'); return; }
    setRatingLoading(true);
    try {
      const res = await api.publicTrips.setRating(tripId, r);
      setUserRating(res.user_rating); setAvgRating(res.average_rating); setRatingsCount(res.ratings_count);
    } catch { /* intentional */ } finally { setRatingLoading(false); }
  };

  const handleComment = async () => {
    if (!user) { navigate('/login'); return; }
    if (!commentText.trim()) return;
    setCommentLoading(true);
    try {
      const c = await api.publicTrips.addComment(tripId, commentText);
      setComments(prev => [...prev, c]);
      setCommentText('');
    } catch { /* intentional */ } finally { setCommentLoading(false); }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      await api.publicTrips.deleteComment(tripId, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch { /* intentional */ }
  };

  const handleSaveDesc = async () => {
    setSavingMedia(true);
    try {
      await api.publicTrips.updateMedia(tripId, {
        user_description: editDesc,
        points_of_interest: editPOI,
        recommended_stops: editRecommendedStops,
      });
      setTrip(prev => prev ? {
        ...prev,
        user_description: editDesc,
        points_of_interest: editPOI,
        recommended_stops: editRecommendedStops,
      } as any : prev);
      setEditMode(false);
    } catch { /* intentional */ } finally { setSavingMedia(false); }
  };

  const handleStopSearch = (q: string) => {
    setStopSearch(q);
    if (stopSearchTimeout.current) clearTimeout(stopSearchTimeout.current);
    if (!q.trim()) { setStopSearchResults([]); return; }
    setSearchingStops(true);
    stopSearchTimeout.current = setTimeout(async () => {
      try {
        const results = await api.locations.list({ search: q, limit: 8 });
        setStopSearchResults(filterOutExistingStops(results, editStops));
      } catch { /* intentional */ } finally { setSearchingStops(false); }
    }, 300);
  };

  const addStop = (poi: any) => {
    setEditStops(prev => [...prev, { id: Number.parseInt(poi.id), name: poi.name, category: poi.category, main_image: poi.main_image || null }]);
    setStopSearch('');
    setStopSearchResults([]);
  };

  const removeStop = (idx: number) => setEditStops(prev => prev.filter((_, i) => i !== idx));

  const moveStop = (idx: number, dir: -1 | 1) => {
    setEditStops(prev => {
      const arr = [...prev];
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= arr.length) return prev;
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  };

  const handleSaveStops = async () => {
    if (!editStops.length) return;
    setSavingStops(true);
    try {
      const updated = await api.publicTrips.updateStops(tripId, editStops.map(s => s.id));
      setTrip(updated);
      setEditMode(false);
    } catch { /* intentional */ } finally { setSavingStops(false); }
  };

  const handleRouteImageUpload = async (file: File) => {
    setUploadingRouteImage(true);
    try {
      // FIX: Upload to Supabase Storage first, then save the returned URL.
      // Previously this sent a raw base64 data URI as image_url, stuffing
      // megabytes of base64 directly into the database.
      const storageUrl = await api.locations.uploadPendingMedia(file);
      const img = await api.publicTrips.addImage(tripId, storageUrl);
      setRouteImages(prev => [...prev, img]);
    } catch (err) {
      console.error('[handleRouteImageUpload]', err);
    } finally { setUploadingRouteImage(false); }
  };

  const handleAddCommunityMedia = async (file: File, type: 'image' | 'video') => {
    setAddingMedia(true);
    try {
      // FIX: Upload to Supabase Storage first, then save the URL.
      const storageUrl = await api.locations.uploadPendingMedia(file);
      const result = await api.publicTrips.addCommunityMedia(tripId, storageUrl, type, mediaCaption || undefined);
      setCommunityMedia(prev => [result, ...prev]);
      setShowAddMedia(false);
      setMediaCaption('');
    } catch (err) {
      console.error('[handleAddCommunityMedia]', err);
    } finally { setAddingMedia(false); }
  };

  const handleDeleteCommunityMedia = async (mediaId: number) => {
    try {
      await api.publicTrips.deleteCommunityMedia(tripId, mediaId);
      setCommunityMedia(prev => prev.filter(m => m.id !== mediaId));
    } catch { /* intentional */ }
  };

  const handleDeleteRouteImage = async (imageId: number) => {
    try {
      await api.publicTrips.deleteImage(tripId, imageId);
      setRouteImages(prev => prev.filter(i => i.id !== imageId));
    } catch { /* intentional */ }
  };

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      // FIX: Upload to Supabase Storage first, then save the URL.
      const storageUrl = await api.locations.uploadPendingMedia(file);
      await api.publicTrips.updateMedia(tripId, { image_url: storageUrl });
      setTrip(prev => prev ? { ...prev, image_url: storageUrl } : prev);
    } catch (err) {
      console.error('[handleImageUpload]', err);
    } finally { setUploadingImage(false); }
  };

  const handleVideoUpload = async (file: File) => {
    setUploadingVideo(true);
    try {
      // FIX: Upload to Supabase Storage first, then save the URL.
      const storageUrl = await api.locations.uploadPendingMedia(file);
      await api.publicTrips.updateMedia(tripId, { video_url: storageUrl });
      setTrip(prev => prev ? { ...prev, video_url: storageUrl } : prev);
    } catch (err) {
      console.error('[handleVideoUpload]', err);
    } finally { setUploadingVideo(false); }
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Heebo, sans-serif', flexDirection: 'column', gap: 16 }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#0d9e6e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <div style={{ color: '#94a3b8', fontSize: 14 }}>טוען מסלול...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (notFound || !trip) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', direction: 'rtl', fontFamily: 'Heebo, sans-serif' }}>
      <div style={{ fontSize: 52 }}>😕</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 12, color: '#1a2e2a' }}>המסלול לא נמצא</div>
      <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 6, marginBottom: 24 }}>ייתכן שהמסלול הוסר או שהכתובת שגויה</div>
      <button onClick={() => navigate('/trips')} style={{ padding: '11px 24px', borderRadius: 14, border: 'none', background: '#0d9e6e', color: '#fff', fontFamily: 'Heebo, sans-serif', cursor: 'pointer', fontWeight: 700 }}>← חזור למסלולים</button>
    </div>
  );

  const validStops = trip.locations.filter(l => l.latitude && l.longitude);
  const pts = validStops.map(l => [l.latitude, l.longitude] as [number, number]);
  const center = pts.length ? pts[0] : [31.5, 34.8] as [number, number];
  const hasImage = !!trip.image_url;
  const hasVideo = !!trip.video_url;

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', direction: 'rtl', paddingBottom: 60, fontFamily: 'Heebo, sans-serif' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes heartPop { 0%{transform:scale(1)} 50%{transform:scale(1.5)} 100%{transform:scale(1)} }`}</style>

      {/* ── Sticky top bar ─────────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#64748b', fontFamily: 'Heebo, sans-serif', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 10, transition: 'background 0.15s' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f1f5f9'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}>
          ← חזור
        </button>

        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', flex: 1, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingInline: 12 }}>
          {trip.title}
        </div>

        {/* Like button */}
        <button onClick={handleLike} disabled={likeLoading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 12, border: `2px solid ${liked ? '#ef4444' : '#e2e8f0'}`, background: liked ? '#fef2f2' : '#fff', color: liked ? '#ef4444' : '#64748b', fontFamily: 'Heebo, sans-serif', cursor: 'pointer', fontWeight: 700, fontSize: 14, transition: 'all 0.2s', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24"
            fill={liked ? '#ef4444' : 'none'} stroke={liked ? '#ef4444' : '#94a3b8'} strokeWidth="2"
            style={{ transition: 'transform 0.25s', transform: likeAnim ? 'scale(1.5)' : 'scale(1)' }}>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          {likesCount > 0 && <span>{likesCount}</span>}
        </button>
      </div>

      {/* ── Cover image ────────────────────────────────────────────────── */}
      {hasImage && (
        <div style={{ height: 240, overflow: 'hidden', position: 'relative' }}>
          <img src={trip.image_url!} alt={trip.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.5))' }} />
        </div>
      )}

      {/* ── Interactive map ────────────────────────────────────────────── */}
      {pts.length > 0 && (
        <div style={{ height: hasImage ? 260 : 300, position: 'relative' }}>
          <MapContainer center={center} zoom={9} style={{ height: '100%', width: '100%' }} zoomControl attributionControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {pts.length > 1 && (
              <Polyline positions={pts} pathOptions={{ color: '#0d9e6e', weight: 3.5, opacity: 0.9, dashArray: '10,6' }} />
            )}
            {validStops.map((loc, i) => <StopMarker key={i} loc={loc} index={i} />)}
            <FitBounds points={pts} />
          </MapContainer>
          <div style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 1000, background: 'rgba(255,255,255,0.92)', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 700, color: '#374151', backdropFilter: 'blur(4px)', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
            📍 {validStops.length} עצירות
          </div>
        </div>
      )}

      <div style={{ maxWidth: 660, margin: '0 auto', padding: '20px 16px' }}>

        {/* ── Title + meta card ────────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '20px', marginBottom: 14, boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', marginBottom: 10 }}>{trip.title}</div>

          {/* Rating display */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <StarRating value={Math.round(avgRating)} readonly size={18} />
            <span style={{ fontSize: 14, color: '#64748b', fontWeight: 600 }}>
              {avgRating > 0 ? avgRating.toFixed(1) : 'אין דירוג'}
              {ratingsCount > 0 && <span style={{ color: '#94a3b8', fontWeight: 400 }}> ({ratingsCount} דירוגים)</span>}
            </span>
          </div>

          {/* Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {(trip as any).region && <span style={{ fontSize: 13, background: '#f0fdf4', color: '#0d9e6e', borderRadius: 10, padding: '5px 12px', fontWeight: 700 }}>📍 {(trip as any).region}</span>}
            {(trip as any).difficulty && <span style={{ fontSize: 13, background: `${DIFF_COLOR[(trip as any).difficulty] || '#64748b'}18`, color: DIFF_COLOR[(trip as any).difficulty] || '#64748b', borderRadius: 10, padding: '5px 12px', fontWeight: 700 }}>{(trip as any).difficulty}</span>}
            {(trip as any).style && <span style={{ fontSize: 13, background: '#f8fafc', color: '#475569', borderRadius: 10, padding: '5px 12px', fontWeight: 600 }}>{(trip as any).style}</span>}
            {(trip as any).total_duration_hours && <span style={{ fontSize: 13, background: '#f8fafc', color: '#64748b', borderRadius: 10, padding: '5px 12px', fontWeight: 600 }}>⏱ {(trip as any).total_duration_hours} שע'</span>}
            {(trip as any).total_distance_km && <span style={{ fontSize: 13, background: '#f8fafc', color: '#64748b', borderRadius: 10, padding: '5px 12px', fontWeight: 600 }}>📏 {Number.parseFloat((trip as any).total_distance_km).toFixed(1)} ק"מ</span>}
            {(trip as any).group_type && GROUP_ICON[(trip as any).group_type] && <span style={{ fontSize: 13, background: '#f8fafc', color: '#64748b', borderRadius: 10, padding: '5px 12px', fontWeight: 600 }}>{GROUP_ICON[(trip as any).group_type]}</span>}
          </div>

          {/* Creator row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
            <button type="button"
              onClick={() => navigate(`/profile/${trip.user_id}`)}
              style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#0d9e6e,#34d399)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', border: '2px solid #e2e8f0' }}>
              {trip.creator_avatar ? <img src={trip.creator_avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : trip.creator_username.charAt(0).toUpperCase()}
            </button>
            <div style={{ flex: 1 }}>
              <button type="button"
                onClick={() => navigate(`/profile/${trip.user_id}`)}
                style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
                {trip.creator_username}
              </button>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>⚡ {trip.creator_xp} XP · {new Date(trip.created_at).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
            <button
              onClick={() => navigate(`/profile/${trip.user_id}`)}
              style={{ padding: '7px 16px', border: '1.5px solid #e2e8f0', borderRadius: 12, background: '#fff', color: '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
              פרופיל
            </button>
          </div>
        </div>

        {/* ── User description (public view) ───────────────────────────── */}
        {trip.user_description && !isOwner && (
          <div style={{ background: '#fff', borderRadius: 20, padding: '18px 20px', marginBottom: 14, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', borderRight: '4px solid #0d9e6e' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#0d9e6e,#34d399)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 800, flexShrink: 0 }}>
                {trip.creator_avatar ? <img src={trip.creator_avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : trip.creator_username.charAt(0).toUpperCase()}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0d9e6e' }}>💬 מהיוצר</div>
            </div>
            <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.7, fontStyle: 'italic' }}>{trip.user_description}</div>
          </div>
        )}

        {/* ── Points of interest + Recommended stops (public view) ─────── */}
        {((trip as any).points_of_interest || (trip as any).recommended_stops) && (
          <div style={{ background: '#fff', borderRadius: 20, padding: '18px 20px', marginBottom: 14, boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
            {(trip as any).points_of_interest && (
              <div style={{ marginBottom: (trip as any).recommended_stops ? 16 : 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  ✨ נקודות עניין מיוחדות
                </div>
                <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.7 }}>{(trip as any).points_of_interest}</div>
              </div>
            )}
            {(trip as any).recommended_stops && (
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  🛑 עצירות מומלצות
                </div>
                <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.7 }}>{(trip as any).recommended_stops}</div>
              </div>
            )}
          </div>
        )}

        {/* ── Media tabs (image + video) ────────────────────────────────── */}
        {(hasImage || hasVideo) && (
          <div style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', marginBottom: 14, boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
            {(hasImage && hasVideo) && (
              <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9' }}>
                {(['image', 'video'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveMediaTab(tab)}
                    style={{ flex: 1, padding: '12px 0', border: 'none', background: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: activeMediaTab === tab ? '#0d9e6e' : '#94a3b8', borderBottom: activeMediaTab === tab ? '2px solid #0d9e6e' : '2px solid transparent', fontFamily: 'Heebo, sans-serif', transition: 'all 0.15s' }}>
                    {tab === 'image' ? '🖼️ תמונה' : '🎥 סרטון'}
                  </button>
                ))}
              </div>
            )}
            {hasImage && (!hasVideo || activeMediaTab === 'image') && (
              <div style={{ height: 240, overflow: 'hidden' }}>
                <img src={trip.image_url!} alt={trip.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
            )}
            {hasVideo && (!hasImage || activeMediaTab === 'video') && (
              <div style={{ background: '#0f172a' }}>
                <video controls style={{ width: '100%', maxHeight: 300, display: 'block' }} src={trip.video_url!}>
                  <track kind="captions" />
                </video>
              </div>
            )}
          </div>
        )}

        {/* ── Owner edit panel ──────────────────────────────────────────── */}
        {isOwner && (
          <div style={{ background: '#fff', borderRadius: 20, marginBottom: 14, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '2px solid #bbf7d0', overflow: 'hidden' }}>

            {/* Panel header */}
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0d9e6e' }}>✏️ ניהול המסלול</div>
              <button onClick={() => setEditMode(v => !v)}
                style={{ padding: '6px 14px', border: '1.5px solid #0d9e6e', borderRadius: 10, background: editMode ? '#0d9e6e' : '#fff', color: editMode ? '#fff' : '#0d9e6e', fontWeight: 700, cursor: 'pointer', fontSize: 13, fontFamily: 'Heebo, sans-serif', transition: 'all 0.2s' }}>
                {editMode ? '▲ סגור' : '▼ ערוך'}
              </button>
            </div>

            {/* Status badges (collapsed) */}
            {!editMode && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingInline: 20, paddingBottom: 16 }}>
                {[
                  { ok: !!trip.user_description, label: 'תיאור' },
                  { ok: !!trip.image_url, label: 'תמונה' },
                  { ok: !!trip.video_url, label: 'סרטון' },
                  { ok: !!(trip as any).points_of_interest, label: 'נקודות עניין' },
                  { ok: trip.locations.length > 0, label: `${trip.locations.length} עצירות` },
                ].map(b => (
                  <span key={b.label} style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: b.ok ? '#f0fdf4' : '#f8fafc', color: b.ok ? '#16a34a' : '#94a3b8', border: `1px solid ${b.ok ? '#bbf7d0' : '#e2e8f0'}` }}>
                    {b.ok ? '✅' : '⬜'} {b.label}
                  </span>
                ))}
              </div>
            )}

            {editMode && (
              <>
                {/* Tabs */}
                <div style={{ display: 'flex', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                  {([['content', '📝 תוכן'], ['stops', '📍 עצירות']] as const).map(([tab, label]) => (
                    <button key={tab} onClick={() => setEditTab(tab)}
                      style={{ flex: 1, padding: '12px 0', border: 'none', background: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', color: editTab === tab ? '#0d9e6e' : '#94a3b8', borderBottom: editTab === tab ? '2px solid #0d9e6e' : '2px solid transparent', transition: 'all 0.15s' }}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* ── Content tab ── */}
                {editTab === 'content' && (
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>📝 תיאור אישי</div>
                      <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)}
                        placeholder="ספר על המסלול — מה מיוחד בו, מתי כדאי לבוא, טיפים..." rows={3}
                        style={{ width: '100%', padding: '11px 13px', borderRadius: 13, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'Heebo, sans-serif', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.65, transition: 'border-color 0.2s' }}
                        onFocus={e => e.currentTarget.style.borderColor = '#0d9e6e'}
                        onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'} />
                    </div>

                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>✨ נקודות עניין מיוחדות</div>
                      <textarea value={editPOI} onChange={e => setEditPOI(e.target.value)}
                        placeholder="מפלים, תצפיות, עצים עתיקים — מה שכדאי לשים לב אליו..." rows={3}
                        style={{ width: '100%', padding: '11px 13px', borderRadius: 13, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'Heebo, sans-serif', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.65, transition: 'border-color 0.2s' }}
                        onFocus={e => e.currentTarget.style.borderColor = '#7c3aed'}
                        onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'} />
                    </div>

                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>🛑 עצירות מומלצות</div>
                      <textarea value={editRecommendedStops} onChange={e => setEditRecommendedStops(e.target.value)}
                        placeholder="היכן מומלץ לעצור ולהתעכב במסלול?" rows={3}
                        style={{ width: '100%', padding: '11px 13px', borderRadius: 13, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'Heebo, sans-serif', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.65, transition: 'border-color 0.2s' }}
                        onFocus={e => e.currentTarget.style.borderColor = '#7c3aed'}
                        onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'} />
                    </div>

                    <button onClick={handleSaveDesc} disabled={savingMedia}
                      style={{ padding: '11px 24px', borderRadius: 12, border: 'none', background: savingMedia ? '#94a3b8' : '#0d9e6e', color: '#fff', fontFamily: 'Heebo, sans-serif', cursor: savingMedia ? 'default' : 'pointer', fontWeight: 700, fontSize: 14, alignSelf: 'flex-start' }}>
                      {savingMedia ? '⏳ שומר...' : '💾 שמור תוכן'}
                    </button>

                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>🖼️ תמונת שער</div>
                      <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
                      {trip.image_url ? (
                        <div style={{ position: 'relative', borderRadius: 13, overflow: 'hidden', height: 130 }}>
                          <img src={trip.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt="" />
                          <button onClick={() => imageInputRef.current?.click()}
                            style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: 10, padding: '6px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
                            🔄 החלף תמונה
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => imageInputRef.current?.click()}
                          onDragOver={e => { e.preventDefault(); setDragOverImage(true); }}
                          onDragLeave={() => setDragOverImage(false)}
                          onDrop={e => { e.preventDefault(); setDragOverImage(false); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('image/')) handleImageUpload(f); }}
                          style={{ border: `2px dashed ${dragOverImage ? '#0d9e6e' : '#d1d5db'}`, borderRadius: 13, padding: '22px 16px', textAlign: 'center', background: dragOverImage ? '#f0fdf4' : '#fafafa', cursor: 'pointer', transition: 'all 0.2s', width: '100%' }}>
                          <div style={{ fontSize: 26, marginBottom: 6 }}>📷</div>
                          <div style={{ fontWeight: 700, color: '#374151', fontSize: 13 }}>{uploadingImage ? '⏳ מעלה...' : 'גרור תמונה או לחץ'}</div>
                        </button>
                      )}

                      <div style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>🎥 סרטון מסלול</div>
                      <input ref={videoInputRef} type="file" accept="video/*" style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleVideoUpload(f); }} />
                      {trip.video_url ? (
                        <div style={{ borderRadius: 13, overflow: 'hidden', background: '#0f172a' }}>
                          <video controls style={{ width: '100%', maxHeight: 180, display: 'block' }} src={trip.video_url}>
                            <track kind="captions" />
                          </video>
                          <button onClick={() => videoInputRef.current?.click()}
                            style={{ width: '100%', padding: '9px', border: 'none', background: '#1e293b', color: '#94a3b8', fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontSize: 13 }}>
                            🔄 החלף סרטון
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => videoInputRef.current?.click()}
                          onDragOver={e => { e.preventDefault(); setDragOverVideo(true); }}
                          onDragLeave={() => setDragOverVideo(false)}
                          onDrop={e => { e.preventDefault(); setDragOverVideo(false); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('video/')) handleVideoUpload(f); }}
                          style={{ border: `2px dashed ${dragOverVideo ? '#7c3aed' : '#d1d5db'}`, borderRadius: 13, padding: '22px 16px', textAlign: 'center', background: dragOverVideo ? '#faf5ff' : '#fafafa', cursor: 'pointer', transition: 'all 0.2s', width: '100%' }}>
                          <div style={{ fontSize: 26, marginBottom: 6 }}>🎬</div>
                          <div style={{ fontWeight: 700, color: '#374151', fontSize: 13 }}>{uploadingVideo ? '⏳ מעלה...' : 'גרור סרטון או לחץ'}</div>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Stops tab ── */}
                {editTab === 'stops' && (
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* Search box */}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8 }}>🔍 הוסף עצירה</div>
                      <div style={{ position: 'relative' }}>
                        <input value={stopSearch} onChange={e => handleStopSearch(e.target.value)}
                          placeholder="חפש מקום לפי שם..."
                          style={{ width: '100%', padding: '11px 13px', borderRadius: 13, border: '1.5px solid #e2e8f0', fontSize: 14, fontFamily: 'Heebo, sans-serif', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
                          onFocus={e => e.currentTarget.style.borderColor = '#0d9e6e'}
                          onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'} />
                        {searchingStops && (
                          <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="3" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                          </div>
                        )}
                      </div>
                      {stopSearchResults.length > 0 && (
                        <div style={{ marginTop: 6, borderRadius: 13, border: '1.5px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
                          {stopSearchResults.map(poi => (
                            <button type="button" key={poi.id} onClick={() => addStop(poi)}
                              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', background: '#fff', transition: 'background 0.15s', width: '100%', border: 'none', textAlign: 'right' }}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f0fdf4'}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#fff'}>
                              {poi.main_image ? (
                                <img src={getImageUrl(poi.main_image, 'thumb')} alt="" loading="lazy" decoding="async" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                              ) : (
                                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📍</div>
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{poi.name}</div>
                                <div style={{ fontSize: 12, color: '#94a3b8' }}>{poi.category} · {poi.region}</div>
                              </div>
                              <span style={{ fontSize: 20, color: '#0d9e6e', fontWeight: 900, flexShrink: 0 }}>+</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Current stops list (draggable order) */}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8 }}>
                        📍 עצירות נוכחיות
                        <span style={{ fontWeight: 400, color: '#94a3b8', marginRight: 6 }}>({editStops.length})</span>
                      </div>
                      {editStops.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: 14, background: '#f8fafc', borderRadius: 12 }}>
                          אין עצירות — חפש והוסף מקומות למסלול
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {editStops.map((stop, i) => (
                          <div key={`${stop.id}-${i}`}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f8fafc', borderRadius: 13, padding: '10px 12px', border: '1.5px solid #e2e8f0' }}>
                            <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#0d9e6e', color: '#fff', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                            {stop.main_image && (
                              <img src={getImageUrl(stop.main_image, 'thumb')} alt="" loading="lazy" decoding="async" style={{ width: 38, height: 38, borderRadius: 9, objectFit: 'cover', flexShrink: 0 }} />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stop.name}</div>
                              <div style={{ fontSize: 11, color: '#94a3b8' }}>{stop.category}</div>
                            </div>
                            {/* Reorder buttons */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                              <button onClick={() => moveStop(i, -1)} disabled={i === 0}
                                style={{ border: 'none', background: i === 0 ? '#f1f5f9' : '#e2e8f0', borderRadius: 6, width: 24, height: 22, cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? '#cbd5e1' : '#475569', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>▲</button>
                              <button onClick={() => moveStop(i, 1)} disabled={i === editStops.length - 1}
                                style={{ border: 'none', background: i === editStops.length - 1 ? '#f1f5f9' : '#e2e8f0', borderRadius: 6, width: 24, height: 22, cursor: i === editStops.length - 1 ? 'default' : 'pointer', color: i === editStops.length - 1 ? '#cbd5e1' : '#475569', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>▼</button>
                            </div>
                            {/* Remove */}
                            <button onClick={() => removeStop(i)}
                              style={{ width: 28, height: 28, border: 'none', background: '#fee2e2', borderRadius: 8, color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>×</button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button onClick={handleSaveStops} disabled={savingStops || editStops.length === 0}
                      style={{ width: '100%', padding: '13px', borderRadius: 14, border: 'none', background: (savingStops || editStops.length === 0) ? '#94a3b8' : 'linear-gradient(135deg,#0d9e6e,#059669)', color: '#fff', fontFamily: 'Heebo, sans-serif', fontWeight: 800, fontSize: 15, cursor: (savingStops || editStops.length === 0) ? 'default' : 'pointer', transition: 'all 0.2s' }}>
                      {savingStops ? '⏳ שומר מסלול...' : `💾 שמור מסלול (${editStops.length} עצירות)`}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

                {/* ── Route Images Gallery ─────────────────────────────────────── */}
        {(routeImages.length > 0 || isOwner) && (
          <div style={{ background: '#fff', borderRadius: 20, padding: '18px 20px', marginBottom: 14, boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                📸 גלריית תמונות מהמסלול
                {routeImages.length > 0 && <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, marginRight: 6 }}>({routeImages.length})</span>}
              </div>
              {isOwner && (
                <>
                  <input ref={routeImageInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                    onChange={e => { Array.from(e.target.files || []).forEach(f => handleRouteImageUpload(f)); e.target.value = ''; }} />
                  <button onClick={() => routeImageInputRef.current?.click()} disabled={uploadingRouteImage}
                    style={{ padding: '7px 16px', borderRadius: 12, border: '1.5px solid #0d9e6e', background: '#f0fdf4', color: '#0d9e6e', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {uploadingRouteImage ? '⏳ מעלה...' : '+ הוסף תמונות'}
                  </button>
                </>
              )}
            </div>

            {routeImages.length === 0 && isOwner && (
              <button type="button" style={{ border: '2px dashed #d1d5db', borderRadius: 14, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', background: '#fafafa', width: '100%' }}
                onClick={() => routeImageInputRef.current?.click()}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
                <div style={{ fontWeight: 700, color: '#374151', fontSize: 14 }}>הוסף תמונות מהמסלול</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>שתף את חוויות הטיול עם הקהילה</div>
              </button>
            )}

            {routeImages.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {routeImages.map((img) => (
                  <div key={img.id} style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', aspectRatio: '1' }}>
                    <button type="button" onClick={() => setSelectedGalleryImg(img.image_url)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: '100%', height: '100%', display: 'block' }}>
                      <img src={img.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </button>
                    {isOwner && (
                      <button onClick={e => { e.stopPropagation(); handleDeleteRouteImage(img.id); }}
                        style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Lightbox ──────────────────────────────────────────────────── */}
        {selectedGalleryImg && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button type="button" aria-label="סגור" onClick={() => setSelectedGalleryImg(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.9)', border: 'none', cursor: 'default', padding: 0 }} />
            <img src={selectedGalleryImg} alt="" style={{ maxWidth: '95vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12, position: 'relative', zIndex: 1 }} />
            <button onClick={() => setSelectedGalleryImg(null)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 40, height: 40, color: '#fff', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
              ×
            </button>
          </div>
        )}

        {/* ── Community Media (any user can contribute) ───────────────── */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '18px 20px', marginBottom: 14, boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
              📸 תמונות וסרטונים מהקהילה
              {communityMedia.length > 0 && <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, marginRight: 6 }}>({communityMedia.length})</span>}
            </div>
            {user && !isGuest && (
              <button onClick={() => setShowAddMedia(v => !v)}
                style={{ padding: '7px 14px', borderRadius: 12, border: '1.5px solid #7c3aed', background: showAddMedia ? '#7c3aed' : '#faf5ff', color: showAddMedia ? '#fff' : '#7c3aed', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
                {showAddMedia ? '▲ סגור' : '+ הוסף'}
              </button>
            )}
          </div>

          {/* Add media panel */}
          {showAddMedia && user && !isGuest && (
            <div style={{ background: '#f8fafc', borderRadius: 14, padding: 16, marginBottom: 16, border: '1.5px solid #e2e8f0' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {(['image', 'video'] as const).map(t => (
                  <button key={t} onClick={() => setCommunityMediaTab(t)}
                    style={{ flex: 1, padding: '8px', borderRadius: 10, border: 'none', background: communityMediaTab === t ? '#7c3aed' : '#e2e8f0', color: communityMediaTab === t ? '#fff' : '#64748b', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
                    {t === 'image' ? '🖼️ תמונה' : '🎥 סרטון'}
                  </button>
                ))}
              </div>
              <input value={mediaCaption} onChange={e => setMediaCaption(e.target.value)}
                placeholder="כיתוב אופציונלי..."
                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'Heebo, sans-serif', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }} />
              <input ref={communityImageRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleAddCommunityMedia(f, 'image'); e.target.value = ''; }} />
              <input ref={communityVideoRef} type="file" accept="video/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleAddCommunityMedia(f, 'video'); e.target.value = ''; }} />
              <button
                onClick={() => communityMediaTab === 'image' ? communityImageRef.current?.click() : communityVideoRef.current?.click()}
                disabled={addingMedia}
                style={{ width: '100%', padding: '11px', borderRadius: 12, border: 'none', background: addingMedia ? '#94a3b8' : '#7c3aed', color: '#fff', fontWeight: 700, cursor: addingMedia ? 'default' : 'pointer', fontFamily: 'Heebo, sans-serif', fontSize: 14 }}>
                {addingMedia ? '⏳ מעלה...' : `📤 העלה ${communityMediaTab === 'image' ? 'תמונה' : 'סרטון'} (+10 XP)`}
              </button>
            </div>
          )}

          {/* Media grid */}
          {communityMedia.length === 0 && !showAddMedia && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: 13 }}>
              {user && !isGuest ? 'היה הראשון לשתף תמונה מהמסלול הזה!' : 'אין עדיין תמונות מהקהילה'}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {communityMedia.map(m => (
              <div key={m.id} style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #f1f5f9' }}>
                {/* Uploader info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#f8fafc', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {m.avatar_url
                      ? <img src={m.avatar_url} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                      : <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#7c3aed', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{m.username?.[0]?.toUpperCase()}</div>
                    }
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{m.username}</div>
                      {m.caption && <div style={{ fontSize: 11, color: '#64748b' }}>{m.caption}</div>}
                    </div>
                  </div>
                  {user && (Number(user.id) === m.user_id || Number(user.id) === trip?.user_id) && (
                    <button onClick={() => handleDeleteCommunityMedia(m.id)}
                      style={{ background: '#fee2e2', border: 'none', borderRadius: 8, width: 26, height: 26, color: '#ef4444', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>×</button>
                  )}
                </div>
                {m.media_type === 'image'
                  ? <button type="button" onClick={() => setSelectedGalleryImg(m.url)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: '100%', display: 'block' }}>
                      <img src={m.url} alt={m.caption || ''}
                        style={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block' }} />
                    </button>
                  : <video src={m.url} controls style={{ width: '100%', maxHeight: 280, display: 'block', background: '#000' }}>
                      <track kind="captions" />
                    </video>
                }
              </div>
            ))}
          </div>
        </div>

        {/* ── Rate this trip ────────────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '18px 20px', marginBottom: 14, boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>⭐ דרג את המסלול</div>
          {user ? (
            <div>
              <StarRating value={userRating} onChange={handleRate} readonly={ratingLoading} size={32} />
              {userRating > 0 && (
                <div style={{ marginTop: 8, fontSize: 13, color: '#0d9e6e', fontWeight: 700 }}>הדירוג שלך: {userRating}/5 ⭐</div>
              )}
              <div style={{ marginTop: 6, fontSize: 12, color: '#94a3b8' }}>
                ממוצע: {avgRating > 0 ? avgRating.toFixed(1) : '—'}{ratingsCount > 0 && ` · ${ratingsCount} דירוגים`}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#94a3b8' }}>
              <button onClick={() => navigate('/login')} style={{ color: '#0d9e6e', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontSize: 13 }}>התחבר</button> כדי לדרג
            </div>
          )}
        </div>

        {/* ── Stops list ────────────────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '20px', marginBottom: 14, boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', marginBottom: 14 }}>📍 {trip.locations.length} עצירות במסלול</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {trip.locations.map((loc, i) => (
              <button type="button" key={`${loc.location_id ?? loc.name ?? i}`}
                onClick={() => loc.location_id && navigate(`/POIDetail?id=${loc.location_id}`)}
                style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderBottom: i < trip.locations.length - 1 ? '1px solid #f1f5f9' : 'none', cursor: loc.location_id ? 'pointer' : 'default', transition: 'background 0.15s', borderRadius: 8, background: 'none', border: 'none', width: '100%', textAlign: 'right' }}>
                <div style={{ minWidth: 30, height: 30, borderRadius: '50%', background: CAT_COLOR[loc.category] || '#0d9e6e', color: '#fff', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2, boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>{i + 1}</div>
                {loc.main_image && <img src={getImageUrl(loc.main_image, 'thumb')} alt="" loading="lazy" decoding="async" style={{ width: 52, height: 52, borderRadius: 11, objectFit: 'cover', flexShrink: 0 }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{loc.name}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    {loc.category && <span style={{ fontSize: 12, color: CAT_COLOR[loc.category] || '#64748b', fontWeight: 600 }}>{loc.category}</span>}
                    {loc.region_name && <span style={{ fontSize: 12, color: '#94a3b8' }}>{loc.region_name}</span>}
                  </div>
                </div>
                {!!loc.location_id && <div style={{ fontSize: 20, color: '#cbd5e1', alignSelf: 'center' }}>›</div>}
              </button>
            ))}
          </div>

          {validStops.length > 0 && (
            <button
              onClick={() => window.open(`https://waze.com/ul?ll=${validStops[0].latitude},${validStops[0].longitude}&navigate=yes`, '_blank')}
              style={{ width: '100%', marginTop: 18, padding: '14px', border: 'none', borderRadius: 14, background: 'linear-gradient(135deg,#0d9e6e,#059669)', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 14px rgba(13,158,110,0.25)', transition: 'opacity 0.2s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.9'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>
              נווט לנקודת ההתחלה
            </button>
          )}
        </div>

        {/* ── Comments ──────────────────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '18px 20px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            💬 תגובות {comments.length > 0 && <span style={{ background: '#f0fdf4', color: '#0d9e6e', borderRadius: 20, padding: '2px 10px', fontSize: 13, fontWeight: 700 }}>{comments.length}</span>}
          </div>

          {/* Add comment */}
          {user ? (
            <div style={{ marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#0d9e6e,#34d399)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#fff', fontWeight: 800, flexShrink: 0, marginTop: 2 }}>
                {(user as any).avatar_url ? <img src={(user as any).avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : ((user as any).username || 'U').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <textarea
                  ref={commentInputRef}
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleComment())}
                  placeholder="כתוב תגובה על המסלול..."
                  rows={2}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 14, border: '1.5px solid #e2e8f0', fontSize: 14, fontFamily: 'Heebo, sans-serif', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6, transition: 'border-color 0.2s' }}
                  onFocus={e => e.currentTarget.style.borderColor = '#0d9e6e'}
                  onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>Enter לשליחה · Shift+Enter לשורה חדשה</div>
                  <button onClick={handleComment} disabled={commentLoading || !commentText.trim()}
                    style={{ padding: '8px 20px', borderRadius: 11, border: 'none', background: commentText.trim() ? 'linear-gradient(135deg,#0d9e6e,#059669)' : '#e2e8f0', color: commentText.trim() ? '#fff' : '#94a3b8', fontFamily: 'Heebo, sans-serif', cursor: commentText.trim() ? 'pointer' : 'default', fontWeight: 700, fontSize: 13, transition: 'all 0.2s' }}>
                    {commentLoading ? '...' : 'פרסם'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 16, textAlign: 'center', padding: '14px', background: '#f8fafc', borderRadius: 13, fontSize: 14, color: '#94a3b8' }}>
              <button onClick={() => navigate('/login')} style={{ color: '#0d9e6e', fontWeight: 800, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontSize: 14 }}>התחבר</button> כדי להגיב על המסלול
            </div>
          )}

          {/* Comments list */}
          {comments.length === 0 && (
            <div style={{ textAlign: 'center', padding: '28px 0', color: '#94a3b8', fontSize: 14 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>💬</div>
              <div>אין תגובות עדיין — היה הראשון!</div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {comments.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <button type="button"
                  onClick={() => navigate(`/profile/${c.user_id}`)}
                  style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#0d9e6e,#34d399)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#fff', fontWeight: 800, cursor: 'pointer', border: 'none', padding: 0 }}>
                  {c.avatar_url ? <img src={c.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : c.username.charAt(0).toUpperCase()}
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{ background: '#f8fafc', borderRadius: '4px 14px 14px 14px', padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                      <button type="button"
                        onClick={() => navigate(`/profile/${c.user_id}`)}
                        style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
                        {c.username}
                      </button>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(c.created_at).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      {user && (user.id === c.user_id || (user as any).is_admin) && (
                        <button onClick={() => handleDeleteComment(c.id)} style={{ marginRight: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#ef4444', fontFamily: 'Heebo, sans-serif', padding: '2px 6px', borderRadius: 6 }}>מחק</button>
                      )}
                    </div>
                    <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.6 }}>{c.content}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <Disclaimer />
      </div>
    </div>
  );
}
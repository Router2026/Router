/**
 * Explore Page — with Trip Bucket integration
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, type POI } from '../api';
import RouterLogo from '../assets/logo.jpeg';
import { useTripBucket } from '../context/TripBucketContext';
import { useFavorites } from '../context/FavoritesContext';
import { useAuth } from '../context/AuthContext';
import TripBucketFab from '../components/TripBucketFab';
import TripBucketSheet from '../components/TripBucketSheet';
import { useGuestLock } from '../components/LockedFeature';

const DIFFICULTIES = ['קל - משפחות', 'בינוני', 'מאתגר', 'אקסטרים'];

const DIFF_COLORS: Record<string, { color: string; bg: string }> = {
  'קל - משפחות': { color: '#16a34a', bg: '#f0fdf4' },
  'קל': { color: '#16a34a', bg: '#f0fdf4' },
  'בינוני': { color: '#d97706', bg: '#fffbeb' },
  'מאתגר': { color: '#dc2626', bg: '#fef2f2' },
  'קשה': { color: '#dc2626', bg: '#fef2f2' },
  'אקסטרים': { color: '#7c3aed', bg: '#faf5ff' },
};

function FilterPanel({ open, onClose, selectedRegions, setSelectedRegions, selectedCategories, setSelectedCategories, selectedDifficulties, setSelectedDifficulties, hasWater, setHasWater, hasShade, setHasShade, accessible, setAccessible, dynamicRegions, dynamicCategories }: any) {
  if (!open) return null;
  const toggle = (arr: string[], setArr: (v: string[]) => void, val: string) =>
    setArr(arr.includes(val) ? arr.filter((x: string) => x !== val) : [...arr, val]);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'flex-start' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 300, background: '#fff', overflowY: 'auto', padding: '24px 20px', direction: 'rtl' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <button onClick={() => { setSelectedRegions([]); setSelectedCategories([]); setSelectedDifficulties([]); setHasWater(false); setHasShade(false); setAccessible(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#64748b', fontFamily: 'Heebo, sans-serif' }}>נקה הכל</button>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#1a2e2a' }}>סינון</div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <FilterSection title="אזור"><TagGrid items={dynamicRegions || []} selected={selectedRegions} onToggle={(v: string) => toggle(selectedRegions, setSelectedRegions, v)} /></FilterSection>
        <FilterSection title="סוג אתר"><TagGrid items={dynamicCategories || []} selected={selectedCategories} onToggle={(v: string) => toggle(selectedCategories, setSelectedCategories, v)} /></FilterSection>
        <FilterSection title="רמת קושי"><TagGrid items={DIFFICULTIES} selected={selectedDifficulties} onToggle={(v: string) => toggle(selectedDifficulties, setSelectedDifficulties, v)} /></FilterSection>
        <FilterSection title="מאפיינים">
          {[{ label: 'יש מים', state: hasWater, set: setHasWater }, { label: 'יש צל', state: hasShade, set: setHasShade }, { label: 'נגיש לעגלות', state: accessible, set: setAccessible }].map(f => (
            <label key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, cursor: 'pointer', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 14, color: '#1a2e2a' }}>{f.label}</span>
              <div onClick={() => f.set(!f.state)} style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, border: `2px solid ${f.state ? '#0d9e6e' : '#cbd5e1'}`, background: f.state ? '#0d9e6e' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                {f.state && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
              </div>
            </label>
          ))}
        </FilterSection>
      </div>
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 24 }}><div style={{ fontSize: 15, fontWeight: 800, color: '#1a2e2a', marginBottom: 12 }}>{title}</div>{children}</div>;
}

function TagGrid({ items, selected, onToggle }: { items: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {items.map((item: string) => {
        const active = selected.includes(item);
        return <button key={item} onClick={() => onToggle(item)} style={{ padding: '6px 12px', borderRadius: 20, border: `2px solid ${active ? '#0d9e6e' : '#e2e8f0'}`, background: active ? '#0d9e6e' : '#fff', color: active ? '#fff' : '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>{item}</button>;
      })}
    </div>
  );
}

/** POI Card — includes Quick Add to Trip Bucket button */
function POICard({ poi, onDelete }: { poi: POI; onDelete?: (id: string) => void }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const navigate = useNavigate();
  const { addPoi, removePoi, hasPoi } = useTripBucket();
  const { user, isGuest } = useAuth();
  const diff = DIFF_COLORS[poi.difficulty] || DIFF_COLORS['קל'];
  const inBucket = hasPoi(poi.id);

  const bucketLock = useGuestLock('הוספה לסל המסלול');
  const favLock = useGuestLock('שמירת מועדפים');

  const handleBucketToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    bucketLock.guardAction(() => { inBucket ? removePoi(poi.id) : addPoi(poi); });
  };

  const handleFavToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    favLock.guardAction(() => toggleFavorite(Number(poi.id)));
  };

  return (
    <div onClick={() => navigate(`/POIDetail?id=${poi.id}`)} style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.07)', cursor: 'pointer', transition: 'transform 0.15s ease' }}>
      <div style={{ position: 'relative', height: 160 }}>
        <img src={poi.main_image || RouterLogo} alt={poi.name} loading="lazy"
          onError={e => { e.currentTarget.src = RouterLogo; e.currentTarget.onerror = null; }}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />

        {/* Favourite button */}
        <button onClick={handleFavToggle} aria-label={isFavorite(poi.id) ? 'הסר ממועדפים' : 'הוסף למועדפים'} style={{ position: 'absolute', top: 10, right: 10, background: isGuest ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isGuest
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill={isFavorite(poi.id) ? '#ef4444' : 'none'} stroke={isFavorite(poi.id) ? '#ef4444' : '#64748b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
          }
        </button>
        {favLock.PromptComponent}

        {/* Admin delete button */}
        {user?.is_admin && onDelete && (
          <button
            onClick={e => { e.stopPropagation(); if (window.confirm(`למחוק את "${poi.name}"?`)) onDelete(poi.id); }}
            title="מחק מקום"
            style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(220,38,38,0.9)', border: 'none', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
            </svg>
          </button>
        )}

<span style={{ position: 'absolute', bottom: 10, left: 10, background: '#fff', color: diff.color, borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 800, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>{poi.difficulty}</span>
      </div>

      <div style={{ padding: '14px 14px 16px', direction: 'rtl' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
            <span style={{ fontWeight: 800, color: '#f59e0b', fontSize: 14 }}>{poi.average_rating}</span>
          </div>
          <span style={{ fontSize: 16, fontWeight: 900, color: '#1a2e2a' }}>{poi.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginBottom: 10, color: '#94a3b8' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
          <span style={{ fontSize: 12 }}>{poi.region}</span>
        </div>
        <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, textAlign: 'right', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{poi.description}</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
          {poi.duration_minutes && <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8', fontSize: 11 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>{poi.duration_minutes} דק'</div>}
          {poi.has_water && <div style={{ color: '#0284c7', fontSize: 11, fontWeight: 600 }}>💧 מים</div>}
          {poi.has_shade && <div style={{ color: '#16a34a', fontSize: 11, fontWeight: 600 }}>🌿 צל</div>}
        </div>

        {/* Quick Add text button at bottom of card */}
        <button
          onClick={handleBucketToggle}
          aria-label={isGuest ? 'הוספה לסל המסלול — דרוש חשבון' : inBucket ? 'הסר מסל המסלול' : 'הוסף לסל המסלול'}
          style={{
            marginTop: 10, width: '100%', padding: '7px',
            border: `1.5px solid ${isGuest ? '#e2e8f0' : inBucket ? '#0d9e6e' : '#e2e8f0'}`,
            borderRadius: 10,
            background: isGuest ? '#f8fafc' : inBucket ? '#f0fdf8' : '#f8fafc',
            color: isGuest ? '#94a3b8' : inBucket ? '#0d9e6e' : '#64748b',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'Heebo, sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            transition: 'all 0.15s',
          }}
        >
          {isGuest
            ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> הוספה לסל — דרוש חשבון</>
            : inBucket ? <>✓ נוסף לסל המסלול</> : <>+ הוספה מהירה למסלול</>
          }
        </button>
        {bucketLock.PromptComponent}
      </div>
    </div>
  );
}

export default function Explore() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlCategory = searchParams.get('category') || '';
  const urlQuery = searchParams.get('q') || '';

  // Fetch in chunks equal to the backend's max limit
  const FETCH_CHUNK_SIZE = 500;
  // How many items to render in the DOM each time we scroll to the bottom
  const RENDER_CHUNK_SIZE = 20;

  const [allPois, setAllPois] = useState<POI[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState(urlQuery);
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for controlling how many items are currently rendered
  const [visibleCount, setVisibleCount] = useState(RENDER_CHUNK_SIZE);

  const [selRegions, setSelRegions] = useState<string[]>([]);
  const [selCats, setSelCats] = useState<string[]>(urlCategory ? [urlCategory] : []);
  const [selDiffs, setSelDiffs] = useState<string[]>([]);
  const [hasWater, setHasWater] = useState(false);
  const [hasShade, setHasShade] = useState(false);
  const [accessible, setAccessible] = useState(false);

  // 1. Fetch all data using pagination loop on mount
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        let allFetchedPois: POI[] = [];
        let offset = 0;
        let hasMore = true;

        // Loop until the backend returns fewer items than the chunk size
        while (hasMore) {
          const chunk = await api.locations.list({ limit: FETCH_CHUNK_SIZE, offset });
          allFetchedPois = [...allFetchedPois, ...chunk];

          if (chunk.length < FETCH_CHUNK_SIZE) {
            hasMore = false;
          } else {
            offset += FETCH_CHUNK_SIZE;
          }
        }

        const regionsData = await api.regions.list();

        setAllPois(allFetchedPois);
        setRegions(regionsData.map(r => r.name));
        setCategories([...new Set(allFetchedPois.map(p => p.category).filter(Boolean))].sort());
        setLoading(false);
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  useEffect(() => {
    if (urlCategory && categories.includes(urlCategory)) setSelCats([urlCategory]);
  }, [urlCategory, categories]);

  const handleDeletePoi = useCallback(async (id: string) => {
    await api.locations.delete(id);
    setAllPois(prev => prev.filter(p => p.id !== id));
  }, []);

  const activeFilterCount = selRegions.length + selCats.length + selDiffs.length + (hasWater ? 1 : 0) + (hasShade ? 1 : 0) + (accessible ? 1 : 0);

  // 2. Apply filters and search to the ENTIRE list
  const filteredPois = useMemo(() => {
    return allPois.filter(p => {
      if (search && !p.name.includes(search) && !p.region.includes(search) && !p.category.includes(search)) return false;
      if (selRegions.length && !selRegions.includes(p.region)) return false;
      if (selCats.length && !selCats.includes(p.category)) return false;
      if (selDiffs.length && !selDiffs.includes(p.difficulty)) return false;
      if (hasWater && !p.has_water) return false;
      if (hasShade && !p.has_shade) return false;
      if (accessible && !p.accessible) return false;
      return true;
    });
  }, [allPois, search, selRegions, selCats, selDiffs, hasWater, hasShade, accessible]);

  // 3. Reset the visible count whenever filters or search query change
  useEffect(() => {
    setVisibleCount(RENDER_CHUNK_SIZE);
  }, [filteredPois]);

  // 4. Set up the Intersection Observer for Infinite Scrolling
  const observer = useRef<IntersectionObserver | null>(null);
  const lastPoiElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading) return;

    // Disconnect the previous observer if it exists
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      // If the last element is visible and we have more items to show
      if (entries[0].isIntersecting && visibleCount < filteredPois.length) {
        setVisibleCount(prev => prev + RENDER_CHUNK_SIZE);
      }
    });

    // Observe the new last element
    if (node) observer.current.observe(node);
  }, [loading, visibleCount, filteredPois.length]);

  // 5. Slice the array to get only the items we want to render in the DOM
  const displayedPois = filteredPois.slice(0, visibleCount);

  return (
    <div style={{ background: '#f0f4f3', minHeight: '100vh', paddingBottom: 40, direction: 'rtl' }}>
      {/* Active category banner */}
      {urlCategory && (
        <div style={{ background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', direction: 'rtl' }}>
          <button onClick={() => { setSelCats([]); window.history.replaceState({}, '', '/Explore'); }} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '4px 10px', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>נקה</button>
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>קטגוריה: {urlCategory}</span>
        </div>
      )}

      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', padding: '14px 16px 10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Filter Button */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setFilterOpen(true)} style={{ width: 44, height: 44, borderRadius: 14, border: '2px solid #e2e8f0', background: activeFilterCount > 0 ? '#0d9e6e' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={activeFilterCount > 0 ? '#fff' : '#64748b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>
            </button>
            {activeFilterCount > 0 && <div style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{activeFilterCount}</div>}
          </div>

          {/* Search Input (Fixed for RTL) */}
          <div style={{ flex: 1, background: '#f8fafc', borderRadius: 14, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, border: '2px solid #e2e8f0' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש אתרים..." style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 15, fontFamily: 'Heebo, sans-serif', textAlign: 'right', color: '#1a2e2a' }} />
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          </div>

          {/* Add POI Button */}
          <button
            onClick={() => navigate('/ContributePOI')}
            style={{
              width: 44, height: 44, borderRadius: 14, border: 'none',
              background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)',
              color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 10px rgba(13,158,110,0.2)'
            }}
            title="הוסף אתר חדש"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>

        {selCats.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {selCats.map(c => (
              <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f0fdf8', color: '#0d9e6e', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700, border: '1.5px solid #0d9e6e' }}>
                {c}
                <button onClick={() => setSelCats(prev => prev.filter(x => x !== c))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0d9e6e', padding: 0, display: 'flex', alignItems: 'center' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '14px 20px 8px', textAlign: 'right' }}>
        {loading ? <span style={{ fontSize: 14, color: '#94a3b8', fontWeight: 600 }}>טוען אתרים...</span>
          : error ? <span style={{ fontSize: 14, color: '#dc2626', fontWeight: 600 }}>שגיאה: {error}</span>
            : <span style={{ fontSize: 14, color: '#94a3b8', fontWeight: 600 }}>{filteredPois.length} אתרים הוצגו מתוך {allPois.length}</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, padding: '0 16px 24px' }}>
        {displayedPois.map((poi: POI, index: number) => {
          // Check if this is the last rendered element
          const isLast = index === displayedPois.length - 1;
          return (
            <div key={poi.id} ref={isLast ? lastPoiElementRef : null}>
              <POICard poi={poi} onDelete={handleDeletePoi} />
            </div>
          );
        })}
        {!loading && filteredPois.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8', gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <div style={{ fontWeight: 700 }}>לא נמצאו אתרים תואמים לחיפוש שלך</div>
          </div>
        )}
      </div>

      {/* Loading indicator at the bottom when more items are being rendered */}
      {!loading && visibleCount < filteredPois.length && (
        <div style={{ textAlign: 'center', padding: '10px 20px 30px', color: '#0d9e6e', fontWeight: 600 }}>
          טוען עוד אתרים...
        </div>
      )}

      <FilterPanel open={filterOpen} onClose={() => setFilterOpen(false)}
        selectedRegions={selRegions} setSelectedRegions={setSelRegions}
        selectedCategories={selCats} setSelectedCategories={setSelCats}
        selectedDifficulties={selDiffs} setSelectedDifficulties={setSelDiffs}
        hasWater={hasWater} setHasWater={setHasWater}
        hasShade={hasShade} setHasShade={setHasShade}
        accessible={accessible} setAccessible={setAccessible}
        dynamicRegions={regions} dynamicCategories={categories}
      />

      {/* Trip Bucket UI */}
      <TripBucketFab />
      <TripBucketSheet />
    </div>
  );
}

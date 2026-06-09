/**
 * AdminPlaces.tsx — UPDATED
 *
 * Changes vs previous version:
 *  1. Fetches ALL places via paginated loop — bypasses the 500/req server cap
 *  2. is_recommended → is_featured throughout
 *  3. Clicking a place opens POIDetailsEditAdmin inline dialog (no navigation)
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BASE_URL, type POI, type Region } from '../api';
import { useAuth } from '../context/AuthContext';
import RouterLogo from '../assets/logo.jpeg';
import POIDetailsEditAdmin from './POIDetailsEditAdmin';

// ── helpers ──────────────────────────────────────────────────────────────────

const TOKEN_KEY = 'router_auth_token';
const getToken = () => localStorage.getItem(TOKEN_KEY);

async function adminFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken() ?? ''}`,
            ...(options?.headers ?? {}),
        },
    });
    if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message || j?.error || `HTTP ${res.status}`);
    }
    return res.json();
}

async function fetchRegions(): Promise<Region[]> {
    const res = await adminFetch<{ data: Region[] }>('/regions');
    return res.data ?? [];
}

/**
 * Fetch ALL locations by paginating until the server returns fewer than PAGE items.
 * The backend caps at 500/req, so we loop with offset until exhausted.
 */
function parseImages(images: unknown): string[] {
  return typeof images === 'string' ? JSON.parse(images) : [];
}

async function fetchAllLocations(): Promise<POI[]> {
    const PAGE = 500;
    let offset = 0;
    const all: POI[] = [];

    while (true) {
        const res = await adminFetch<{ data: unknown[] }>(`/locations?limit=${PAGE}&offset=${offset}`);
        const page: unknown[] = Array.isArray(res) ? res : (res.data ?? []);
        if (!page || page.length === 0) break;

        const mapped = page.map((r: unknown): POI => {
            const row = r as Record<string, unknown>;
            return {
              id: String(row.id),
              name: row.name as string,
              description: (row.description as string) || '',
              category: row.category as string,
              region: (row.region_name as string) || (row.region as string) || '',
              region_id: row.region_id as number,
              latitude: Number.parseFloat(row.latitude as string),
              longitude: Number.parseFloat(row.longitude as string),
              images: Array.isArray(row.images) ? row.images : parseImages(row.images),
              main_image: (row.main_image as string) || '',
              difficulty: (row.difficulty as string) || 'בינוני',
              duration_minutes: row.duration_minutes as number,
              has_water: row.has_water as boolean,
              has_shade: row.has_shade as boolean,
              accessible: row.accessible as boolean,
              average_rating: Number.parseFloat(row.average_rating as string) || 4,
              photo_credit: (row.photo_credit as string) || undefined,
              uploaded_by: (row.uploaded_by as string) || undefined,
              // Preserve all extra DB fields (is_featured, source, source_id, created_at, etc.)
              ...row,
            };
        });

        all.push(...mapped);
        if (page.length < PAGE) break;
        offset += PAGE;
    }

    return all;
}

// ── constants ────────────────────────────────────────────────────────────────

const DIFF_COLOR: Record<string, string> = {
    'קל - משפחות': '#16a34a', 'קל': '#16a34a',
    'בינוני': '#d97706', 'מאתגר': '#dc2626', 'קשה': '#dc2626', 'אקסטרים': '#7c3aed',
};

// ── Place Card ────────────────────────────────────────────────────────────────

function PlaceCard({ poi, onEdit }: { poi: POI; onEdit: (poi: POI) => void }) {
    const diff = DIFF_COLOR[poi.difficulty] || '#64748b';
    return (
        <button type="button" onClick={() => onEdit(poi)} style={{
            background: '#fff', borderRadius: 20, overflow: 'hidden',
            boxShadow: '0 2px 16px rgba(0,0,0,0.07)', cursor: 'pointer',
            transition: 'transform 0.15s, box-shadow 0.15s',
            border: `1px solid ${poi.is_featured ? '#bbf7d0' : 'transparent'}`,
            padding: 0, width: '100%', textAlign: 'right', fontFamily: 'Heebo, sans-serif',
        }}
            onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.12)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 16px rgba(0,0,0,0.07)';
            }}>
            <div style={{ position: 'relative', height: 160 }}>
                <img src={poi.main_image || RouterLogo} alt={poi.name} loading="lazy"
                    onError={e => { (e.target as HTMLImageElement).src = RouterLogo; (e.target as HTMLImageElement).onerror = null; }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 50%)' }} />

                <span style={{ position: 'absolute', bottom: 10, right: 10, background: '#fff', color: diff, borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 800, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
                    {poi.difficulty}
                </span>

                {poi.is_featured && (
                    <span style={{ position: 'absolute', top: 10, left: 10, background: '#0d9e6e', color: '#fff', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 800 }}>
                        🌟 מומלץ
                    </span>
                )}

                {/* Edit icon */}
                <div style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0d9e6e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                </div>

                {poi.photo_credit && (
                    <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(255,255,255,0.9)', borderRadius: 5, padding: '2px 6px', fontSize: 9, fontWeight: 600, color: '#374151' }}>
                        צילום: {poi.photo_credit}
                    </div>
                )}
            </div>

            <div style={{ padding: '12px 14px 14px', direction: 'rtl' }}>
                <div style={{ fontWeight: 900, fontSize: 15, color: '#1a2e2a', marginBottom: 4 }}>{poi.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: '#64748b', background: '#f1f5f9', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>{poi.category}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>·</span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>{poi.region}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>·</span>
                    <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>★ {poi.average_rating?.toFixed(1) || '4.0'}</span>
                </div>
                {poi.description && (
                    <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 6, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {poi.description}
                    </p>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {poi.has_water && <span style={{ fontSize: 10, color: '#0369a1', background: '#e0f2fe', borderRadius: 5, padding: '1px 6px' }}>💧 מים</span>}
                    {poi.has_shade && <span style={{ fontSize: 10, color: '#15803d', background: '#dcfce7', borderRadius: 5, padding: '1px 6px' }}>🌳 צל</span>}
                    {poi.accessible && <span style={{ fontSize: 10, color: '#7c3aed', background: '#f3e8ff', borderRadius: 5, padding: '1px 6px' }}>♿ נגיש</span>}
                    {poi.images?.length > 0 && <span style={{ fontSize: 10, color: '#64748b', background: '#f1f5f9', borderRadius: 5, padding: '1px 6px' }}>🖼 {poi.images.length}</span>}
                </div>
            </div>
        </button>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminPlaces() {
    const navigate = useNavigate();
    const { user, isLoading } = useAuth();

    const [pois, setPois] = useState<POI[]>([]);
    const [regions, setRegions] = useState<Region[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterRegion, setFilterRegion] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterFeatured, setFilterFeatured] = useState(false);
    const [editing, setEditing] = useState<POI | null>(null);
    const [successToast, setSuccessToast] = useState('');

    // Auth guard
    useEffect(() => {
        if (!isLoading && (!user || !(user as Record<string, unknown>).is_admin)) navigate('/');
    }, [user, isLoading, navigate]);

    // Load all places + regions
    useEffect(() => {
        if (!user || !(user as Record<string, unknown>).is_admin) return;
        Promise.all([fetchAllLocations(), fetchRegions()])
            .then(([locs, regs]) => { setPois(locs); setRegions(regs); })
            .catch(err => console.error('AdminPlaces load error:', err))
            .finally(() => setLoading(false));
    }, [user]);

    const showToast = (msg: string) => {
        setSuccessToast(msg);
        setTimeout(() => setSuccessToast(''), 2800);
    };

    const handleSaved = (updated: POI) => {
        setPois(prev => prev.map(p => p.id === updated.id ? updated : p));
        setEditing(null);
        showToast(`✓ "${updated.name}" עודכן בהצלחה`);
    };

    const handleDeleted = (id: string) => {
        const name = pois.find(p => p.id === id)?.name ?? '';
        setPois(prev => prev.filter(p => p.id !== id));
        setEditing(null);
        showToast(`🗑 "${name}" נמחק`);
    };

    const uniqueCategories = [...new Set(pois.map(p => p.category))].sort((a, b) => a.localeCompare(b));
    const uniqueRegions = [...new Set(pois.map(p => p.region).filter(Boolean))].sort((a, b) => a.localeCompare(b));

    const filtered = pois.filter(p => {
        if (filterFeatured && !p.is_featured) return false;
        if (filterRegion && p.region !== filterRegion) return false;
        if (filterCategory && p.category !== filterCategory) return false;
        if (search) {
            const q = search.toLowerCase();
            return p.name.toLowerCase().includes(q)
                || p.description?.toLowerCase().includes(q)
                || p.category.toLowerCase().includes(q);
        }
        return true;
    });

    if (isLoading || loading) {
        return (
            <div style={{ background: '#f8fafc', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'rtl' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>🗺️</div>
                    <div style={{ color: '#94a3b8', fontSize: 14 }}>טוען את כל המקומות...</div>
                    <div style={{ marginTop: 16, width: 200, height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden', margin: '16px auto 0' }}>
                        <div style={{ height: '100%', background: '#0d9e6e', borderRadius: 2, animation: 'loadbar 1.4s ease infinite' }} />
                    </div>
                </div>
                <style>{`@keyframes loadbar { 0%{width:0%;margin-right:100%} 50%{width:60%;margin-right:0%} 100%{width:0%;margin-right:100%} }`}</style>
            </div>
        );
    }

    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', direction: 'rtl' }}>

            {/* Header */}
            <div style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 100%)', width: '100%' }}>
                <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 44px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <button onClick={() => navigate('/admin')} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 12, padding: '8px 14px', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'Heebo, sans-serif' }}>
                            ← פאנל ניהול
                        </button>
                        <div style={{ textAlign: 'right' }}>
                            <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 900, marginBottom: 4 }}>🗺️ ניהול מקומות</h1>
                            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                                {pois.length} מקומות בסה"כ · {filtered.length} מוצגים
                            </p>
                        </div>
                    </div>

                    {/* Stats */}
                    <div style={{ display: 'flex', gap: 10 }}>
                        {[
                            { label: 'סה"כ מקומות', val: pois.length, icon: '📍' },
                            { label: 'מומלצים', val: pois.filter(p => p.is_featured).length, icon: '🌟' },
                            { label: 'אזורים', val: uniqueRegions.length, icon: '🗾' },
                            { label: 'קטגוריות', val: uniqueCategories.length, icon: '🏷️' },
                        ].map(s => (
                            <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px', textAlign: 'center' }}>
                                <div style={{ fontSize: 20 }}>{s.icon}</div>
                                <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginTop: 2 }}>{s.val}</div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px', marginTop: -20, paddingBottom: 60 }}>

                {/* Search + Filters */}
                <div style={{ background: '#fff', borderRadius: 20, padding: '16px 18px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ position: 'relative' }}>
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="חיפוש לפי שם, תיאור, קטגוריה..."
                            style={{ width: '100%', border: '2px solid #e2e8f0', borderRadius: 12, padding: '12px 44px 12px 16px', fontSize: 14, fontFamily: 'Heebo, sans-serif', textAlign: 'right', outline: 'none', boxSizing: 'border-box' }}
                            onFocus={e => e.target.style.borderColor = '#0d9e6e'}
                            onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                        <div style={{ position: 'absolute', top: '50%', right: 14, transform: 'translateY(-50%)' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)}
                            style={{ border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontFamily: 'Heebo, sans-serif', background: '#fff', color: filterRegion ? '#0d9e6e' : '#64748b', outline: 'none', fontWeight: filterRegion ? 700 : 400 }}>
                            <option value="">כל האזורים</option>
                            {uniqueRegions.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>

                        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                            style={{ border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontFamily: 'Heebo, sans-serif', background: '#fff', color: filterCategory ? '#0d9e6e' : '#64748b', outline: 'none', fontWeight: filterCategory ? 700 : 400 }}>
                            <option value="">כל הקטגוריות</option>
                            {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>

                        <button onClick={() => setFilterFeatured(!filterFeatured)} style={{
                            padding: '8px 14px', border: '1.5px solid', borderColor: filterFeatured ? '#0d9e6e' : '#e2e8f0',
                            borderRadius: 10, background: filterFeatured ? '#f0fdf8' : '#fff',
                            color: filterFeatured ? '#0d9e6e' : '#64748b', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                        }}>🌟 מומלצים בלבד</button>

                        {(search || filterRegion || filterCategory || filterFeatured) && (
                            <button onClick={() => { setSearch(''); setFilterRegion(''); setFilterCategory(''); setFilterFeatured(false); }}
                                style={{ padding: '8px 12px', border: 'none', background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
                                ✕ נקה סינון
                            </button>
                        )}

                        <span style={{ marginRight: 'auto', fontSize: 12, color: '#94a3b8' }}>
                            מציג {filtered.length} מתוך {pois.length}
                        </span>
                    </div>
                </div>

                {/* Grid */}
                {filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
                        <div style={{ fontSize: 14 }}>לא נמצאו מקומות</div>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
                        {filtered.map(poi => (
                            <PlaceCard key={poi.id} poi={poi} onEdit={setEditing} />
                        ))}
                    </div>
                )}
            </div>

            {/* POIDetailsEditAdmin — inline dialog, opens when a card is clicked */}
            {editing && (
                <POIDetailsEditAdmin
                    poi={editing}
                    regions={regions}
                    onClose={() => setEditing(null)}
                    onSaved={handleSaved}
                    onDeleted={handleDeleted}
                />
            )}

            {/* Success Toast */}
            {successToast && (
                <div style={{
                    position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                    background: '#0f172a', color: '#fff', borderRadius: 14,
                    padding: '12px 20px', fontSize: 14, fontWeight: 700,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.25)', zIndex: 3000,
                    fontFamily: 'Heebo, sans-serif', whiteSpace: 'nowrap',
                    animation: 'slideUp 0.25s ease',
                }}>
                    {successToast}
                </div>
            )}

            <style>{`
                @keyframes slideUp {
                    from { transform: translateX(-50%) translateY(20px); opacity: 0; }
                    to   { transform: translateX(-50%) translateY(0);   opacity: 1; }
                }
            `}</style>
        </div>
    );
}
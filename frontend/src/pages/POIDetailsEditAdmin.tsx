/**
 * POIDetailsEditAdmin.tsx
 * Full admin editor for a POI/Location — dialog modal.
 * Used in:
 *   • AdminPlaces — opens inline when a place card is clicked
 *   • POIDetail — opens when the admin edit button (🛡️) is clicked
 *
 * Editable fields (all DB columns):
 *   name, description, category, difficulty, duration_minutes,
 *   has_water, has_shade, accessible, is_featured, photo_credit,
 *   main_image, images (gallery), region_id, average_rating,
 *   latitude, longitude, source, source_id, uploaded_by
 *
 * Read-only display: id, created_at, updated_at
 */

import { useState, useRef } from 'react';
import { BASE_URL, api, type POI, type Region } from '../api';
import { CATEGORIES } from '../utils/constants';
import RouterLogo from '../assets/logo.jpeg';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

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

// ── types ────────────────────────────────────────────────────────────────────

interface EditState {
    name: string;
    description: string;
    category: string;
    difficulty: string;
    duration_minutes: string;
    has_water: boolean;
    has_shade: boolean;
    accessible: boolean;
    is_featured: boolean;
    photo_credit: string;
    main_image: string;
    images: string[];
    region_id: string;
    average_rating: string;
    latitude: string;
    longitude: string;
    source: string;
    source_id: string;
    uploaded_by: string;
}

// ── constants ─────────────────────────────────────────────────────────────────

const DIFFICULTIES = ['קל - משפחות', 'קל', 'בינוני', 'מאתגר', 'קשה', 'אקסטרים'];
const DIFF_COLOR: Record<string, string> = {
    'קל - משפחות': '#16a34a', 'קל': '#16a34a',
    'בינוני': '#d97706', 'מאתגר': '#dc2626', 'קשה': '#dc2626', 'אקסטרים': '#7c3aed',
};

// ── sub-components ────────────────────────────────────────────────────────────

function LocationPickerMap({ lat, lng, onChange }: { lat: number; lng: number; onChange: (lat: number, lng: number) => void }) {
    const MapEvents = () => {
        useMapEvents({ click(e) { onChange(e.latlng.lat, e.latlng.lng); } });
        return null;
    };
    return (
        <div style={{ height: 220, width: '100%', borderRadius: 12, overflow: 'hidden', border: '2px solid #e2e8f0' }}>
            <MapContainer center={[lat || 31.5, lng || 35.0]} zoom={11} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {!!(lat && lng) && <Marker position={[lat, lng]} />}
                <MapEvents />
            </MapContainer>
        </div>
    );
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const [hover, setHover] = useState(0);
    return (
        <div style={{ display: 'flex', gap: 4, direction: 'ltr', alignItems: 'center' }}>
            {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
                    onClick={() => onChange(n)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 22, color: n <= (hover || value) ? '#f59e0b' : '#d1d5db', transition: 'color 0.12s' }}>★</button>
            ))}
            <span style={{ marginRight: 6, fontSize: 13, color: '#64748b' }}>{Number(value).toFixed(1)}</span>
        </div>
    );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, color: '#374151', fontWeight: 600 }}>{label}</span>
            <div onClick={() => onChange(!checked)}
                style={{ width: 44, height: 24, borderRadius: 12, background: checked ? '#0d9e6e' : '#d1d5db', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 2, left: checked ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
            </div>
        </label>
    );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
    return <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5 }}>{children}</div>;
}

function InputField({ label, value, onChange, type = 'text', placeholder = '', step, readOnly }: {
    label: string; value: string; onChange?: (v: string) => void;
    type?: string; placeholder?: string; step?: string; readOnly?: boolean;
}) {
    return (
        <div>
            <FieldLabel>{label}</FieldLabel>
            <input type={type} value={value} step={step} readOnly={readOnly}
                onChange={e => !readOnly && onChange?.(e.target.value)}
                placeholder={placeholder}
                style={{
                    width: '100%', border: '2px solid #e2e8f0', borderRadius: 10,
                    padding: '10px 12px', fontSize: 14, fontFamily: 'Heebo, sans-serif',
                    textAlign: 'right', outline: 'none', boxSizing: 'border-box',
                    background: readOnly ? '#f8fafc' : '#fff',
                    color: readOnly ? '#94a3b8' : '#1a2e2a',
                    transition: 'border-color 0.15s',
                }}
                onFocus={e => { if (!readOnly) e.target.style.borderColor = '#0d9e6e'; }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; }}
            />
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

export interface POIDetailsEditAdminProps {
    poi: POI;
    regions: Region[];
    onClose: () => void;
    onSaved: (updated: POI) => void;
    onDeleted: (id: string) => void;
}

export default function POIDetailsEditAdmin({ poi, regions, onClose, onSaved, onDeleted }: POIDetailsEditAdminProps) {
    const [edit, setEdit] = useState<EditState>({
        name: poi.name,
        description: poi.description || '',
        category: poi.category,
        difficulty: poi.difficulty || 'בינוני',
        duration_minutes: String(poi.duration_minutes ?? ''),
        has_water: poi.has_water ?? false,
        has_shade: poi.has_shade ?? false,
        accessible: poi.accessible ?? false,
        is_featured: poi.is_featured ?? false,
        photo_credit: poi.photo_credit ?? '',
        main_image: poi.main_image ?? '',
        images: [...(poi.images ?? [])],
        region_id: String(poi.region_id ?? ''),
        average_rating: String(poi.average_rating ?? 4),
        latitude: String(poi.latitude ?? ''),
        longitude: String(poi.longitude ?? ''),
        source: (poi as any).source ?? '',
        source_id: (poi as any).source_id ?? '',
        uploaded_by: poi.uploaded_by ?? '',
    });

    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [newImageUrl, setNewImageUrl] = useState('');
    const [activeSection, setActiveSection] = useState('basic');
    const [mainImageUploading, setMainImageUploading] = useState(false);
    const [mainImageUploadError, setMainImageUploadError] = useState('');
    const mainImageFileRef = useRef<HTMLInputElement>(null);
    const [mapsLink, setMapsLink] = useState('');
    const [geoQuery, setGeoQuery] = useState('');
    const [geoResults, setGeoResults] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
    const [geoLoading, setGeoLoading] = useState(false);
    const [geoError, setGeoError] = useState('');

    const set = (key: keyof EditState, val: unknown) => setEdit(prev => ({ ...prev, [key]: val }));

    const handleSave = async () => {
        setSaving(true); setSaveError(''); setSaveSuccess(false);
        try {
            const payload: Record<string, unknown> = {
                name: edit.name,
                description: edit.description,
                category: edit.category,
                difficulty: edit.difficulty,
                has_water: edit.has_water,
                has_shade: edit.has_shade,
                accessible: edit.accessible,
                is_featured: edit.is_featured,
                photo_credit: edit.photo_credit || null,
                main_image: edit.main_image || null,
                images: edit.images,
                average_rating: parseFloat(edit.average_rating) || 4.0,
                latitude: parseFloat(edit.latitude),
                longitude: parseFloat(edit.longitude),
                source: edit.source || undefined,
                source_id: edit.source_id || undefined,
                uploaded_by: edit.uploaded_by || null,
            };
            if (edit.duration_minutes) payload.duration_minutes = parseInt(edit.duration_minutes);
            if (edit.region_id) payload.region_id = parseInt(edit.region_id);

            const res = await adminFetch<{ data: any }>(`/locations/${poi.id}`, {
                method: 'PATCH',
                body: JSON.stringify(payload),
            });

            const updated: POI = {
                ...poi,
                name: edit.name,
                description: edit.description,
                category: edit.category,
                difficulty: edit.difficulty,
                duration_minutes: edit.duration_minutes ? parseInt(edit.duration_minutes) : undefined,
                has_water: edit.has_water,
                has_shade: edit.has_shade,
                accessible: edit.accessible,
                photo_credit: edit.photo_credit || undefined,
                main_image: edit.main_image,
                images: edit.images,
                latitude: parseFloat(edit.latitude),
                longitude: parseFloat(edit.longitude),
                average_rating: parseFloat(edit.average_rating) || 4.0,
                region_id: edit.region_id ? parseInt(edit.region_id) : poi.region_id,
                region: regions.find(r => String(r.id) === edit.region_id)?.name || poi.region,
                uploaded_by: edit.uploaded_by || undefined,
                ...(res as any)?.data,
                is_featured: edit.is_featured,
                source: edit.source,
                source_id: edit.source_id,
            } as any;

            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
            onSaved(updated);
        } catch (e: any) {
            setSaveError(e.message || 'שגיאה בשמירה');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete) { setConfirmDelete(true); return; }
        setDeleting(true);
        try {
            await adminFetch(`/locations/${poi.id}`, { method: 'DELETE' });
            onDeleted(poi.id);
        } catch (e: any) {
            setSaveError(e.message || 'שגיאה במחיקה');
            setDeleting(false);
            setConfirmDelete(false);
        }
    };

    const handleMainImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setMainImageUploadError('יש לבחור קובץ תמונה (JPEG, PNG, WEBP)');
            return;
        }
        if (file.size > 8 * 1024 * 1024) {
            setMainImageUploadError('התמונה גדולה מדי — מקסימום 8MB');
            return;
        }
        setMainImageUploading(true);
        setMainImageUploadError('');
        try {
            const result = await api.locations.uploadMedia(Number(poi.id), file);
            set('main_image', result.media.media_url);
        } catch (err: any) {
            setMainImageUploadError(err?.message || 'שגיאה בהעלאת התמונה');
        } finally {
            setMainImageUploading(false);
            if (mainImageFileRef.current) mainImageFileRef.current.value = '';
        }
    };

    const addImage = () => {
        const url = newImageUrl.trim();
        if (!url || edit.images.includes(url)) return;
        set('images', [...edit.images, url]);
        setNewImageUrl('');
    };

    const removeImage = (url: string) => {
        set('images', edit.images.filter(i => i !== url));
        if (edit.main_image === url) set('main_image', edit.images.find(i => i !== url) ?? '');
    };

    const handleMapsLinkChange = (val: string) => {
        setMapsLink(val);
        const match = val.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (match) { set('latitude', match[1]); set('longitude', match[2]); }
    };

    const handleGeoSearch = async () => {
        const q = geoQuery.trim();
        if (!q) return;
        setGeoLoading(true); setGeoError(''); setGeoResults([]);
        try {
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&accept-language=he,en`;
            const res = await fetch(url, { headers: { 'Accept-Language': 'he,en' } });
            const data = await res.json();
            if (!data.length) setGeoError('לא נמצאו תוצאות');
            setGeoResults(data);
        } catch {
            setGeoError('שגיאה בחיפוש');
        } finally {
            setGeoLoading(false);
        }
    };

    const SECTIONS = [
        { id: 'basic', label: '📋 פרטים' },
        { id: 'location', label: '🗺️ מיקום' },
        { id: 'flags', label: '🏷️ תכונות' },
        { id: 'images', label: '🖼️ תמונות' },
        { id: 'meta', label: '⚙️ מטא' },
        { id: 'danger', label: '🗑️ מחיקה' },
    ];

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Backdrop */}
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)' }} />

            {/* Modal */}
            <div style={{
                position: 'relative', width: '100%', maxWidth: 620,
                maxHeight: '94dvh', margin: '0 16px',
                background: '#f8fafc', borderRadius: 24,
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
                direction: 'rtl', overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{ padding: '18px 20px 12px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 14, overflow: 'hidden', flexShrink: 0, border: '2px solid #e2e8f0' }}>
                        <img src={edit.main_image || RouterLogo} alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={e => { (e.target as HTMLImageElement).src = RouterLogo; }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 900, fontSize: 16, color: '#1a2e2a', lineHeight: 1.2 }}>{poi.name}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
                            {poi.category} · {poi.region} · ID {poi.id}
                        </div>
                    </div>
                    {saveSuccess && (
                        <div style={{ background: '#d1fae5', color: '#065f46', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 800 }}>✓ נשמר</div>
                    )}
                    <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 4, padding: '8px 12px', background: '#fff', borderBottom: '1px solid #f1f5f9', overflowX: 'auto', flexShrink: 0 }}>
                    {SECTIONS.map(s => (
                        <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
                            padding: '7px 12px', border: 'none', borderRadius: 10, flexShrink: 0,
                            background: activeSection === s.id ? (s.id === 'danger' ? '#dc2626' : '#0d9e6e') : 'transparent',
                            color: activeSection === s.id ? '#fff' : (s.id === 'danger' ? '#dc2626' : '#64748b'),
                            fontWeight: 700, fontSize: 12, cursor: 'pointer',
                            fontFamily: 'Heebo, sans-serif', whiteSpace: 'nowrap',
                            transition: 'all 0.15s',
                        }}>{s.label}</button>
                    ))}
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>

                    {/* BASIC */}
                    {activeSection === 'basic' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <InputField label="שם" value={edit.name} onChange={v => set('name', v)} />
                            <div>
                                <FieldLabel>תיאור</FieldLabel>
                                <textarea value={edit.description} onChange={e => set('description', e.target.value)} rows={4}
                                    style={{ width: '100%', border: '2px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', fontSize: 14, fontFamily: 'Heebo, sans-serif', textAlign: 'right', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6 }}
                                    onFocus={e => e.target.style.borderColor = '#0d9e6e'}
                                    onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                            </div>
                            {/* Category selector — preset tiles + custom fallback */}
                            <div>
                                <FieldLabel>קטגוריה</FieldLabel>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
                                    {CATEGORIES.map(cat => (
                                        <button key={cat.id} onClick={() => set('category', cat.id)} style={{
                                            padding: '10px 6px', border: `2px solid ${edit.category === cat.id ? '#0d9e6e' : '#e2e8f0'}`,
                                            borderRadius: 14, background: edit.category === cat.id ? '#f0fdf8' : '#fff',
                                            cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                                            transition: 'all 0.15s',
                                        }}>
                                            <span style={{ fontSize: 20 }}>{cat.icon}</span>
                                            <span style={{ fontSize: 10, fontWeight: 700, color: edit.category === cat.id ? '#0d9e6e' : '#64748b' }}>{cat.label}</span>
                                        </button>
                                    ))}
                                </div>
                                {/* Custom / free-text — pre-filled if current category not in preset list */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <input
                                        value={CATEGORIES.some(c => c.id === edit.category) ? '' : edit.category}
                                        onChange={e => set('category', e.target.value)}
                                        placeholder={CATEGORIES.some(c => c.id === edit.category) ? `נבחר: ${edit.category}` : 'קטגוריה מותאמת אישית...'}
                                        style={{ flex: 1, border: '2px solid #e2e8f0', borderRadius: 10, padding: '9px 12px', fontSize: 13, fontFamily: 'Heebo, sans-serif', textAlign: 'right', outline: 'none', boxSizing: 'border-box' }}
                                        onFocus={e => e.target.style.borderColor = '#0d9e6e'}
                                        onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                    />
                                    <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>מותאם</span>
                                </div>
                                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                                    קטגוריה נוכחית: <strong style={{ color: '#0d9e6e' }}>{edit.category}</strong>
                                </div>
                            </div>
                            <div>
                                <FieldLabel>רמת קושי</FieldLabel>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {DIFFICULTIES.map(d => (
                                        <button key={d} onClick={() => set('difficulty', d)} style={{
                                            padding: '7px 14px', borderRadius: 20, border: '2px solid',
                                            borderColor: edit.difficulty === d ? (DIFF_COLOR[d] || '#0d9e6e') : '#e2e8f0',
                                            background: edit.difficulty === d ? (DIFF_COLOR[d] || '#0d9e6e') + '18' : '#fff',
                                            color: edit.difficulty === d ? (DIFF_COLOR[d] || '#0d9e6e') : '#64748b',
                                            fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                                        }}>{d}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <FieldLabel>אזור (Region)</FieldLabel>
                                <select value={edit.region_id} onChange={e => set('region_id', e.target.value)}
                                    style={{ width: '100%', border: '2px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', fontSize: 14, fontFamily: 'Heebo, sans-serif', textAlign: 'right', outline: 'none', background: '#fff', boxSizing: 'border-box', appearance: 'none' }}
                                    onFocus={e => e.target.style.borderColor = '#0d9e6e'}
                                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}>
                                    <option value="">-- בחר אזור --</option>
                                    {regions.map(r => <option key={r.id} value={String(r.id)}>{r.name} ({r.name_en})</option>)}
                                </select>
                            </div>
                            <InputField label="משך ביקור (דקות)" value={edit.duration_minutes} onChange={v => set('duration_minutes', v)} type="number" placeholder="90" />
                            <div>
                                <FieldLabel>דירוג ממוצע</FieldLabel>
                                <StarRating value={parseFloat(edit.average_rating) || 0} onChange={v => set('average_rating', String(v))} />
                                <input type="range" min="0" max="5" step="0.1" value={edit.average_rating}
                                    onChange={e => set('average_rating', e.target.value)}
                                    style={{ width: '100%', marginTop: 8, accentColor: '#0d9e6e' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8' }}>
                                    <span>0</span><span>2.5</span><span>5</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* LOCATION */}
                    {activeSection === 'location' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                            {/* ── Geocode search by name ── */}
                            <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 12, padding: 12 }}>
                                <FieldLabel>חיפוש לפי שם מקום</FieldLabel>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input
                                        type="text"
                                        value={geoQuery}
                                        onChange={e => setGeoQuery(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleGeoSearch()}
                                        placeholder="לדוגמה: נחל עמוד, כנרת, תל אביב..."
                                        style={{ flex: 1, border: '2px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontFamily: 'Heebo, sans-serif', textAlign: 'right', outline: 'none', boxSizing: 'border-box', background: '#fff' }}
                                        onFocus={e => e.target.style.borderColor = '#3b82f6'}
                                        onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                    />
                                    <button onClick={handleGeoSearch} disabled={geoLoading} style={{ padding: '10px 16px', background: geoLoading ? '#94a3b8' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, cursor: geoLoading ? 'not-allowed' : 'pointer', fontFamily: 'Heebo, sans-serif', fontSize: 13, flexShrink: 0 }}>
                                        {geoLoading ? '⏳' : '🔍 חפש'}
                                    </button>
                                </div>
                                {geoError && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 6 }}>{geoError}</div>}
                                {geoResults.length > 0 && (
                                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        {geoResults.map((r, i) => (
                                            <button key={i} onClick={() => {
                                                set('latitude', parseFloat(r.lat).toFixed(6));
                                                set('longitude', parseFloat(r.lon).toFixed(6));
                                                setGeoResults([]);
                                                setGeoQuery('');
                                            }} style={{
                                                textAlign: 'right', padding: '9px 12px',
                                                background: '#fff', border: '1.5px solid #bfdbfe',
                                                borderRadius: 10, cursor: 'pointer',
                                                fontSize: 12, color: '#1e3a5f',
                                                fontFamily: 'Heebo, sans-serif', lineHeight: 1.4,
                                                transition: 'background 0.12s',
                                            }}
                                                onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
                                                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                                            >
                                                <span style={{ fontWeight: 700, color: '#1d4ed8' }}>📍 </span>
                                                {r.display_name.length > 80 ? r.display_name.slice(0, 80) + '…' : r.display_name}
                                                <span style={{ display: 'block', fontSize: 10, color: '#64748b', marginTop: 2 }}>
                                                    {parseFloat(r.lat).toFixed(5)}, {parseFloat(r.lon).toFixed(5)}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 6, fontWeight: 600 }}>
                                    לחץ על תוצאה כדי למלא את הקואורדינטות אוטומטית
                                </div>
                            </div>

                            <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 12, padding: 12 }}>
                                <FieldLabel>חלץ מיקום מגוגל מפות</FieldLabel>
                                <input type="text" value={mapsLink} onChange={e => handleMapsLinkChange(e.target.value)}
                                    placeholder="הדבק קישור גוגל מפות..."
                                    style={{ width: '100%', border: '2px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontFamily: 'Heebo, sans-serif', textAlign: 'left', outline: 'none', boxSizing: 'border-box', direction: 'ltr', background: '#fff' }}
                                    onFocus={e => e.target.style.borderColor = '#0d9e6e'}
                                    onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                                <div style={{ fontSize: 11, color: '#16a34a', marginTop: 6, fontWeight: 600 }}>הקואורדינטות יתמלאו אוטומטית מהקישור</div>
                            </div>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <div style={{ flex: 1 }}><InputField label="קו רוחב (Latitude)" type="number" step="any" value={edit.latitude} onChange={v => set('latitude', v)} /></div>
                                <div style={{ flex: 1 }}><InputField label="קו אורך (Longitude)" type="number" step="any" value={edit.longitude} onChange={v => set('longitude', v)} /></div>
                            </div>
                            <div>
                                <FieldLabel>בחר מיקום על המפה (לחץ לעדכון)</FieldLabel>
                                <LocationPickerMap
                                    lat={parseFloat(edit.latitude) || 31.5}
                                    lng={parseFloat(edit.longitude) || 35.0}
                                    onChange={(lat, lng) => { set('latitude', lat.toFixed(6)); set('longitude', lng.toFixed(6)); }}
                                />
                            </div>
                        </div>
                    )}

                    {/* FLAGS */}
                    {activeSection === 'flags' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={{ background: '#fff', borderRadius: 16, padding: '16px 18px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <Toggle label="🌟 מומלץ (is_featured)" checked={edit.is_featured} onChange={v => set('is_featured', v)} />
                                <div style={{ height: 1, background: '#f1f5f9' }} />
                                <Toggle label="💧 יש מים" checked={edit.has_water} onChange={v => set('has_water', v)} />
                                <div style={{ height: 1, background: '#f1f5f9' }} />
                                <Toggle label="🌳 יש צל" checked={edit.has_shade} onChange={v => set('has_shade', v)} />
                                <div style={{ height: 1, background: '#f1f5f9' }} />
                                <Toggle label="♿ נגיש לעגלות" checked={edit.accessible} onChange={v => set('accessible', v)} />
                            </div>
                        </div>
                    )}

                    {/* IMAGES */}
                    {activeSection === 'images' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div>
                                <FieldLabel>תמונה ראשית</FieldLabel>
                                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                    <div style={{ width: 72, height: 72, borderRadius: 12, overflow: 'hidden', border: '2px solid #0d9e6e', flexShrink: 0 }}>
                                        <img src={edit.main_image || RouterLogo} alt=""
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            onError={e => { (e.target as HTMLImageElement).src = RouterLogo; }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        {/* URL input */}
                                        <input value={edit.main_image} onChange={e => set('main_image', e.target.value)}
                                            placeholder="https://... (URL תמונה)"
                                            style={{ width: '100%', border: '2px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontFamily: 'Heebo, sans-serif', outline: 'none', boxSizing: 'border-box' }}
                                            onFocus={e => e.target.style.borderColor = '#0d9e6e'}
                                            onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                                        {/* File upload button */}
                                        <input
                                            type="file"
                                            ref={mainImageFileRef}
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            onChange={handleMainImageFileUpload}
                                        />
                                        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                                            <button
                                                onClick={() => mainImageFileRef.current?.click()}
                                                disabled={mainImageUploading}
                                                style={{ padding: '6px 12px', border: '1.5px solid #0d9e6e', borderRadius: 8, background: '#f0fdf8', color: '#0d9e6e', fontSize: 12, fontWeight: 700, cursor: mainImageUploading ? 'wait' : 'pointer', fontFamily: 'Heebo, sans-serif', display: 'flex', alignItems: 'center', gap: 5 }}
                                            >
                                                {mainImageUploading ? '⏳ מעלה...' : '📁 העלה קובץ'}
                                            </button>
                                            {edit.main_image && (
                                                <button onClick={() => set('main_image', '')}
                                                    style={{ padding: '6px 10px', border: '1px solid #fecaca', borderRadius: 8, background: 'transparent', color: '#ef4444', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
                                                    🗑 מחק
                                                </button>
                                            )}
                                        </div>
                                        {mainImageUploadError && (
                                            <div style={{ marginTop: 4, fontSize: 12, color: '#ef4444', fontWeight: 600 }}>⚠️ {mainImageUploadError}</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <InputField label="קרדיט לצלם (photo_credit)" value={edit.photo_credit} onChange={v => set('photo_credit', v)} placeholder="שם הצלם..." />
                            <div>
                                <FieldLabel>גלריית תמונות ({edit.images.length})</FieldLabel>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {edit.images.length === 0 && (
                                        <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>אין תמונות בגלריה</div>
                                    )}
                                    {edit.images.map(url => (
                                        <div key={url} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 12, padding: '8px 12px', border: url === edit.main_image ? '2px solid #0d9e6e' : '1px solid #e2e8f0' }}>
                                            <div style={{ width: 52, height: 52, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                                                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    onError={e => { (e.target as HTMLImageElement).src = RouterLogo; }} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 11, color: '#64748b', wordBreak: 'break-all' }}>{url.length > 55 ? url.slice(0, 55) + '…' : url}</div>
                                                {url === edit.main_image && <div style={{ fontSize: 10, color: '#0d9e6e', fontWeight: 800, marginTop: 2 }}>✓ תמונה ראשית</div>}
                                            </div>
                                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                                {url !== edit.main_image && (
                                                    <button onClick={() => set('main_image', url)}
                                                        style={{ padding: '4px 8px', border: '1px solid #bbf7d0', borderRadius: 8, background: 'transparent', color: '#0d9e6e', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>ראשית</button>
                                                )}
                                                <button onClick={() => removeImage(url)}
                                                    style={{ padding: '4px 8px', border: '1px solid #fecaca', borderRadius: 8, background: 'transparent', color: '#ef4444', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>🗑</button>
                                            </div>
                                        </div>
                                    ))}
                                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                        <input value={newImageUrl} onChange={e => setNewImageUrl(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && addImage()}
                                            placeholder="הוסף URL תמונה..."
                                            style={{ flex: 1, border: '2px dashed #cbd5e1', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontFamily: 'Heebo, sans-serif', outline: 'none', background: '#f8fafc' }}
                                            onFocus={e => e.target.style.borderColor = '#0d9e6e'}
                                            onBlur={e => e.target.style.borderColor = '#cbd5e1'} />
                                        <button onClick={addImage}
                                            style={{ padding: '10px 14px', background: '#0d9e6e', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontSize: 13 }}>+ הוסף</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* META */}
                    {activeSection === 'meta' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={{ background: '#fff', borderRadius: 16, padding: '16px 18px', border: '1px solid #e2e8f0' }}>
                                <FieldLabel>מידע מהמסד (לקריאה בלבד)</FieldLabel>
                                {[
                                    { label: 'מזהה (ID)', val: poi.id },
                                    { label: 'אזור', val: poi.region || '—' },
                                    { label: 'נוצר', val: (poi as any).created_at ? new Date((poi as any).created_at).toLocaleDateString('he-IL') : '—' },
                                    { label: 'עודכן', val: (poi as any).updated_at ? new Date((poi as any).updated_at).toLocaleDateString('he-IL') : '—' },
                                    { label: 'מספר תמונות', val: `${edit.images.length}` },
                                    { label: 'קואורדינטות', val: `${edit.latitude}, ${edit.longitude}` },
                                ].map(row => (
                                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                                        <span style={{ fontSize: 12, color: '#1a2e2a', fontWeight: 700 }}>{row.val}</span>
                                        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{row.label}</span>
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <InputField label="מקור (source)" value={edit.source} onChange={v => set('source', v)} placeholder="manual, osm, wikidata..." />
                                <InputField label="מזהה מקור (source_id)" value={edit.source_id} onChange={v => set('source_id', v)} placeholder="osm:12345..." />
                                <InputField label="הועלה על ידי (uploaded_by)" value={edit.uploaded_by} onChange={v => set('uploaded_by', v)} placeholder="שם משתמש..." />
                            </div>
                        </div>
                    )}

                    {/* DANGER */}
                    {activeSection === 'danger' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{ background: '#fef2f2', borderRadius: 16, padding: '20px', border: '1.5px solid #fecaca' }}>
                                <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 12 }}>⚠️</div>
                                <div style={{ fontSize: 16, fontWeight: 900, color: '#7f1d1d', textAlign: 'center', marginBottom: 8 }}>מחיקת מקום</div>
                                <p style={{ fontSize: 13, color: '#991b1b', textAlign: 'center', lineHeight: 1.6, marginBottom: 20 }}>
                                    מחיקת <strong>{poi.name}</strong> תמחק את כל הנתונים הקשורים אליו לצמיתות. פעולה זו אינה ניתנת לביטול.
                                </p>
                                <button onClick={handleDelete} disabled={deleting} style={{
                                    width: '100%', padding: '14px', border: `2px solid ${confirmDelete ? '#dc2626' : '#fecaca'}` as any,
                                    borderRadius: 12, background: confirmDelete ? '#dc2626' : '#fff',
                                    color: confirmDelete ? '#fff' : '#dc2626',
                                    fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', transition: 'all 0.15s',
                                }}>
                                    {deleting ? '⏳ מוחק...' : confirmDelete ? '⚠️ לחץ שוב לאישור סופי' : '🗑 מחק מקום לצמיתות'}
                                </button>
                                {confirmDelete && (
                                    <button onClick={() => setConfirmDelete(false)}
                                        style={{ width: '100%', padding: '10px', border: 'none', background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer', marginTop: 8, fontFamily: 'Heebo, sans-serif' }}>
                                        ביטול
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '14px 20px 18px', background: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 10, flexShrink: 0, position: 'relative' }}>
                    {saveError && (
                        <div style={{ position: 'absolute', bottom: '100%', right: 20, left: 20, marginBottom: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: '#dc2626' }}>
                            {saveError}
                        </div>
                    )}
                    <button onClick={onClose}
                        style={{ flex: 1, padding: '13px', border: '2px solid #e2e8f0', borderRadius: 12, background: '#fff', color: '#64748b', fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontSize: 14 }}>
                        ביטול
                    </button>
                    <button onClick={handleSave} disabled={saving} style={{
                        flex: 2, padding: '13px', border: 'none', borderRadius: 12,
                        background: saving ? '#94a3b8' : '#0d9e6e',
                        color: '#fff', fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer',
                        fontFamily: 'Heebo, sans-serif', fontSize: 14, transition: 'background 0.15s',
                    }}>
                        {saving ? '⏳ שומר...' : '✓ שמור שינויים'}
                    </button>
                </div>
            </div>
        </div>
    );
}
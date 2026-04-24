/**
 * AdminPlaces.tsx
 * Admin page to view, edit, and delete all places (locations) in the DB.
 * Styled to match the existing app design (RTL Hebrew, Heebo font, green brand).
 * Includes an interactive map and Google Maps URL parsing.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, BASE_URL, type POI, type Region } from '../api';
import { useAuth } from '../context/AuthContext';
import RouterLogo from '../assets/logo.jpeg';

// Map imports
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix for default Leaflet icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow
});

// ── helpers ────────────────────────────────────────────────────────────────────

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

async function deleteLocation(id: string) {
    return adminFetch(`/locations/${id}`, { method: 'DELETE' });
}

// ── types ──────────────────────────────────────────────────────────────────────

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
}

// ── constants ──────────────────────────────────────────────────────────────────

const DIFFICULTIES = ['קל - משפחות', 'קל', 'בינוני', 'מאתגר', 'קשה', 'אקסטרים'];

const DIFF_COLOR: Record<string, string> = {
    'קל - משפחות': '#16a34a',
    'קל': '#16a34a',
    'בינוני': '#d97706',
    'מאתגר': '#dc2626',
    'קשה': '#dc2626',
    'אקסטרים': '#7c3aed',
};

// ── sub-components ─────────────────────────────────────────────────────────────

// Component to handle map clicks and update coordinates
function LocationPickerMap({ lat, lng, onChange }: { lat: number; lng: number; onChange: (lat: number, lng: number) => void }) {
    const MapEvents = () => {
        useMapEvents({
            click(e) {
                onChange(e.latlng.lat, e.latlng.lng);
            }
        });
        return null;
    };

    return (
        <div style={{ height: 250, width: '100%', borderRadius: 12, overflow: 'hidden', border: '2px solid #e2e8f0', zIndex: 1 }}>
            <MapContainer center={[lat, lng]} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[lat, lng]} />
                <MapEvents />
            </MapContainer>
        </div>
    );
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const [hover, setHover] = useState(0);
    return (
        <div style={{ display: 'flex', gap: 4, direction: 'ltr' }}>
            {[1, 2, 3, 4, 5].map(n => (
                <button
                    key={n}
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(0)}
                    onClick={() => onChange(n)}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                        fontSize: 22, color: n <= (hover || value) ? '#f59e0b' : '#d1d5db',
                        transition: 'color 0.12s',
                    }}
                >★</button>
            ))}
            <span style={{ marginRight: 6, fontSize: 13, color: '#64748b', alignSelf: 'center' }}>
                {value.toFixed(1)}
            </span>
        </div>
    );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, color: '#374151', fontWeight: 600 }}>{label}</span>
            <div
                onClick={() => onChange(!checked)}
                style={{
                    width: 44, height: 24, borderRadius: 12,
                    background: checked ? '#0d9e6e' : '#d1d5db',
                    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                }}
            >
                <div style={{
                    position: 'absolute', top: 2, left: checked ? 22 : 2,
                    width: 20, height: 20, borderRadius: '50%',
                    background: '#fff', transition: 'left 0.2s',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                }} />
            </div>
        </label>
    );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
    return (
        <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5 }}>
            {children}
        </div>
    );
}

function InputField({
    label, value, onChange, type = 'text', placeholder = '', step
}: {
    label: string; value: string; onChange: (v: string) => void;
    type?: string; placeholder?: string; step?: string;
}) {
    return (
        <div>
            <FieldLabel>{label}</FieldLabel>
            <input
                type={type}
                value={value}
                step={step}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                style={{
                    width: '100%', border: '2px solid #e2e8f0', borderRadius: 10,
                    padding: '10px 12px', fontSize: 14, fontFamily: 'Heebo, sans-serif',
                    textAlign: 'right', outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = '#0d9e6e'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />
        </div>
    );
}

// ── Main Edit Drawer ───────────────────────────────────────────────────────────

function EditDrawer({
    poi,
    regions,
    onClose,
    onSaved,
    onDeleted,
}: {
    poi: POI;
    regions: Region[];
    onClose: () => void;
    onSaved: (updated: POI) => void;
    onDeleted: (id: string) => void;
}) {
    const [edit, setEdit] = useState<EditState>({
        name: poi.name,
        description: poi.description || '',
        category: poi.category,
        difficulty: poi.difficulty,
        duration_minutes: String(poi.duration_minutes ?? ''),
        has_water: poi.has_water ?? false,
        has_shade: poi.has_shade ?? false,
        accessible: poi.accessible ?? false,
        is_featured: (poi as any).is_featured ?? false,
        photo_credit: poi.photo_credit ?? '',
        main_image: poi.main_image ?? '',
        images: [...(poi.images ?? [])],
        region_id: String(poi.region_id ?? ''),
        average_rating: String(poi.average_rating ?? 4),
        latitude: String(poi.latitude ?? 32.0853), // Default coordinates if missing
        longitude: String(poi.longitude ?? 34.7818),
    });

    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [newImageUrl, setNewImageUrl] = useState('');
    const [activeSection, setActiveSection] = useState<string>('basic');
    const [mapsLink, setMapsLink] = useState('');

    const set = (key: keyof EditState, val: unknown) =>
        setEdit(prev => ({ ...prev, [key]: val }));

    const handleSave = async () => {
        setSaving(true);
        setSaveError('');
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
            };
            if (edit.duration_minutes) payload.duration_minutes = parseInt(edit.duration_minutes);
            if (edit.region_id) payload.region_id = parseInt(edit.region_id);

            const res = await adminFetch<{ data: any }>(`/locations/${poi.id}`, {
                method: 'PATCH',
                body: JSON.stringify(payload),
            });

            // Build updated POI to return to parent
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
                ...(res as any)?.data,
            };
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
            await deleteLocation(poi.id);
            onDeleted(poi.id);
        } catch (e: any) {
            setSaveError(e.message || 'שגיאה במחיקה');
            setDeleting(false);
            setConfirmDelete(false);
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

    const setMainImage = (url: string) => set('main_image', url);

    // Parses Google Maps URL to extract latitude and longitude
    const handleMapsLinkChange = (val: string) => {
        setMapsLink(val);
        // Look for @lat,lng format in the URL
        const regex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
        const match = val.match(regex);
        if (match) {
            set('latitude', match[1]);
            set('longitude', match[2]);
        }
    };

    const SECTIONS = [
        { id: 'basic', label: '📋 פרטים' },
        { id: 'location', label: '🗺️ מיקום' },
        { id: 'flags', label: '🏷️ תכונות' },
        { id: 'images', label: '🖼️ תמונות' },
        { id: 'meta', label: '⚙️ מטא' },
    ];

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1500,
            display: 'flex', alignItems: 'flex-end',
        }}>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
            />

            {/* Drawer */}
            <div style={{
                position: 'relative', width: '100%', maxWidth: 560,
                margin: '0 auto',
                background: '#f8fafc',
                borderRadius: '24px 24px 0 0',
                height: '100%',
                maxHeight: '90dvh', // Adjusted for better mobile support
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
                direction: 'rtl',
            }}>

                {/* Handle */}
                <div style={{ width: 40, height: 4, background: '#cbd5e1', borderRadius: 2, margin: '12px auto 0', flexShrink: 0 }} />

                {/* Header */}
                <div style={{
                    padding: '16px 20px 12px',
                    borderBottom: '1px solid #e2e8f0',
                    background: '#fff',
                    borderRadius: '24px 24px 0 0',
                    display: 'flex', alignItems: 'center', gap: 12,
                    flexShrink: 0,
                }}>
                    <div style={{
                        width: 52, height: 52, borderRadius: 14, overflow: 'hidden', flexShrink: 0,
                        border: '2px solid #e2e8f0',
                    }}>
                        <img
                            src={edit.main_image || RouterLogo}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={e => { (e.target as HTMLImageElement).src = RouterLogo; }}
                        />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 900, fontSize: 17, color: '#1a2e2a', lineHeight: 1.2 }}>
                            {poi.name}
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                            {poi.category} · {poi.region} · ID {poi.id}
                        </div>
                    </div>
                    <button onClick={onClose} style={{
                        background: '#f1f5f9', border: 'none', borderRadius: '50%',
                        width: 34, height: 34, cursor: 'pointer', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                </div>

                {/* Section tabs */}
                <div style={{
                    display: 'flex', gap: 4, padding: '8px 12px',
                    background: '#fff', borderBottom: '1px solid #f1f5f9',
                    overflowX: 'auto', flexShrink: 0,
                }}>
                    {SECTIONS.map(s => (
                        <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
                            padding: '7px 12px', border: 'none', borderRadius: 10, flexShrink: 0,
                            background: activeSection === s.id ? '#0d9e6e' : 'transparent',
                            color: activeSection === s.id ? '#fff' : '#64748b',
                            fontWeight: 700, fontSize: 12, cursor: 'pointer',
                            fontFamily: 'Heebo, sans-serif', whiteSpace: 'nowrap',
                            transition: 'all 0.15s',
                        }}>{s.label}</button>
                    ))}
                </div>

                {/* Main scrollable content area */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

                    {/* ── BASIC SECTION ── */}
                    {activeSection === 'basic' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <InputField label="שם" value={edit.name} onChange={v => set('name', v)} />

                            <div>
                                <FieldLabel>תיאור</FieldLabel>
                                <textarea
                                    value={edit.description}
                                    onChange={e => set('description', e.target.value)}
                                    rows={4}
                                    style={{
                                        width: '100%', border: '2px solid #e2e8f0', borderRadius: 10,
                                        padding: '10px 12px', fontSize: 14, fontFamily: 'Heebo, sans-serif',
                                        textAlign: 'right', resize: 'vertical', outline: 'none',
                                        boxSizing: 'border-box', lineHeight: 1.6,
                                    }}
                                    onFocus={e => e.target.style.borderColor = '#0d9e6e'}
                                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                />
                            </div>

                            <InputField label="קטגוריה" value={edit.category} onChange={v => set('category', v)} placeholder="טבע, מפל, חוף..." />

                            <div>
                                <FieldLabel>רמת קושי</FieldLabel>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {DIFFICULTIES.map(d => (
                                        <button key={d} onClick={() => set('difficulty', d)} style={{
                                            padding: '7px 14px', borderRadius: 20, border: '2px solid',
                                            borderColor: edit.difficulty === d ? (DIFF_COLOR[d] || '#0d9e6e') : '#e2e8f0',
                                            background: edit.difficulty === d ? (DIFF_COLOR[d] || '#0d9e6e') + '1a' : '#fff',
                                            color: edit.difficulty === d ? (DIFF_COLOR[d] || '#0d9e6e') : '#64748b',
                                            fontWeight: 700, fontSize: 13, cursor: 'pointer',
                                            fontFamily: 'Heebo, sans-serif',
                                        }}>{d}</button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <FieldLabel>אזור (Region)</FieldLabel>
                                <select
                                    value={edit.region_id}
                                    onChange={e => set('region_id', e.target.value)}
                                    style={{
                                        width: '100%', border: '2px solid #e2e8f0', borderRadius: 10,
                                        padding: '10px 12px', fontSize: 14, fontFamily: 'Heebo, sans-serif',
                                        textAlign: 'right', outline: 'none', background: '#fff',
                                        boxSizing: 'border-box', appearance: 'none',
                                    }}
                                >
                                    <option value="">-- בחר אזור --</option>
                                    {regions.map(r => (
                                        <option key={r.id} value={String(r.id)}>{r.name} ({r.name_en})</option>
                                    ))}
                                </select>
                            </div>

                            <InputField
                                label="משך ביקור (דקות)"
                                value={edit.duration_minutes}
                                onChange={v => set('duration_minutes', v)}
                                type="number"
                                placeholder="90"
                            />

                            <div>
                                <FieldLabel>דירוג ממוצע</FieldLabel>
                                <StarRating
                                    value={parseFloat(edit.average_rating) || 0}
                                    onChange={v => set('average_rating', String(v))}
                                />
                                <input
                                    type="range" min="0" max="5" step="0.1"
                                    value={edit.average_rating}
                                    onChange={e => set('average_rating', e.target.value)}
                                    style={{ width: '100%', marginTop: 8, accentColor: '#0d9e6e' }}
                                />
                            </div>
                        </div>
                    )}

                    {/* ── LOCATION SECTION ── */}
                    {activeSection === 'location' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                            {/* Google Maps Link Extractor */}
                            <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 12, padding: '12px' }}>
                                <FieldLabel>חלץ מיקום מגוגל מפות</FieldLabel>
                                <input
                                    type="text"
                                    value={mapsLink}
                                    onChange={e => handleMapsLinkChange(e.target.value)}
                                    placeholder="הדבק קישור (לדוגמה: https://www.google.com/maps/.../@32.1,34.8,15z)"
                                    style={{
                                        width: '100%', border: '2px solid #e2e8f0', borderRadius: 10,
                                        padding: '10px 12px', fontSize: 13, fontFamily: 'Heebo, sans-serif',
                                        textAlign: 'left', outline: 'none', boxSizing: 'border-box',
                                        direction: 'ltr', background: '#fff'
                                    }}
                                    onFocus={e => e.target.style.borderColor = '#0d9e6e'}
                                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                />
                                <div style={{ fontSize: 11, color: '#16a34a', marginTop: 6, fontWeight: 600 }}>
                                    הדבק קישור מלא והקואורדינטות יתמלאו אוטומטית למטה
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 10 }}>
                                <div style={{ flex: 1 }}>
                                    <InputField
                                        label="קו רוחב (Latitude)"
                                        type="number"
                                        step="any"
                                        value={edit.latitude}
                                        onChange={v => set('latitude', v)}
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <InputField
                                        label="קו אורך (Longitude)"
                                        type="number"
                                        step="any"
                                        value={edit.longitude}
                                        onChange={v => set('longitude', v)}
                                    />
                                </div>
                            </div>
                            <div>
                                <FieldLabel>בחר מיקום על המפה (לחץ כדי לעדכן)</FieldLabel>
                                <LocationPickerMap
                                    lat={parseFloat(edit.latitude) || 32.0853}
                                    lng={parseFloat(edit.longitude) || 34.7818}
                                    onChange={(lat, lng) => {
                                        set('latitude', lat.toFixed(6));
                                        set('longitude', lng.toFixed(6));
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {/* ── FLAGS SECTION ── */}
                    {activeSection === 'flags' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={{
                                background: '#fff', borderRadius: 16, padding: '16px 18px',
                                border: '1px solid #e2e8f0',
                                display: 'flex', flexDirection: 'column', gap: 16,
                            }}>
                                <Toggle label="🌟 מומלץ" checked={edit.is_featured} onChange={v => set('is_featured', v)} />
                                <div style={{ height: 1, background: '#f1f5f9' }} />
                                <Toggle label="💧 יש מים" checked={edit.has_water} onChange={v => set('has_water', v)} />
                                <div style={{ height: 1, background: '#f1f5f9' }} />
                                <Toggle label="🌳 יש צל" checked={edit.has_shade} onChange={v => set('has_shade', v)} />
                                <div style={{ height: 1, background: '#f1f5f9' }} />
                                <Toggle label="♿ נגיש לעגלות" checked={edit.accessible} onChange={v => set('accessible', v)} />
                            </div>
                        </div>
                    )}

                    {/* ── IMAGES SECTION ── */}
                    {activeSection === 'images' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {/* Main image */}
                            <div>
                                <FieldLabel>תמונה ראשית (URL)</FieldLabel>
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                    <div style={{
                                        width: 64, height: 64, borderRadius: 12, overflow: 'hidden',
                                        border: '2px solid #0d9e6e', flexShrink: 0,
                                    }}>
                                        <img
                                            src={edit.main_image || RouterLogo}
                                            alt=""
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            onError={e => { (e.target as HTMLImageElement).src = RouterLogo; }}
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <input
                                            value={edit.main_image}
                                            onChange={e => set('main_image', e.target.value)}
                                            placeholder="https://..."
                                            style={{
                                                width: '100%', border: '2px solid #e2e8f0', borderRadius: 10,
                                                padding: '10px 12px', fontSize: 13, fontFamily: 'Heebo, sans-serif',
                                                outline: 'none', boxSizing: 'border-box',
                                            }}
                                            onFocus={e => e.target.style.borderColor = '#0d9e6e'}
                                            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                        />
                                        {edit.main_image && (
                                            <button
                                                onClick={() => set('main_image', '')}
                                                style={{
                                                    marginTop: 6, padding: '4px 10px', border: '1px solid #fecaca',
                                                    borderRadius: 8, background: 'transparent', color: '#ef4444',
                                                    fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                                                }}
                                            >🗑 מחק תמונה ראשית</button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Photo credit */}
                            <InputField
                                label="קרדיט לצלם"
                                value={edit.photo_credit}
                                onChange={v => set('photo_credit', v)}
                                placeholder="שם הצלם..."
                            />

                            {/* Image gallery */}
                            <div>
                                <FieldLabel>גלריית תמונות ({edit.images.length})</FieldLabel>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {edit.images.map((url, idx) => (
                                        <div key={url} style={{
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            background: '#fff', borderRadius: 12, padding: '8px 12px',
                                            border: url === edit.main_image ? '2px solid #0d9e6e' : '1px solid #e2e8f0',
                                        }}>
                                            <div style={{
                                                width: 48, height: 48, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
                                            }}>
                                                <img
                                                    src={url}
                                                    alt=""
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    onError={e => { (e.target as HTMLImageElement).src = RouterLogo; }}
                                                />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 11, color: '#64748b', wordBreak: 'break-all', lineClamp: 1 }}>
                                                    {url.length > 50 ? url.slice(0, 50) + '…' : url}
                                                </div>
                                                {url === edit.main_image && (
                                                    <div style={{ fontSize: 10, color: '#0d9e6e', fontWeight: 800, marginTop: 2 }}>
                                                        ✓ תמונה ראשית
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                                {url !== edit.main_image && (
                                                    <button onClick={() => setMainImage(url)} style={{
                                                        padding: '4px 8px', border: '1px solid #bbf7d0',
                                                        borderRadius: 8, background: 'transparent', color: '#0d9e6e',
                                                        fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                                                    }}>ראשית</button>
                                                )}
                                                <button onClick={() => removeImage(url)} style={{
                                                    padding: '4px 8px', border: '1px solid #fecaca',
                                                    borderRadius: 8, background: 'transparent', color: '#ef4444',
                                                    fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
                                                }}>🗑</button>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Add new image */}
                                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                        <input
                                            value={newImageUrl}
                                            onChange={e => setNewImageUrl(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && addImage()}
                                            placeholder="הוסף URL תמונה..."
                                            style={{
                                                flex: 1, border: '2px dashed #cbd5e1', borderRadius: 10,
                                                padding: '10px 12px', fontSize: 13, fontFamily: 'Heebo, sans-serif',
                                                outline: 'none', background: '#f8fafc',
                                            }}
                                            onFocus={e => e.target.style.borderColor = '#0d9e6e'}
                                            onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                                        />
                                        <button onClick={addImage} style={{
                                            padding: '10px 14px', background: '#0d9e6e', color: '#fff',
                                            border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer',
                                            fontFamily: 'Heebo, sans-serif', fontSize: 13,
                                        }}>+ הוסף</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── META SECTION ── */}
                    {activeSection === 'meta' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={{ background: '#fff', borderRadius: 16, padding: '16px 18px', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {[
                                        { label: 'מזהה (ID)', val: poi.id },
                                        { label: 'אזור', val: poi.region },
                                        { label: 'קצב דירוג', val: `${poi.average_rating} ⭐` },
                                        { label: 'מספר תמונות', val: `${edit.images.length} תמונות` },
                                        { label: 'קו רוחב', val: edit.latitude },
                                        { label: 'קו אורך', val: edit.longitude },
                                    ].map(row => (
                                        <div key={row.label} style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: '8px 0', borderBottom: '1px solid #f1f5f9',
                                        }}>
                                            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>{row.label}</span>
                                            <span style={{ fontSize: 13, color: '#1a2e2a', fontWeight: 700 }}>{row.val}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Danger zone */}
                            <div style={{
                                background: '#fef2f2', borderRadius: 16, padding: '16px 18px',
                                border: '1px solid #fecaca',
                            }}>
                                <p style={{ fontSize: 12, color: '#7f1d1d', marginBottom: 12, lineHeight: 1.5 }}>
                                    מחיקת מקום תמחק את כל הנתונים הקשורים אליו. פעולה זו אינה הפיכה.
                                </p>
                                <button
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    style={{
                                        width: '100%', padding: '12px', border: 'none', borderRadius: 12,
                                        background: confirmDelete ? '#dc2626' : '#fff',
                                        color: confirmDelete ? '#fff' : '#dc2626',
                                        border: `2px solid ${confirmDelete ? '#dc2626' : '#fecaca'}`,
                                        fontWeight: 800, fontSize: 14, cursor: 'pointer',
                                        fontFamily: 'Heebo, sans-serif',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    {deleting ? '⏳ מוחק...' : confirmDelete ? '⚠️ לחץ שוב לאישור מחיקה' : '🗑 מחק מקום לצמיתות'}
                                </button>
                                {confirmDelete && (
                                    <button onClick={() => setConfirmDelete(false)} style={{
                                        width: '100%', padding: '8px', border: 'none',
                                        background: 'transparent', color: '#94a3b8',
                                        fontSize: 12, cursor: 'pointer', marginTop: 6,
                                        fontFamily: 'Heebo, sans-serif',
                                    }}>ביטול מחיקה</button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Fixed footer at the bottom of the flex container */}
                <div style={{
                    padding: '14px 20px 20px',
                    background: '#fff',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex', gap: 10,
                    borderRadius: '0 0 24px 24px',
                    marginTop: 'auto',
                    flexShrink: 0,
                }}>
                    {saveError && (
                        <div style={{
                            position: 'absolute', bottom: 90, right: 20, left: 20,
                            background: '#fef2f2', border: '1px solid #fecaca',
                            borderRadius: 10, padding: '8px 12px', fontSize: 12, color: '#dc2626',
                        }}>{saveError}</div>
                    )}
                    <button onClick={onClose} style={{
                        flex: 1, padding: '13px', border: '2px solid #e2e8f0', borderRadius: 12,
                        background: '#fff', color: '#64748b', fontWeight: 700, cursor: 'pointer',
                        fontFamily: 'Heebo, sans-serif', fontSize: 14,
                    }}>ביטול</button>
                    <button onClick={handleSave} disabled={saving} style={{
                        flex: 2, padding: '13px', border: 'none', borderRadius: 12,
                        background: saving ? '#94a3b8' : '#0d9e6e',
                        color: '#fff', fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer',
                        fontFamily: 'Heebo, sans-serif', fontSize: 14,
                        transition: 'background 0.15s',
                    }}>
                        {saving ? '⏳ שומר...' : '✓ שמור שינויים'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Place Card ─────────────────────────────────────────────────────────────────

function PlaceCard({ poi, onEdit }: { poi: POI; onEdit: (poi: POI) => void }) {
    const diff = DIFF_COLOR[poi.difficulty] || '#64748b';

    return (
        <div
            onClick={() => onEdit(poi)}
            style={{
                background: '#fff',
                borderRadius: 20,
                overflow: 'hidden',
                boxShadow: '0 2px 16px rgba(0,0,0,0.07)',
                cursor: 'pointer',
                transition: 'transform 0.15s, box-shadow 0.15s',
                border: `1px solid ${(poi as any).is_featured ? '#bbf7d0' : 'transparent'}`,
            }}
            onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 24px rgba(0,0,0,0.12)';
            }}
            onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 16px rgba(0,0,0,0.07)';
            }}
        >
            <div style={{ position: 'relative', height: 160 }}>
                <img
                    src={poi.main_image || RouterLogo}
                    alt={poi.name}
                    loading="lazy"
                    onError={e => { (e.target as HTMLImageElement).src = RouterLogo; (e.target as HTMLImageElement).onerror = null; }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 50%)',
                }} />

                {/* Difficulty badge */}
                <span style={{
                    position: 'absolute', bottom: 10, right: 10,
                    background: '#fff', color: diff,
                    borderRadius: 8, padding: '3px 10px',
                    fontSize: 11, fontWeight: 800,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                }}>{poi.difficulty}</span>

                {/* Recommended badge */}
                {(poi as any).is_featured && (
                    <span style={{
                        position: 'absolute', top: 10, left: 10,
                        background: '#0d9e6e', color: '#fff',
                        borderRadius: 20, padding: '3px 10px',
                        fontSize: 10, fontWeight: 800,
                    }}>🌟 מומלץ</span>
                )}

                {/* Edit overlay icon */}
                <div style={{
                    position: 'absolute', top: 10, right: 10,
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.9)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0d9e6e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                </div>

                {/* Photo credit */}
                {poi.photo_credit && (
                    <div style={{
                        position: 'absolute', bottom: 8, left: 8,
                        background: 'rgba(255,255,255,0.9)', borderRadius: 5,
                        padding: '2px 6px', fontSize: 9, fontWeight: 600, color: '#374151',
                    }}>צילום: {poi.photo_credit}</div>
                )}
            </div>

            <div style={{ padding: '12px 14px 14px', direction: 'rtl' }}>
                <div style={{ fontWeight: 900, fontSize: 15, color: '#1a2e2a', marginBottom: 4 }}>
                    {poi.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{
                        fontSize: 11, color: '#64748b', background: '#f1f5f9',
                        borderRadius: 6, padding: '2px 8px', fontWeight: 600,
                    }}>{poi.category}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>·</span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>{poi.region}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>·</span>
                    <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>
                        ★ {poi.average_rating?.toFixed(1) || '4.0'}
                    </span>
                </div>
                {poi.description && (
                    <p style={{
                        fontSize: 12, color: '#94a3b8', marginTop: 6, lineHeight: 1.5,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                    }}>{poi.description}</p>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {poi.has_water && <span style={{ fontSize: 10, color: '#0369a1', background: '#e0f2fe', borderRadius: 5, padding: '1px 6px' }}>💧 מים</span>}
                    {poi.has_shade && <span style={{ fontSize: 10, color: '#15803d', background: '#dcfce7', borderRadius: 5, padding: '1px 6px' }}>🌳 צל</span>}
                    {poi.accessible && <span style={{ fontSize: 10, color: '#7c3aed', background: '#f3e8ff', borderRadius: 5, padding: '1px 6px' }}>♿ נגיש</span>}
                    {poi.images?.length > 0 && (
                        <span style={{ fontSize: 10, color: '#64748b', background: '#f1f5f9', borderRadius: 5, padding: '1px 6px' }}>
                            🖼 {poi.images.length}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AdminPlaces() {
    const navigate = useNavigate();
    const { user, isLoading } = useAuth();

    const [pois, setPois] = useState<POI[]>([]);
    const [regions, setRegions] = useState<Region[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterRegion, setFilterRegion] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterRecommended, setFilterRecommended] = useState(false);
    const [editing, setEditing] = useState<POI | null>(null);
    const [successToast, setSuccessToast] = useState('');

    useEffect(() => {
        if (!isLoading && (!user || !(user as any).is_admin)) navigate('/');
    }, [user, isLoading, navigate]);

    useEffect(() => {
        if (!user || !(user as any).is_admin) return;
        Promise.all([
            // Fetch using adminFetch with a high limit to bypass pagination and get all records
            adminFetch<{ data: POI[] }>('/locations?limit=10000').then(res => res.data || (res as unknown as POI[])),
            fetchRegions(),
        ]).then(([locs, regs]) => {
            setPois(locs);
            setRegions(regs);
        }).finally(() => setLoading(false));
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

    // Derived filters
    const uniqueCategories = [...new Set(pois.map(p => p.category))].sort();
    const uniqueRegions = [...new Set(pois.map(p => p.region).filter(Boolean))].sort();

    const filtered = pois.filter(p => {
        if (filterRecommended && !(p as any).is_featured) return false;
        if (filterRegion && p.region !== filterRegion) return false;
        if (filterCategory && p.category !== filterCategory) return false;
        if (search) {
            const q = search.toLowerCase();
            return p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
        }
        return true;
    });

    if (isLoading || loading) {
        return (
            <div style={{ background: '#f8fafc', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'rtl' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🗺️</div>
                    <div style={{ color: '#94a3b8', fontSize: 14 }}>טוען מקומות...</div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', direction: 'rtl' }}>

            {/* Header */}
            <div style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 100%)', width: '100%' }}>
                <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 44px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <button onClick={() => navigate('/admin')} style={{
                            background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 12,
                            padding: '8px 14px', cursor: 'pointer', color: '#fff', fontSize: 13,
                            fontWeight: 700, fontFamily: 'Heebo, sans-serif',
                        }}>← פאנל ניהול</button>
                        <div style={{ textAlign: 'right' }}>
                            <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 900, marginBottom: 4 }}>
                                🗺️ ניהול מקומות
                            </h1>
                            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                                {pois.length} מקומות בסה"כ · {filtered.length} מוצגים
                            </p>
                        </div>
                    </div>

                    {/* Stats */}
                    <div style={{ display: 'flex', gap: 10 }}>
                        {[
                            { label: 'סה"כ מקומות', val: pois.length, icon: '📍' },
                            { label: 'מומלצים', val: pois.filter(p => (p as any).is_featured).length, icon: '🌟' },
                            { label: 'אזורים', val: uniqueRegions.length, icon: '🗾' },
                            { label: 'קטגוריות', val: uniqueCategories.length, icon: '🏷️' },
                        ].map(s => (
                            <div key={s.label} style={{
                                flex: 1, background: 'rgba(255,255,255,0.08)',
                                borderRadius: 14, padding: '12px', textAlign: 'center',
                            }}>
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
                <div style={{
                    background: '#fff', borderRadius: 20, padding: '16px 18px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.06)', marginBottom: 20,
                    display: 'flex', flexDirection: 'column', gap: 12,
                }}>
                    {/* Search */}
                    <div style={{ position: 'relative' }}>
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="חיפוש לפי שם, תיאור, קטגוריה..."
                            style={{
                                width: '100%', border: '2px solid #e2e8f0', borderRadius: 12,
                                padding: '12px 44px 12px 16px', fontSize: 14,
                                fontFamily: 'Heebo, sans-serif', textAlign: 'right',
                                outline: 'none', boxSizing: 'border-box',
                            }}
                            onFocus={e => e.target.style.borderColor = '#0d9e6e'}
                            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                        />
                        <div style={{ position: 'absolute', top: '50%', right: 14, transform: 'translateY(-50%)' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                        </div>
                    </div>

                    {/* Filter row */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <select
                            value={filterRegion}
                            onChange={e => setFilterRegion(e.target.value)}
                            style={{
                                border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '8px 12px',
                                fontSize: 13, fontFamily: 'Heebo, sans-serif', background: '#fff',
                                color: filterRegion ? '#0d9e6e' : '#64748b', outline: 'none',
                                fontWeight: filterRegion ? 700 : 400,
                            }}
                        >
                            <option value="">כל האזורים</option>
                            {uniqueRegions.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>

                        <select
                            value={filterCategory}
                            onChange={e => setFilterCategory(e.target.value)}
                            style={{
                                border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '8px 12px',
                                fontSize: 13, fontFamily: 'Heebo, sans-serif', background: '#fff',
                                color: filterCategory ? '#0d9e6e' : '#64748b', outline: 'none',
                                fontWeight: filterCategory ? 700 : 400,
                            }}
                        >
                            <option value="">כל הקטגוריות</option>
                            {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>

                        <button
                            onClick={() => setFilterRecommended(!filterRecommended)}
                            style={{
                                padding: '8px 14px', border: '1.5px solid',
                                borderColor: filterRecommended ? '#0d9e6e' : '#e2e8f0',
                                borderRadius: 10, background: filterRecommended ? '#f0fdf8' : '#fff',
                                color: filterRecommended ? '#0d9e6e' : '#64748b',
                                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                                fontFamily: 'Heebo, sans-serif',
                            }}
                        >🌟 מומלצים בלבד</button>

                        {(search || filterRegion || filterCategory || filterRecommended) && (
                            <button
                                onClick={() => { setSearch(''); setFilterRegion(''); setFilterCategory(''); setFilterRecommended(false); }}
                                style={{
                                    padding: '8px 12px', border: 'none', background: 'transparent',
                                    color: '#94a3b8', fontSize: 12, cursor: 'pointer',
                                    fontFamily: 'Heebo, sans-serif',
                                }}
                            >✕ נקה סינון</button>
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
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: 18,
                    }}>
                        {filtered.map(poi => (
                            <PlaceCard key={poi.id} poi={poi} onEdit={setEditing} />
                        ))}
                    </div>
                )}
            </div>

            {/* Edit Drawer */}
            {editing && (
                <EditDrawer
                    poi={editing}
                    regions={regions}
                    onClose={() => setEditing(null)}
                    onSaved={handleSaved}
                    onDeleted={handleDeleted}
                />
            )}

            {/* Success toast */}
            {successToast && (
                <div style={{
                    position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                    background: '#0f172a', color: '#fff', borderRadius: 14,
                    padding: '12px 20px', fontSize: 14, fontWeight: 700,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.25)', zIndex: 1000,
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
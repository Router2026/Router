// src/pages/AddReview.tsx
// Feature 2: Updated review page with location selector component.
// The user can search/select the location they are reviewing.
// The selected location's id is sent to the backend for explicit FK linkage.

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, type POI } from '../api';
import { useAuth } from '../context/AuthContext';
import type { LocationSelectorProps } from '../utils/types';

// ── Location Selector ──────────────────────────────────────────────────────────
function LocationSelector({ initialName, onSelect }: LocationSelectorProps) {
  const [query, setQuery] = useState(initialName ?? '');
  const [results, setResults] = useState<POI[]>([]);
  const [selected, setSelected] = useState<POI | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-search when the page arrives with a poi_name query param
  useEffect(() => {
    if (initialName && !selected) {
      searchLocations(initialName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchLocations = async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const pois = await api.locations.list({ search: q, limit: 8 });
      setResults(pois);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setSelected(null);
    onSelect(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchLocations(val), 300);
  };

  const handleSelect = (poi: POI) => {
    setSelected(poi);
    setQuery(poi.name);
    setOpen(false);
    onSelect(poi);
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Input */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: '#f8fafc', border: `2px solid ${selected ? '#0d9e6e' : '#e2e8f0'}`,
        borderRadius: 14, padding: '10px 14px', direction: 'rtl',
        transition: 'border-color 0.2s',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke={selected ? '#0d9e6e' : '#94a3b8'} strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <input
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="חפש מיקום..."
          style={{
            flex: 1, border: 'none', background: 'transparent', outline: 'none',
            fontSize: 14, fontFamily: 'Heebo, sans-serif', textAlign: 'right',
            color: '#1a2e2a',
          }}
        />
        {loading && (
          <div style={{
            width: 14, height: 14, border: '2px solid #e2e8f0',
            borderTopColor: '#0d9e6e', borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
          }} />
        )}
        {selected && (
          <button
            onClick={() => { setSelected(null); setQuery(''); onSelect(null); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 0, color: '#94a3b8', fontSize: 16, lineHeight: 1
            }}
          >×</button>
        )}
      </div>

      {/* Dropdown results */}
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, left: 0, zIndex: 50,
          background: '#fff', borderRadius: 14, marginTop: 4,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          border: '1px solid #e2e8f0', overflow: 'hidden',
        }}>
          {results.map(poi => (
            <button
              key={poi.id}
              onClick={() => handleSelect(poi)}
              style={{
                width: '100%', padding: '12px 16px', border: 'none',
                background: 'none', cursor: 'pointer', textAlign: 'right',
                display: 'flex', flexDirection: 'column', gap: 2,
                fontFamily: 'Heebo, sans-serif', borderBottom: '1px solid #f1f5f9',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf8')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1a2e2a' }}>{poi.name}</span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{poi.category} · {poi.region}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AddReview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const poiNameFromUrl = searchParams.get('poi_name') ?? '';

  const [selectedPoi, setSelectedPoi] = useState<POI | null>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = rating > 0 && content.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      await api.reviews.create({
        location_id: selectedPoi ? parseInt(selectedPoi.id) : undefined,
        poi_name: selectedPoi?.name ?? poiNameFromUrl ?? undefined,
        reviewer_name: user?.full_name ?? user?.username ?? undefined,
        rating,
        content,
      });
      navigate('/Explore');
    } catch (err: any) {
      setError(err.message ?? 'שגיאה בשמירת הביקורת');
      setLoading(false);
    }
  };

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', direction: 'rtl' }}>

      {/* Header */}
      <div style={{
        background: '#fff', padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid #f0f0f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}>
        <button onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="#1a2e2a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 900, color: '#1a2e2a', flex: 1, textAlign: 'right' }}>
          כתוב ביקורת
        </h1>
      </div>

      <div style={{ padding: '20px 16px', maxWidth: 560, margin: '0 auto' }}>

        {/* Location selector card */}
        <div style={{
          background: '#fff', borderRadius: 20, padding: '20px',
          marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1a2e2a', marginBottom: 14, textAlign: 'right' }}>
            על איזה מקום הביקורת?
          </h3>
          <LocationSelector
            initialName={poiNameFromUrl}
            onSelect={setSelectedPoi}
          />
          {selectedPoi && (
            <div style={{
              marginTop: 10, padding: '10px 14px', background: '#f0fdf8',
              borderRadius: 10, display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 11, color: '#0d9e6e', fontWeight: 700 }}>
                {selectedPoi.category} · {selectedPoi.region}
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#0d9e6e' }}>
                ✓ {selectedPoi.name}
              </span>
            </div>
          )}
        </div>

        {/* Star Rating */}
        <div style={{
          background: '#fff', borderRadius: 20, padding: '24px 20px',
          marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', textAlign: 'center',
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1a2e2a', marginBottom: 16 }}>
            הדירוג שלך
          </h3>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(star)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                  color: star <= (hoverRating || rating) ? '#f59e0b' : '#e2e8f0',
                  transition: 'color 0.15s ease',
                }}
              >
                <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p style={{ fontSize: 13, color: '#0d9e6e', fontWeight: 700, marginTop: 10 }}>
              {['', 'גרוע', 'לא מרוצה', 'בסדר', 'טוב', 'מצוין!'][rating]}
            </p>
          )}
        </div>

        {/* Review text */}
        <div style={{
          background: '#fff', borderRadius: 20, padding: '20px',
          marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1a2e2a', marginBottom: 14, textAlign: 'right' }}>
            הביקורת שלך
          </h3>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="ספר על החוויה שלך במקום..."
            rows={5}
            style={{
              width: '100%', border: '2px solid #e2e8f0', borderRadius: 12,
              padding: '12px', fontSize: 14, fontFamily: 'Heebo, sans-serif',
              textAlign: 'right', resize: 'none', outline: 'none', color: '#1a2e2a',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 12, padding: '12px 16px', marginBottom: 12,
            fontSize: 13, color: '#dc2626', textAlign: 'right',
          }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || !canSubmit}
          style={{
            width: '100%', padding: '16px', border: 'none', borderRadius: 16,
            background: canSubmit ? 'linear-gradient(135deg, #0d9e6e, #0bba7e)' : '#e2e8f0',
            color: canSubmit ? '#fff' : '#94a3b8',
            fontSize: 16, fontWeight: 800,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            fontFamily: 'Heebo, sans-serif',
          }}
        >
          {loading ? 'מפרסם...' : 'פרסם ביקורת'}
        </button>
      </div>

      {/* Spin animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

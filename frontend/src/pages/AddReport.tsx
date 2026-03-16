// src/pages/AddReport.tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, type POI } from '../api';
import { useAuth } from '../context/AuthContext';

// ── Location Selector ──────────────────────────────────────────────────────────

interface LocationSelectorProps {
  initialName?: string;
  onSelect: (poi: POI | null) => void;
}

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

const REPORT_TYPES = ['צפיפות', 'מצב מים', 'מצב שביל', 'חניה', 'מזג אוויר', 'סכנה', 'המלצה'];
const SEVERITIES = [
  { id: "נמוכה", label: "נמוכה", color: "#16a34a", bg: "#f0fdf4" },
  { id: "בינונית", label: "בינונית", color: "#d97706", bg: "#fffbeb" },
  { id: "גבוהה", label: "גבוהה", color: "#dc2626", bg: "#fef2f2" },
];

export default function AddReport() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isLoggedIn } = useAuth();

  const poiNameFromUrl = searchParams.get('poi_name') ?? '';
  const locationIdFromUrl = searchParams.get('location_id') ? parseInt(searchParams.get('location_id')!) : undefined;

  const [selectedPoi, setSelectedPoi] = useState<POI | null>(null);
  const [formData, setFormData] = useState({
    report_type: '',
    severity: 'בינונית',
    content: '',
    reporter_name: user?.username || 'אנונימי',
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = formData.report_type !== '' && formData.content.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');

    try {
      const finalLocationId = selectedPoi ? parseInt(selectedPoi.id) : locationIdFromUrl;

      await api.reports.create({
        ...formData,
        location_id: finalLocationId,
        poi_name: selectedPoi?.name ?? poiNameFromUrl ?? undefined,
        reporter_name: isLoggedIn ? (user?.full_name ?? user?.username ?? formData.reporter_name) : formData.reporter_name || 'אנונימי',
      });

      setSuccess(true);
      setTimeout(() => navigate(finalLocationId ? `/POIDetail?id=${finalLocationId}` : '/Reports'), 1200);
    } catch (err: unknown) {
      setError((err as { message?: string }).message ?? 'שגיאה בשליחת הדיווח');
      setLoading(false);
    }
  };

  if (success)
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "60vh",
          gap: 16,
        }}
      >
        <div style={{ fontSize: 56 }}>✅</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#0d9e6e" }}>
          הדיווח נשלח!
        </div>
      </div>
    );

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', width: '100%', direction: 'rtl' }}>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', width: '100%' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a2e2a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <h1
            style={{
              fontSize: 18,
              fontWeight: 900,
              color: "#1a2e2a",
              flex: 1,
              textAlign: "right",
              margin: 0,
            }}
          >
            דיווח חדש
          </h1>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px', paddingBottom: 100 }}>

        {/* Location selector card */}
        <div style={{
          background: '#fff', borderRadius: 20, padding: '20px',
          marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1a2e2a', marginBottom: 14, textAlign: 'right', marginTop: 0 }}>
            על איזה מקום הדיווח?
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

        {/* Report type */}
        <div
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: "20px",
            marginBottom: 16,
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
        >
          <h3
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: "#1a2e2a",
              marginBottom: 14,
              textAlign: "right",
              marginTop: 0,
            }}
          >
            סוג הדיווח
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))",
              gap: 8,
            }}
          >
            {REPORT_TYPES.map((type) => (
              <button
                key={type}
                onClick={() =>
                  setFormData((p) => ({ ...p, report_type: type }))
                }
                style={{
                  padding: "10px 6px",
                  border: `2px solid ${formData.report_type === type ? "#0d9e6e" : "#e2e8f0"}`,
                  borderRadius: 12,
                  background:
                    formData.report_type === type ? "#f0fdf8" : "#fff",
                  color: formData.report_type === type ? "#0d9e6e" : "#64748b",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "Heebo, sans-serif",
                  transition: "all 0.2s ease",
                }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Severity */}
        <div
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: "20px",
            marginBottom: 16,
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
        >
          <h3
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: "#1a2e2a",
              marginBottom: 14,
              textAlign: "right",
              marginTop: 0,
            }}
          >
            רמת חומרה
          </h3>
          <div
            style={{ display: "flex", gap: 10, flexDirection: "row-reverse" }}
          >
            {SEVERITIES.map((sev) => (
              <button
                key={sev.id}
                onClick={() => setFormData((p) => ({ ...p, severity: sev.id }))}
                style={{
                  flex: 1,
                  padding: "12px 8px",
                  border: `2px solid ${formData.severity === sev.id ? sev.color : "#e2e8f0"}`,
                  borderRadius: 12,
                  background: formData.severity === sev.id ? sev.bg : "#fff",
                  color: formData.severity === sev.id ? sev.color : "#64748b",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "Heebo, sans-serif",
                  transition: "all 0.2s ease",
                }}
              >
                {sev.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: "20px",
            marginBottom: 16,
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
        >
          <h3
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: "#1a2e2a",
              marginBottom: 14,
              textAlign: "right",
              marginTop: 0,
            }}
          >
            תיאור הדיווח
          </h3>
          <textarea
            value={formData.content}
            onChange={(e) =>
              setFormData((p) => ({ ...p, content: e.target.value }))
            }
            placeholder="תאר את המצב בשטח..."
            rows={4}
            style={{
              width: "100%",
              border: "2px solid #e2e8f0",
              borderRadius: 12,
              boxSizing: "border-box",
              padding: "12px",
              fontSize: 14,
              fontFamily: "Heebo, sans-serif",
              background: "#f8fafc",
              textAlign: "right",
              resize: "none",
              outline: "none",
              color: "#1a2e2a",
            }}
          />
        </div>

        {/* Reporter name (if not logged in) */}
        {!isLoggedIn && (
          <div
            style={{
              background: "#fff",
              borderRadius: 20,
              padding: "20px",
              marginBottom: 16,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <h3
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: "#1a2e2a",
                marginBottom: 14,
                textAlign: "right",
                marginTop: 0,
              }}
            >
              שם מדווח
            </h3>
            <input
              value={formData.reporter_name}
              onChange={(e) =>
                setFormData((p) => ({ ...p, reporter_name: e.target.value }))
              }
              placeholder="השם שיוצג לצד הדיווח"
              style={{
                width: "100%",
                padding: "12px",
                border: "2px solid #e2e8f0",
                borderRadius: 12,
                boxSizing: "border-box",
                fontSize: 14,
                fontFamily: "Heebo, sans-serif",
                background: "#f8fafc",
                textAlign: "right",
                outline: "none",
                color: "#1a2e2a",
              }}
            />
          </div>
        )}

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
        <button onClick={handleSubmit} disabled={loading || !canSubmit}
          style={{ width: '100%', padding: '16px', border: 'none', borderRadius: 16, background: canSubmit ? 'linear-gradient(135deg, #0d9e6e, #0bba7e)' : '#e2e8f0', color: canSubmit ? '#fff' : '#94a3b8', fontSize: 16, fontWeight: 800, cursor: canSubmit ? 'pointer' : 'not-allowed', fontFamily: 'Heebo, sans-serif', transition: 'all 0.2s ease', boxShadow: canSubmit ? '0 8px 20px rgba(13, 158, 110, 0.25)' : 'none' }}>
          {loading ? 'שולח...' : 'שלח דיווח'}
        </button>
      </div>

      {/* Spin animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
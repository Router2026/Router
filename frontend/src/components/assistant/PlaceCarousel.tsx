import { transformSupabaseImage, type POI } from '../../api';
import { useTripBucket } from '../../context/TripBucketContext';
import { useAssistant } from '../../context/AssistantContext';

function formatDistance(m?: number): string | null {
  if (m === undefined || m === null || !Number.isFinite(m)) return null;
  if (m < 1000) return `${Math.round(m / 10) * 10} מ' ממך`;
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} ק"מ ממך`;
}

export default function PlaceCarousel({ places }: Readonly<{ places: POI[] }>) {
  const { hasPoi } = useTripBucket();
  const { addFromCard, removeFromCard } = useAssistant();

  return (
    <div
      role="list"
      aria-label="מקומות מוצעים"
      style={{
        display: 'flex', gap: 10, overflowX: 'auto', scrollSnapType: 'x mandatory',
        padding: '4px 2px 10px', margin: '6px -2px 0', WebkitOverflowScrolling: 'touch',
      }}
    >
      {places.map(p => {
        const inRoute = hasPoi(p.id);
        const distance = formatDistance(p.distance_meters);
        const img = transformSupabaseImage(p.main_image, 320);
        return (
          <div
            key={p.id}
            role="listitem"
            style={{
              flex: '0 0 158px', scrollSnapAlign: 'start', background: '#fff', borderRadius: 14,
              border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column',
              boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
            }}
          >
            <div style={{ height: 92, background: '#e8f5f1', position: 'relative' }}>
              {img
                ? <img src={img} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 30 }}>🏞️</div>}
            </div>
            <div style={{ padding: '8px 10px 10px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#1a2e2a', lineHeight: 1.25 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {[p.category, distance ?? p.region].filter(Boolean).join(' · ')}
              </div>
              <button
                onClick={() => (inRoute ? removeFromCard(p) : addFromCard(p))}
                aria-pressed={inRoute}
                aria-label={inRoute ? `הסר את ${p.name} מהמסלול` : `הוסף את ${p.name} למסלול`}
                style={{
                  marginTop: 'auto', padding: '8px 6px', borderRadius: 10, cursor: 'pointer',
                  fontSize: 13, fontWeight: 800, fontFamily: 'Heebo, sans-serif',
                  border: inRoute ? '2px solid #0d9e6e' : 'none',
                  background: inRoute ? '#f0fdf8' : 'linear-gradient(135deg, #0d9e6e, #0bba7e)',
                  color: inRoute ? '#0d9e6e' : '#fff',
                }}
              >
                {inRoute ? '✓ במסלול' : 'הוסף למסלול ➕'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

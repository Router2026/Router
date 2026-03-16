import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const GROUP_ICONS: Record<string, string> = {
  'משפחה עם ילדים': '👨‍👩‍👧‍👦', 'משפחה': '👨‍👩‍👧‍👦',
  'חברים': '👥', 'יחיד': '🚶', 'זוג': '👫',
  'solo': '🚶', 'couple': '👫', 'family': '👨‍👩‍👧‍👦', 'friends': '👥',
};

export default function MyTrips() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<any[]>([]);
  // Add loading state initialized to true
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch trips and handle loading state
    api.trips.list()
      .then(data => setTrips(data))
      .catch(err => console.error('Failed to fetch trips:', err))
      .finally(() => setIsLoading(false)); // Always turn off loading when done
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setDeletingId(id);
    setConfirmId(null);
    try {
      await api.trips.delete(id);
      setTrips(prev => prev.filter(t => String(t.id) !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
    setDeletingId(null);
  };

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', width: '100%', direction: 'rtl' }}>

      {/* ── Header (Full Width) ── */}
      <div style={{
        background: 'linear-gradient(160deg, #0d9e6e 0%, #0bba7e 100%)',
        width: '100%'
      }}>
        <div style={{
          maxWidth: 600, margin: '0 auto',
          padding: '48px 20px 40px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <button
            onClick={() => navigate('/TripPlanner')}
            style={{
              background: '#fff', border: 'none', borderRadius: 12,
              padding: '8px 16px', cursor: 'pointer',
              color: '#0d9e6e', fontSize: 13, fontWeight: 800,
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: 'Heebo, sans-serif',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            חדש
          </button>
          <div style={{ textAlign: 'right' }}>
            <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 900, marginBottom: 4 }}>המסלולים שלי</h1>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>כל המסלולים שיצרת במקום אחד</p>
          </div>
        </div>
      </div>

      {/* ── Main Content Container (Centered) ── */}
      <div style={{ maxWidth: 600, margin: '0 auto', paddingBottom: 100 }}>

        {/* Loading State */}
        {isLoading && (
          <div style={{ padding: '80px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#0d9e6e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#64748b', marginTop: 16 }}>טוען מסלולים...</div>
          </div>
        )}

        {/* Trip Cards Grid */}
        {!isLoading && trips.length > 0 && (
          <div style={{ padding: '20px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            {trips.map(trip => {
              const id = String(trip.id);
              const isConfirming = confirmId === id;
              const isDeleting = deletingId === id;
              return (
                <div
                  key={id}
                  onClick={() => navigate(`/TripDetail?id=${id}`)}
                  style={{
                    background: '#fff', borderRadius: 20, overflow: 'hidden',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.06)', cursor: 'pointer',
                    border: `1px solid ${isConfirming ? '#fecaca' : '#f0fdf8'}`,
                    transition: 'all 0.2s ease', position: 'relative',
                  }}
                >
                  {/* Card header */}
                  <div style={{
                    height: 100,
                    background: isConfirming
                      ? 'linear-gradient(160deg, #ef4444 0%, #f87171 100%)'
                      : 'linear-gradient(160deg, #0d9e6e 0%, #34d399 100%)',
                    display: 'flex', alignItems: 'flex-end', padding: '16px',
                    transition: 'background 0.2s ease',
                  }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>{trip.name}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                        </svg>
                        {trip.region}
                      </div>
                    </div>
                  </div>

                  {/* Card body */}
                  <div style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 12, fontWeight: 600 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                        </svg>
                        {trip.total_duration_hours} שעות
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 12, fontWeight: 600 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="5" cy="6" r="2" /><path d="M5 8v12" /><circle cx="19" cy="18" r="2" /><path d="M19 16V4" />
                        </svg>
                        {trip.stops?.length || 0} עצירות
                      </div>
                    </div>
                    {trip.style && (
                      <span style={{
                        display: 'inline-block', background: '#f0fdf8',
                        color: '#0d9e6e', borderRadius: 8, padding: '4px 12px',
                        fontSize: 12, fontWeight: 700, marginBottom: 12,
                      }}>{trip.style}</span>
                    )}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      borderTop: '1px solid #f0fdf8', paddingTop: 12,
                    }}>
                      <button
                        onClick={(e) => handleDelete(id, e)}
                        disabled={isDeleting}
                        style={{
                          background: isConfirming ? '#ef4444' : 'transparent',
                          border: `1.5px solid ${isConfirming ? '#ef4444' : '#e2e8f0'}`,
                          borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
                          color: isConfirming ? '#fff' : '#94a3b8',
                          fontSize: 12, fontWeight: 700, fontFamily: 'Heebo, sans-serif',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {isDeleting ? '...' : isConfirming ? 'מחיקה?' : '🗑'}
                      </button>
                      <span style={{ fontSize: 16 }}>{GROUP_ICONS[trip.group_type] || '🚶'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && trips.length === 0 && (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 20 }}>🗺️</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#1a2e2a', marginBottom: 8 }}>אין מסלולים עדיין</div>
            <div style={{ fontSize: 15, color: '#64748b', marginBottom: 24 }}>צור את המסלול הראשון שלך ותתחיל לטייל!</div>
            <button
              onClick={() => navigate('/TripPlanner')}
              style={{
                background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)', color: '#fff', border: 'none', borderRadius: 16,
                padding: '16px 40px', fontSize: 16, fontWeight: 800, cursor: 'pointer',
                fontFamily: 'Heebo, sans-serif', boxShadow: '0 8px 20px rgba(13, 158, 110, 0.2)'
              }}
            >
              צור מסלול חדש
            </button>
          </div>
        )}

      </div>

      {/* Global styles for the spinner animation */}
      <style>{`
        @keyframes spin { 
          to { transform: rotate(360deg); } 
        }
      `}</style>
    </div>
  );
}
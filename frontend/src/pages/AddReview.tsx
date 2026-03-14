import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '../api';

export default function AddReview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const poiName = searchParams.get('poi_name') || '';

  const [formData, setFormData] = useState({
    poi_name: poiName,
    rating: 0,
    content: '',
  });
  const [loading, setLoading] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);

  const handleSubmit = async () => {
    if (!formData.rating || !formData.content) return;
    setLoading(true);
    await base44.entities.Review.create(formData);
    navigate('/Explore');
  };

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        background: '#fff', padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid #f0f0f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a2e2a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 900, color: '#1a2e2a', flex: 1, textAlign: 'right' }}>כתוב ביקורת</h1>
      </div>

      <div style={{ padding: '20px 16px' }}>
        {/* Location */}
        {poiName && (
          <div style={{
            background: '#fff', borderRadius: 16, padding: '14px 16px', marginBottom: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end',
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1a2e2a' }}>{poiName}</span>
            <div style={{
              width: 36, height: 36, borderRadius: 12,
              background: '#f0fdf8', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0d9e6e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
          </div>
        )}

        {/* Star Rating */}
        <div style={{
          background: '#fff', borderRadius: 20, padding: '24px 20px',
          marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', textAlign: 'center',
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1a2e2a', marginBottom: 16 }}>הדירוג שלך</h3>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setFormData(p => ({ ...p, rating: star }))}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                  color: star <= (hoverRating || formData.rating) ? '#f59e0b' : '#e2e8f0',
                  transition: 'color 0.15s ease',
                }}
              >
                <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </button>
            ))}
          </div>
          {formData.rating > 0 && (
            <p style={{ fontSize: 13, color: '#0d9e6e', fontWeight: 700, marginTop: 10 }}>
              {['', 'גרוע', 'לא מרוצה', 'בסדר', 'טוב', 'מצוין!'][formData.rating]}
            </p>
          )}
        </div>

        {/* Review Text */}
        <div style={{
          background: '#fff', borderRadius: 20, padding: '20px',
          marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1a2e2a', marginBottom: 14, textAlign: 'right' }}>הביקורת שלך</h3>
          <textarea
            value={formData.content}
            onChange={e => setFormData(p => ({ ...p, content: e.target.value }))}
            placeholder="ספר על החוויה שלך במקום..."
            rows={5}
            style={{
              width: '100%', border: '2px solid #e2e8f0', borderRadius: 12,
              padding: '12px', fontSize: 14, fontFamily: 'Heebo, sans-serif',
              textAlign: 'right', resize: 'none', outline: 'none', color: '#1a2e2a',
            }}
          />
        </div>

        <button style={{
          width: '100%', padding: '14px', border: '2px dashed #e2e8f0',
          borderRadius: 16, background: '#fff', marginBottom: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          color: '#94a3b8', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          fontFamily: 'Heebo, sans-serif',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          הוסף תמונות (+10 XP לכל תמונה)
        </button>

        <button
          onClick={handleSubmit}
          disabled={loading || !formData.rating || !formData.content}
          style={{
            width: '100%', padding: '16px', border: 'none', borderRadius: 16,
            background: formData.rating && formData.content ? 'linear-gradient(135deg, #0d9e6e, #0bba7e)' : '#e2e8f0',
            color: formData.rating && formData.content ? '#fff' : '#94a3b8',
            fontSize: 16, fontWeight: 800, cursor: formData.rating && formData.content ? 'pointer' : 'not-allowed',
            fontFamily: 'Heebo, sans-serif',
          }}
        >
          {loading ? 'מפרסם...' : 'פרסם ביקורת'}
        </button>
      </div>
    </div>
  );
}

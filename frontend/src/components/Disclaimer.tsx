import { useNavigate } from 'react-router-dom';

export default function Disclaimer() {
  const navigate = useNavigate();

  return (
    <div style={{
      padding: '10px 16px 8px',
      direction: 'rtl',
      fontFamily: 'Heebo, sans-serif',
      fontSize: 11,
      color: '#94a3b8',
      textAlign: 'center',
      borderTop: '1px solid #f1f5f9',
    }}>
      {/* Main disclaimer text */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 6 }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>
          כל המידע, ההמלצות, המסלולים והמיקומים מיועדים למטרות מידע בלבד ואינם מהווים ייעוץ מקצועי. המשתמשים אחראים להחלטותיהם ולבטיחותם.
        </span>
      </div>

      {/* Legal links */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
        <button
          onClick={() => navigate('/terms')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#0d9e6e', fontFamily: 'Heebo, sans-serif', padding: '0 2px', textDecoration: 'underline', textUnderlineOffset: 2 }}
        >
          תנאי שירות
        </button>
        <span style={{ color: '#cbd5e1' }}>•</span>
        <button
          onClick={() => navigate('/privacy')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#0d9e6e', fontFamily: 'Heebo, sans-serif', padding: '0 2px', textDecoration: 'underline', textUnderlineOffset: 2 }}
        >
          מדיניות פרטיות
        </button>
        <span style={{ color: '#cbd5e1' }}>•</span>
        <button
          onClick={() => navigate('/disclaimer')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#0d9e6e', fontFamily: 'Heebo, sans-serif', padding: '0 2px', textDecoration: 'underline', textUnderlineOffset: 2 }}
        >
          הצהרת אחריות
        </button>
      </div>
    </div>
  );
}

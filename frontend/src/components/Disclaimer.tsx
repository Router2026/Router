export default function Disclaimer() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
      padding: '10px 16px', direction: 'rtl', fontFamily: 'Heebo, sans-serif',
      fontSize: 11, color: '#94a3b8', textAlign: 'center',
    }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      המידע המוצג מיועד למטרות המלצה בלבד
    </div>
  );
}

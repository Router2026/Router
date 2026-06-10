import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function LegalDisclaimer() {
  const navigate = useNavigate();

  const section = (emoji: string, title: string, children: React.ReactNode) => (
    <div style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 22 }}>{emoji}</span>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a2e2a', fontFamily: 'Heebo, sans-serif' }}>{title}</h2>
      </div>
      <div style={{ fontSize: 14, color: '#4a5568', lineHeight: 1.8, fontFamily: 'Heebo, sans-serif' }}>
        {children}
      </div>
    </div>
  );

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Heebo, sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0d9e6e 0%, #0bba7e 100%)', padding: '24px 20px 20px', color: '#fff' }}>
        <button
          onClick={() => navigate(-1)}
          aria-label="חזרה"
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, padding: '6px 14px', color: '#fff', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontSize: 14, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ← חזרה
        </button>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>הצהרת אחריות משפטית</h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, opacity: 0.85 }}>Legal Disclaimer</p>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '28px 20px 60px' }}>

        {/* Primary disclaimer box */}
        <div style={{ background: '#fff7ed', border: '2px solid #f97316', borderRadius: 14, padding: '20px', marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 28, flexShrink: 0 }}>⚠️</span>
            <div>
              <h2 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 800, color: '#9a3412', fontFamily: 'Heebo, sans-serif' }}>
                הצהרת אחריות כללית
              </h2>
              <p style={{ margin: 0, fontSize: 14, color: '#7c2d12', lineHeight: 1.8, fontFamily: 'Heebo, sans-serif', fontWeight: 500 }}>
                כל המידע, ההמלצות, המסלולים והמיקומים המוצגים באפליקציה זו מיועדים למטרות מידע בלבד ואינם מהווים ייעוץ מקצועי. המשתמשים אחראים להחלטותיהם ולבטיחותם האישית.
              </p>
              <p style={{ margin: '10px 0 0', fontSize: 12, color: '#9a3412', fontFamily: 'Heebo, sans-serif', fontStyle: 'italic' }}>
                All information, recommendations, routes, and locations are provided for informational purposes only and should not be considered professional advice. Users are responsible for their own decisions and safety.
              </p>
            </div>
          </div>
        </div>

        {section('🗺️', 'מסלולים ומיקומים', (
          <p>
            המסלולים והמיקומים המוצגים באפליקציה עשויים להיות מוגבלים לגישה, לדרוש ציוד מיוחד או להשתנות בהתאם לעונה ותנאי מזג האוויר. ודאו תמיד את התנאים בשטח בפועל לפני יציאה לדרך.
          </p>
        ))}

        {section('🤖', 'המלצות בינה מלאכותית', (
          <p>
            המלצות המסלולים המופקות על ידי מערכת הבינה המלאכותית מבוססות על מידע כללי ואינן מחליפות ידע מקצועי, הכרות אישית עם השטח, או ייעוץ של מדריך טיולים מוסמך.
          </p>
        ))}

        {section('👥', 'תוכן גולשים', (
          <p>
            ביקורות, דיווחים ותמונות שהועלו על ידי משתמשים אחרים משקפות את חוויותיהם האישיות ואינן מאומתות על ידי האפליקציה. מידע זה עשוי להיות לא עדכני או לא מדויק.
          </p>
        ))}

        {section('🏥', 'בטיחות ובריאות', (
          <p>
            האפליקציה אינה מתחשבת במצבכם הבריאותי, רמת הכושר שלכם, ניסיון הטיולים שלכם, או גורמי סיכון אחרים הייחודיים לכם. התייעצו עם רופא לפני פעילות גופנית מאומצת.
          </p>
        ))}

        {section('⚖️', 'הגבלת אחריות', (
          <p>
            האפליקציה ומפעיליה לא יהיו אחראים לכל נזק ישיר, עקיף, מקרי או תוצאתי הנובע משימוש בשירות, כולל פציעות גופניות, אבדן ציוד, אחור, או נזק אחר הנגרם בשל הסתמכות על המידע המוצג.
          </p>
        ))}

        <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 24, fontFamily: 'Heebo, sans-serif', lineHeight: 1.7 }}>
          שימוש מתמשך באפליקציה מהווה הסכמה להצהרת אחריות זו.
          <br />
          לשאלות: צרו קשר דרך עמוד הפרופיל.
        </p>
      </div>
    </div>
  );
}

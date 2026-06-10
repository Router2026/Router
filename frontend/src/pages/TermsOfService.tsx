import React from 'react';
import { useNavigate } from 'react-router-dom';

const BRAND = 'Router';


export default function TermsOfService() {
  const navigate = useNavigate();

  const section = (title: string, children: React.ReactNode) => (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1a2e2a', marginBottom: 10, fontFamily: 'Heebo, sans-serif' }}>
        {title}
      </h2>
      <div style={{ fontSize: 14, color: '#4a5568', lineHeight: 1.8, fontFamily: 'Heebo, sans-serif' }}>
        {children}
      </div>
    </section>
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
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>תנאי שירות</h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, opacity: 0.85 }}>עודכן לאחרונה: יוני 2025</p>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '28px 20px 60px' }}>

        {/* Disclaimer banner */}
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: '14px 16px', marginBottom: 28, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
          <p style={{ margin: 0, fontSize: 13, color: '#9a3412', lineHeight: 1.7, fontFamily: 'Heebo, sans-serif' }}>
            <strong>הצהרת אחריות:</strong> כל המידע, ההמלצות, המסלולים והמיקומים המוצגים באפליקציה זו מיועדים למטרות מידע בלבד ואינם מהווים ייעוץ מקצועי. המשתמשים אחראים להחלטותיהם ולבטיחותם האישית.
          </p>
        </div>

        {section('1. קבלת התנאים', (
          <p>
            בשימוש באפליקציה {BRAND}, אתם מסכימים לתנאי שירות אלה. אם אינכם מסכימים לכל התנאים, אנא הימנעו משימוש בשירות.
          </p>
        ))}

        {section('2. תיאור השירות', (
          <p>
            {BRAND} היא פלטפורמה לתיירות ומסלולים המאפשרת למשתמשים לגלות מקומות עניין, לתכנן מסלולים, לשתף חוויות ולקבל המלצות מבוססות בינה מלאכותית. השירות מסופק "כמות שהוא" (as-is).
          </p>
        ))}

        {section('3. הגבלת אחריות', (
          <>
            <p>
              {BRAND} ומפעיליה אינם אחראים לכל נזק, אבדן, פציעה או אי-נוחות שעלולים לנבוע מהסתמכות על המידע, המסלולים, המיקומים או ההמלצות המוצגים באפליקציה.
            </p>
            <p style={{ marginTop: 10 }}>
              המשתמשים מחויבים לבדוק באופן עצמאי את התנאים בשטח, לוודא שהמסלול מתאים לרמת הכושר שלהם ולהצטייד ציוד מתאים לפני יציאה לטיול.
            </p>
          </>
        ))}

        {section('4. תוכן משתמשים', (
          <p>
            תוכן שתעלו לאפליקציה (תמונות, ביקורות, דיווחים) חייב להיות מדויק, לא פוגעני ועומד בכל החוקים הרלוונטיים. אתם מעניקים ל-{BRAND} רישיון לשימוש בתוכן זה לצורך הפעלת השירות.
          </p>
        ))}

        {section('5. קניין רוחני', (
          <p>
            כל הזכויות בתוכן המקורי של האפליקציה, כולל עיצוב, לוגו וקוד, שמורות ל-{BRAND}. אין להעתיק, לשכפל או להפיץ תוכן זה ללא אישור בכתב.
          </p>
        ))}

        {section('6. שינויים בתנאים', (
          <p>
            {BRAND} שומרת לעצמה את הזכות לעדכן תנאים אלה בכל עת. שימוש מתמשך בשירות לאחר פרסום שינויים מהווה קבלת התנאים המעודכנים.
          </p>
        ))}

        {section('7. יצירת קשר', (
          <p>
            לשאלות בנוגע לתנאי שירות אלה, ניתן לפנות אלינו דרך עמוד הפרופיל באפליקציה.
          </p>
        ))}
      </div>
    </div>
  );
}

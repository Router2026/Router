import React from 'react';
import { useNavigate } from 'react-router-dom';


export default function PrivacyPolicy() {
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
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>מדיניות פרטיות</h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, opacity: 0.85 }}>עודכן לאחרונה: יוני 2025</p>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '28px 20px 60px' }}>

        {section('1. מידע שאנו אוספים', (
          <>
            <p><strong>מידע שאתם מספקים:</strong> שם משתמש, כתובת דוא"ל, סיסמה (מוצפנת), תמונת פרופיל.</p>
            <p style={{ marginTop: 8 }}><strong>מידע שנאסף אוטומטית:</strong> מיקום גיאוגרפי (בהסכמה בלבד), פעולות בתוך האפליקציה, סוג המכשיר וגרסת המערכת.</p>
            <p style={{ marginTop: 8 }}><strong>תוכן שמועלה:</strong> תמונות, ביקורות, דיווחים ומסלולים שיוצרים המשתמשים.</p>
          </>
        ))}

        {section('2. כיצד אנו משתמשים במידע', (
          <ul style={{ paddingRight: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>הפעלה ושיפור השירות</li>
            <li>התאמה אישית של המלצות ומסלולים</li>
            <li>שליחת עדכונים ותכנים רלוונטיים (בהסכמה)</li>
            <li>אבטחת החשבון ומניעת שימוש לרעה</li>
            <li>ניתוח אנונימי לשיפור חוויית המשתמש</li>
          </ul>
        ))}

        {section('3. שיתוף מידע', (
          <>
            <p>אנו <strong>לא מוכרים</strong> את המידע האישי שלכם לצדדים שלישיים.</p>
            <p style={{ marginTop: 8 }}>מידע עשוי להיות משותף עם:</p>
            <ul style={{ paddingRight: 20, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>ספקי שירותי ענן לצורך אחסון ועיבוד</li>
              <li>רשויות חוק כאשר נדרש על פי דין</li>
              <li>שותפים טכנולוגיים לצורך תפעול השירות בלבד</li>
            </ul>
          </>
        ))}

        {section('4. אבטחת מידע', (
          <p>
            אנו נוקטים באמצעי אבטחה מתקדמים כולל הצפנת נתונים, אימות דו-שלבי (כאשר מופעל) ובקרות גישה מחמירות. עם זאת, אין מערכת מאובטחת לחלוטין ואנו ממליצים לשמור על סיסמה חזקה.
          </p>
        ))}

        {section('5. עוגיות ומעקב', (
          <p>
            האפליקציה עשויה להשתמש ב-Vercel Analytics ו-Speed Insights לצורך מדידת ביצועים אנונימית. אין שימוש בעוגיות פרסומיות של צדדים שלישיים.
          </p>
        ))}

        {section('6. זכויות המשתמש', (
          <>
            <p>בהתאם לחוק הגנת הפרטיות הישראלי ולתקנות GDPR (ככל שרלוונטיות), יש לכם זכות:</p>
            <ul style={{ paddingRight: 20, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>לעיין במידע שנאסף עליכם</li>
              <li>לתקן מידע שגוי</li>
              <li>למחוק את חשבונכם ומידעכם</li>
              <li>להתנגד לעיבוד מסוים של המידע</li>
            </ul>
          </>
        ))}

        {section('7. שמירת מידע', (
          <p>
            מידע אישי נשמר כל עוד החשבון פעיל. לאחר מחיקת החשבון, מידע אישי יימחק תוך 30 יום. חלק מהתוכן שנוצר (ביקורות, דיווחים) עשוי להישמר בצורה אנונימית.
          </p>
        ))}

        {section('8. יצירת קשר', (
          <p>
            לכל שאלה בנושא פרטיות, ניתן לפנות אלינו דרך עמוד הפרופיל באפליקציה.
          </p>
        ))}
      </div>
    </div>
  );
}

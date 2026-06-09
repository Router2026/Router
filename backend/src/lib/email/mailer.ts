import nodemailer from "nodemailer";

function getTransporter() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  return nodemailer.createTransport({
    host,
    port: Number.parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const FROM = process.env.SMTP_FROM || "Router <noreply@router.app>";
const APP_URL = process.env.APP_URL || "http://localhost:5173";

export async function sendVerificationEmail(email: string, token: string) {
  const link = `${APP_URL}/VerifyEmail?token=${token}`;

  const transporter = getTransporter();
  if (!transporter) {
    console.log(`\n[EMAIL - VERIFY] To: ${email}\nLink: ${link}\n`);
    return;
  }

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "אמת את כתובת האימייל שלך – Router",
    html: `
      <div dir="rtl" style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:12px">
        <h2 style="color:#0d9e6e">ברוך הבא ל-Router 🧭</h2>
        <p style="color:#374151">כדי להשלים את ההרשמה, לחץ על הכפתור למטה לאימות כתובת האימייל שלך:</p>
        <a href="${link}" style="display:inline-block;margin:16px 0;padding:14px 28px;background:#0d9e6e;color:#fff;border-radius:10px;text-decoration:none;font-weight:bold;font-size:16px">
          אמת אימייל
        </a>
        <p style="color:#6b7280;font-size:13px">הקישור תקף ל-24 שעות. אם לא נרשמת, התעלם מאימייל זה.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
        <p style="color:#9ca3af;font-size:12px">Router – גלה את ישראל</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const link = `${APP_URL}/ResetPassword?token=${token}`;

  const transporter = getTransporter();
  if (!transporter) {
    console.log(`\n[EMAIL - RESET] To: ${email}\nLink: ${link}\n`);
    return;
  }

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "איפוס סיסמה – Router",
    html: `
      <div dir="rtl" style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:12px">
        <h2 style="color:#0f172a">איפוס סיסמה 🔐</h2>
        <p style="color:#374151">קיבלנו בקשה לאיפוס הסיסמה שלך. לחץ על הכפתור למטה כדי לבחור סיסמה חדשה:</p>
        <a href="${link}" style="display:inline-block;margin:16px 0;padding:14px 28px;background:#0f172a;color:#fff;border-radius:10px;text-decoration:none;font-weight:bold;font-size:16px">
          איפוס סיסמה
        </a>
        <p style="color:#6b7280;font-size:13px">הקישור תקף לשעה אחת. אם לא ביקשת איפוס, התעלם מאימייל זה.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
        <p style="color:#9ca3af;font-size:12px">Router – גלה את ישראל</p>
      </div>
    `,
  });
}

import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

function StrengthBar({ password }: { password: string }) {
  const score = [/.{6,}/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  const labels = ['', 'חלשה', 'בינונית', 'חזקה', 'מצוינת'];
  const colors = ['#e2e8f0', '#ef4444', '#f59e0b', '#0d9e6e', '#059669'];
  if (!password) return null;
  return (
    <div style={{ marginBottom: 16, direction: 'rtl' }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 4,
              background: i <= score ? colors[score] : '#e2e8f0',
              transition: 'background 0.3s',
            }}
          />
        ))}
      </div>
      <div style={{ fontSize: 11, color: colors[score], fontWeight: 700, textAlign: 'right' }}>
        {score > 0 && `חוזק סיסמה: ${labels[score]}`}
      </div>
    </div>
  );
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { loginWithToken } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const token = params.get('token');

  if (!token)
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f0f4f3',
          gap: 16,
          direction: 'rtl',
        }}
      >
        <div style={{ fontSize: 64 }}>❌</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#1a2e2a' }}>קישור לא תקין</div>
        <button
          onClick={() => navigate('/ForgotPassword')}
          style={{
            padding: '12px 24px',
            background: '#0d9e6e',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            fontWeight: 800,
            cursor: 'pointer',
            fontFamily: 'Heebo, sans-serif',
          }}
        >
          בקש קישור חדש
        </button>
      </div>
    );

  if (success)
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f0f4f3',
          gap: 16,
          direction: 'rtl',
        }}
      >
        <div style={{ fontSize: 64 }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#0d9e6e' }}>הסיסמה עודכנה!</div>
        <div style={{ color: '#64748b' }}>מועבר לדף הבית...</div>
      </div>
    );

  const handleSubmit = async () => {
    if (password.length < 6) {
      setError('הסיסמה חייבת להכיל לפחות 6 תווים');
      return;
    }
    if (password !== confirm) {
      setError('הסיסמאות אינן תואמות');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { token: jwt } = await api.auth.resetPassword(token!, password);
      await loginWithToken(jwt);
      setSuccess(true);
      setTimeout(() => navigate('/'), 2000);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  };

  const inputBase: React.CSSProperties = {
    width: '100%',
    padding: '14px 16px',
    border: '2px solid #e2e8f0',
    borderRadius: 14,
    fontSize: 15,
    fontFamily: 'Heebo, sans-serif',
    direction: 'ltr',
    textAlign: 'left',
    outline: 'none',
    background: '#f8fafc',
    color: '#1a2e2a',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ background: '#f0f4f3', minHeight: '100vh', direction: 'rtl' }}>
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          padding: '40px 24px 56px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 44, marginBottom: 8 }}>🔑</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>איפוס סיסמה</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>
          בחר סיסמה חדשה לחשבון שלך
        </div>
      </div>

      <div
        style={{
          maxWidth: 420,
          margin: '-28px auto 0',
          padding: '0 20px 100px',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: 24,
            boxShadow: '0 8px 40px rgba(0,0,0,0.1)',
            padding: '28px 24px 24px',
          }}
        >
          <div style={{ marginBottom: 4 }}>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 700,
                color: '#64748b',
                textAlign: 'right',
                marginBottom: 6,
              }}
            >
              סיסמה חדשה *
            </label>
            <div style={{ position: 'relative' }}>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="לפחות 6 תווים"
                type={showPass ? 'text' : 'password'}
                style={{ ...inputBase, paddingLeft: 44 }}
                onFocus={(e) => (e.target.style.borderColor = '#0d9e6e')}
                onBlur={(e) => (e.target.style.borderColor = '#e2e8f0')}
              />
              <button
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: 4,
                }}
              >
                {showPass ? (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <StrengthBar password={password} />

          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 700,
                color: '#64748b',
                textAlign: 'right',
                marginBottom: 6,
              }}
            >
              אימות סיסמה *
            </label>
            <div style={{ position: 'relative' }}>
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="הכנס סיסמה שוב"
                type={showPass ? 'text' : 'password'}
                style={{
                  ...inputBase,
                  paddingRight: 44,
                  borderColor:
                    confirm && confirm !== password
                      ? '#ef4444'
                      : confirm && confirm === password
                        ? '#0d9e6e'
                        : '#e2e8f0',
                }}
              />
              {confirm && (
                <div
                  style={{
                    position: 'absolute',
                    right: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 16,
                  }}
                >
                  {confirm === password ? '✅' : '❌'}
                </div>
              )}
            </div>
            {confirm && confirm !== password && (
              <div style={{ fontSize: 11, color: '#ef4444', textAlign: 'right', marginTop: 4 }}>
                הסיסמאות אינן תואמות
              </div>
            )}
          </div>

          {error && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 12,
                padding: '12px 16px',
                color: '#dc2626',
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 16,
                textAlign: 'center',
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              border: 'none',
              borderRadius: 16,
              background: loading ? '#e2e8f0' : 'linear-gradient(135deg, #0f172a, #1e293b)',
              color: loading ? '#94a3b8' : '#fff',
              fontSize: 16,
              fontWeight: 900,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'Heebo, sans-serif',
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'מעדכן...' : '🔑 עדכן סיסמה'}
          </button>
        </div>
      </div>
    </div>
  );
}

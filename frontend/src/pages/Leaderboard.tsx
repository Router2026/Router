import { useState, useEffect } from 'react';
import { base44, type UserProfile } from '../api';

const MEDALS = ['🥇', '🥈', '🥉'];
const LEVEL_COLORS: Record<string, string> = {
  'שועל שטח': '#f59e0b',
  חוקר: '#7c3aed',
  מתחיל: '#0d9e6e',
};

export default function Leaderboard() {
  const [users, setUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    base44.entities.UserProfile.list().then((data) =>
      setUsers(data.sort((a, b) => (b.xp_points || 0) - (a.xp_points || 0)))
    );
  }, []);

  const myRank = 1; // current user is first
  const myUser = users[0];

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div
        style={{
          background: 'linear-gradient(160deg, #d97706 0%, #f59e0b 100%)',
          padding: '48px 20px 60px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 8 }}>🏆</div>
        <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 900, marginBottom: 4 }}>
          טבלת מובילים
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>המטיילים הפעילים ביותר</p>
      </div>

      {/* My Rank Card */}
      <div
        style={{
          padding: '0 16px',
          marginTop: -28,
          position: 'relative',
          zIndex: 10,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: 20,
            boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
            padding: '20px',
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: '#94a3b8',
              fontWeight: 600,
              marginBottom: 4,
              textAlign: 'right',
            }}
          >
            המיקום שלך
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#d97706' }}>#{myRank}</div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1a2e2a' }}>
                @{myUser?.username || 'אורח'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0d9e6e' }}>
                {myUser?.xp_points || 1250} XP
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard List */}
      <div style={{ padding: '0 16px 24px' }}>
        {users.map((user, i) => (
          <div
            key={user.id}
            style={{
              background: i === 0 ? 'linear-gradient(135deg, #fffbeb, #fef3c7)' : '#fff',
              borderRadius: 16,
              marginBottom: 10,
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              border: i === 0 ? '2px solid #fbbf24' : '1px solid #f0f0f0',
            }}
          >
            {/* Rank */}
            <div style={{ width: 32, textAlign: 'center', flexShrink: 0 }}>
              {i < 3 ? (
                <span style={{ fontSize: 22 }}>{MEDALS[i]}</span>
              ) : (
                <span style={{ fontSize: 16, fontWeight: 800, color: '#94a3b8' }}>#{i + 1}</span>
              )}
            </div>

            {/* Avatar */}
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                flexShrink: 0,
                background: `linear-gradient(135deg, ${LEVEL_COLORS[user.level] || '#0d9e6e'}, #34d399)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 16,
                fontWeight: 800,
              }}
            >
              {user.username?.charAt(0)?.toUpperCase()}
            </div>

            {/* Info */}
            <div style={{ flex: 1, textAlign: 'right' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#1a2e2a' }}>
                @{user.username}
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{user.level}</div>
            </div>

            {/* XP */}
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#d97706' }}>
                {user.xp_points?.toLocaleString()}
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>XP</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

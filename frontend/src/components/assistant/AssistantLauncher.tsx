/**
 * AssistantLauncher — floating "plan my route" button + the chat panel.
 * Admin-only while the assistant is in development (the API enforces this too).
 * Sits on the left so it doesn't collide with TripBucketFab (right: 18).
 */

import { useAuth } from '../../context/AuthContext';
import { useAssistant } from '../../context/AssistantContext';
import AssistantPanel from './AssistantPanel';

export default function AssistantLauncher() {
  const { user } = useAuth();
  const { isOpen, open } = useAssistant();
  const isAdmin = !!user && !('isGuest' in user && user.isGuest) && !!(user as { is_admin?: boolean }).is_admin;

  if (!isAdmin) return null;
  if (isOpen) return <AssistantPanel />;

  return (
    <button
      onClick={open}
      aria-label="פתח את עוזר תכנון המסלול"
      style={{
        position: 'fixed', bottom: 88, left: 18, zIndex: 1500, height: 52, padding: '0 18px 0 14px',
        borderRadius: 26, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
        background: 'linear-gradient(135deg, #7c3aed, #0d9e6e)', color: '#fff', fontSize: 14, fontWeight: 800,
        fontFamily: 'Heebo, sans-serif', boxShadow: '0 6px 20px rgba(124,58,237,0.35)',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 20 }}>✨</span>
      תכנן לי מסלול
    </button>
  );
}

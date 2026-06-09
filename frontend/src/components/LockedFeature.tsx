/**
 * LockedFeature — Guest lock system
 * 
 * Two modes:
 *   <LockedFeature>children</LockedFeature>
 *     → wraps content with a visual overlay + lock icon, 
 *       click anywhere on the overlay triggers the upgrade modal.
 * 
 *   <LockedButton label="..." onGuestClick="..." onClick={fn}>
 *     → a button that either runs onClick (registered) or shows 
 *       the upgrade prompt (guest). Shows a 🔒 icon for guests.
 * 
 * Also exports: useGuestLock() hook for inline logic
 */
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import GuestUpgradePrompt from './GuestUpgradePrompt';

// ── Shared overlay ────────────────────────────────────────────────────────────

interface LockedFeatureProps {
  children: React.ReactNode;
  feature?: string;          // text shown in the modal, e.g. "שמירת מועדפים"
  dim?: boolean;             // whether to visually dim the content (default true)
  inline?: boolean;          // if true, renders inline instead of absolute overlay
}

export function LockedFeature({ children, feature, dim = true, inline = false }: LockedFeatureProps) {
  const { isGuest } = useAuth();
  const [showPrompt, setShowPrompt] = useState(false);

  if (!isGuest) return <>{children}</>;

  return (
    <>
      <div
        style={{ position: 'relative', display: inline ? 'inline-block' : 'block' }}
        onClick={e => { e.stopPropagation(); setShowPrompt(true); }}
        role="button"
        tabIndex={0}
        aria-label={`תכונה נעולה: ${feature || 'דרוש חשבון'}`}
        onKeyDown={e => e.key === 'Enter' && setShowPrompt(true)}
      >
        {/* Dimmed children */}
        <div style={{ opacity: dim ? 0.45 : 1, pointerEvents: 'none', userSelect: 'none' }}>
          {children}
        </div>

        {/* Lock badge */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 'inherit',
            cursor: 'pointer',
          }}
        >
          <div style={{
            background: 'rgba(255,255,255,0.95)',
            borderRadius: 12,
            padding: '6px 12px',
            display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            border: '1.5px solid #e2e8f0',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', fontFamily: 'Heebo, sans-serif', whiteSpace: 'nowrap' }}>
              {feature ? `${feature} — דרוש חשבון` : 'דרוש חשבון'}
            </span>
          </div>
        </div>
      </div>

      {showPrompt && <GuestUpgradePrompt feature={feature} onClose={() => setShowPrompt(false)} />}
    </>
  );
}

// ── Locked button ─────────────────────────────────────────────────────────────

interface LockedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  feature?: string;
  lockLabel?: string;       // label to show in locked state
  children: React.ReactNode;
}

export function LockedButton({ feature, lockLabel, children, onClick, style, ...rest }: LockedButtonProps) {
  const { isGuest } = useAuth();
  const [showPrompt, setShowPrompt] = useState(false);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isGuest) { e.stopPropagation(); setShowPrompt(true); }
    else onClick?.(e);
  };

  const lockedStyle: React.CSSProperties = isGuest
    ? { opacity: 0.7, cursor: 'pointer', position: 'relative', ...style }
    : { ...style };

  return (
    <>
      <button
        {...rest}
        onClick={handleClick}
        aria-label={isGuest ? `${feature || 'תכונה זו'} — דרוש חשבון` : undefined}
        style={lockedStyle}
      >
        {isGuest ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            {lockLabel || children}
          </span>
        ) : children}
      </button>
      {showPrompt && <GuestUpgradePrompt feature={feature} onClose={() => setShowPrompt(false)} />}
    </>
  );
}

// ── Lock badge — small inline chip ────────────────────────────────────────────

export function LockBadge({ label }: { label?: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 8,
      background: '#fef3c7', border: '1px solid #fbbf24',
      color: '#92400e', fontSize: 11, fontWeight: 700,
      fontFamily: 'Heebo, sans-serif',
    }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
      {label || 'דרוש חשבון'}
    </span>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useGuestLock() — use in components for imperative guest-lock logic.
 * 
 * const { guardAction, showPrompt, closePrompt, isGuest } = useGuestLock('שמירת מועדפים');
 * 
 * guardAction(fn) — if guest, shows prompt; if registered, runs fn()
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useGuestLock(feature?: string) {
  const { isGuest } = useAuth();
  const [promptOpen, setPromptOpen] = useState(false);

  const guardAction = (action: () => void) => {
    if (isGuest) { setPromptOpen(true); return; }
    action();
  };

  const PromptComponent = promptOpen
    ? <GuestUpgradePrompt feature={feature} onClose={() => setPromptOpen(false)} />
    : null;

  return { guardAction, isGuest, promptOpen, closePrompt: () => setPromptOpen(false), PromptComponent };
}

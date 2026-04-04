/**
 * TripBucketFab
 * -------------
 * Floating Action Button that displays the bucket item count badge
 * and opens the TripBucketSheet when clicked.
 * Intended to be overlaid on the Explore page.
 */

import { useTripBucket } from '../context/TripBucketContext';

export default function TripBucketFab() {
  const { count, openSheet } = useTripBucket();

  return (
    <button
      onClick={openSheet}
      data-tour="trip-bucket-fab"
      aria-label={`Trip Bucket — ${count} item${count !== 1 ? 's' : ''}`}
      style={{
        position: 'fixed',
        bottom: 88, // above the bottom nav bar (~72px) + 16px gap
        right: 18,
        zIndex: 1500,
        width: 56,
        height: 56,
        borderRadius: '50%',
        border: 'none',
        background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)',
        boxShadow: '0 6px 24px rgba(13,158,110,0.35)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
      }}
    >
      {/* Backpack icon */}
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10H4V10z" />
        <path d="M9 6V4a3 3 0 0 1 6 0v2" />
        <line x1="4" y1="15" x2="20" y2="15" />
      </svg>

      {/* Badge */}
      {count > 0 && (
        <div
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 20,
            height: 20,
            borderRadius: 10,
            background: '#ef4444',
            border: '2px solid #fff',
            color: '#fff',
            fontSize: 11,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            fontFamily: 'Heebo, sans-serif',
          }}
        >
          {count > 99 ? '99+' : count}
        </div>
      )}
    </button>
  );
}

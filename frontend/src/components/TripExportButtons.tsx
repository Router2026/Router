// Export a saved trip: GPX for hiking/navigation apps, ICS for the calendar.
// Everything is built on the device (utils/tripExport.ts), so it works offline too.

import { useState } from 'react';
import { toast } from 'sonner';
import type { Trip } from '../api';
import { defaultTripDate, downloadFile, safeFileName, tripToGpx, tripToIcs } from '../utils/tripExport';

const btn: React.CSSProperties = {
  flex: 1, minHeight: 44, padding: '10px 12px', borderRadius: 14, border: '2px solid #e2e8f0', background: '#fff',
  color: '#334155', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'Heebo, sans-serif',
};

export default function TripExportButtons({ trip }: Readonly<{ trip: Trip }>) {
  const [pickingDate, setPickingDate] = useState(false);
  const [date, setDate] = useState(() => defaultTripDate(trip));
  const hasCoords = (trip.stops || []).some(s => s.latitude != null && s.longitude != null);

  const exportGpx = () => {
    downloadFile(tripToGpx(trip), safeFileName(trip.name, 'gpx'), 'application/gpx+xml');
    toast.success('קובץ GPX ירד – אפשר לפתוח ב-Israel Hiking Map, Garmin ועוד');
  };

  const exportIcs = () => {
    if (!date) return;
    downloadFile(tripToIcs(trip, date), safeFileName(trip.name, 'ics'), 'text/calendar;charset=utf-8');
    setPickingDate(false);
    toast.success('קובץ יומן ירד – פתחו אותו כדי להוסיף את העצירות ליומן');
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {hasCoords && (
          <button type="button" onClick={exportGpx} style={btn} title="ייצוא למפות ניווט וטיולים">🗺️ ייצוא GPX</button>
        )}
        <button type="button" onClick={() => setPickingDate(v => !v)} aria-expanded={pickingDate} style={btn}>📅 הוספה ליומן</button>
      </div>
      {pickingDate && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, background: '#f8fafc', borderRadius: 14, padding: '10px 12px', direction: 'rtl' }}>
          <label htmlFor="trip-ics-date" style={{ fontSize: 13, fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>באיזה יום?</label>
          <input id="trip-ics-date" type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ flex: 1, minHeight: 40, borderRadius: 10, border: '1px solid #e2e8f0', padding: '0 8px', fontFamily: 'Heebo, sans-serif' }} />
          <button type="button" onClick={exportIcs} disabled={!date}
            style={{ ...btn, flex: 'none', background: '#0d9e6e', borderColor: '#0d9e6e', color: '#fff' }}>הורדה</button>
        </div>
      )}
    </div>
  );
}

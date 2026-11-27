// Export a trip to other apps, entirely on the device (works offline):
//  • GPX — stops as waypoints plus a route through them, for Israel Hiking Map, Garmin, OsmAnd…
//    No road geometry is stored, so the route is stop-to-stop; navigation apps route between points.
//  • ICS — one calendar event per stop on a chosen date, with the planned times.

import type { Trip, TripStop } from '../api';
import { estimateDriveMinutes, haversineKm, toMinutes } from './routeSchedule';

const hasCoords = (s: TripStop) => s.latitude != null && s.longitude != null;

function xml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function tripToGpx(trip: Trip): string {
  const stops = (trip.stops || []).filter(hasCoords);
  const pt = (tag: string, s: TripStop, i: number) => {
    const desc = [s.arrival_time && `${s.arrival_time} · ${s.duration_minutes} דק'`, s.reason].filter(Boolean).join(' — ');
    return `    <${tag} lat="${Number(s.latitude).toFixed(6)}" lon="${Number(s.longitude).toFixed(6)}">\n` +
      `      <name>${xml(`${i + 1}. ${s.poi_name}`)}</name>\n` +
      (desc ? `      <desc>${xml(desc)}</desc>\n` : '') +
      `    </${tag}>`;
  };
  const wpts = stops.map((s, i) => pt('wpt', s, i).replace(/^ {4}/gm, '  ')).join('\n');
  const rtepts = stops.map((s, i) => pt('rtept', s, i)).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Router" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${xml(trip.name)}</name>${trip.description ? `<desc>${xml(trip.description)}</desc>` : ''}</metadata>
${wpts}
  <rte>
    <name>${xml(trip.name)}</name>
${rtepts}
  </rte>
</gpx>
`;
}

// ── ICS ─────────────────────────────────────────────────────────────────────

export interface TimedStop { stop: TripStop; start: number; end: number }

/**
 * Start/end minutes for every stop. Uses the planned arrival times when the trip has them;
 * a hand-built trip without times is chained from 09:00 with estimated drives in between.
 * Minutes may exceed 1440 when the day runs past midnight.
 */
export function stopTimes(stops: TripStop[], dayStart = '09:00'): TimedStop[] {
  const out: TimedStop[] = [];
  let clock = toMinutes(dayStart);
  stops.forEach((s, i) => {
    const prev = stops[i - 1];
    let start: number;
    if (s.arrival_time) {
      start = toMinutes(s.arrival_time);
      while (out.length && start < out[out.length - 1].start) start += 1440; // crossed midnight
    } else {
      const drive = prev && hasCoords(prev) && hasCoords(s)
        ? estimateDriveMinutes(haversineKm(
          { lat: Number(prev.latitude), lng: Number(prev.longitude) },
          { lat: Number(s.latitude), lng: Number(s.longitude) }))
        : 0;
      start = i === 0 ? clock : clock + drive;
    }
    const end = start + (s.duration_minutes || 60);
    out.push({ stop: s, start, end });
    clock = end;
  });
  return out;
}

/** "YYYY-MM-DD" + minutes after that midnight → floating local "YYYYMMDDTHHMMSS". */
export function icsLocal(date: string, minutes: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(y, m - 1, d, 0, minutes);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}${p(t.getMonth() + 1)}${p(t.getDate())}T${p(t.getHours())}${p(t.getMinutes())}00`;
}

function icsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** RFC 5545 line folding: at most 75 octets per line, continuation lines start with a space. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const parts: string[] = [];
  let cur = '', bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > (parts.length ? 74 : 75)) { parts.push(cur); cur = ''; bytes = 0; }
    cur += ch; bytes += n;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

export function tripToIcs(trip: Trip, date: string, now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const events = stopTimes(trip.stops || []).flatMap(({ stop, start, end }, i) => {
    const desc = [stop.reason, stop.smart_insight].filter(Boolean).join('\n');
    const lines = [
      'BEGIN:VEVENT',
      `UID:router-${trip.id}-${date}-${i}@router`,
      `DTSTAMP:${stamp}`,
      // Floating local time: the trip happens wherever the traveller's calendar is (Israel).
      `DTSTART:${icsLocal(date, start)}`,
      `DTEND:${icsLocal(date, end)}`,
      `SUMMARY:${icsText(`${i + 1}. ${stop.poi_name} · ${trip.name}`)}`,
    ];
    if (desc) lines.push(`DESCRIPTION:${icsText(desc)}`);
    if (hasCoords(stop)) {
      const ll = `${Number(stop.latitude).toFixed(6)};${Number(stop.longitude).toFixed(6)}`;
      lines.push(`GEO:${ll}`, `LOCATION:${icsText(stop.poi_name)}`);
    }
    lines.push('END:VEVENT');
    return lines;
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Router//Trip export//HE', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR']
    .map(foldLine).join('\r\n') + '\r\n';
}

// ── Download ────────────────────────────────────────────────────────────────

/** A file name that works on every OS; keeps Hebrew. */
export function safeFileName(name: string, ext: string): string {
  const base = [...name]
    .filter(ch => ch.charCodeAt(0) >= 32 && !'\\/:*?"<>|'.includes(ch))
    .join('').replace(/\s+/g, ' ').trim().slice(0, 60) || 'router-trip';
  return `${base}.${ext}`;
}

export function downloadFile(content: string, fileName: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Default calendar day: today if the trip hasn't started yet, otherwise tomorrow. */
export function defaultTripDate(trip: Trip, now = new Date()): string {
  const first = (trip.stops || []).find(s => s.arrival_time)?.arrival_time || '09:00';
  const d = new Date(now);
  if (now.getHours() * 60 + now.getMinutes() >= toMinutes(first)) d.setDate(d.getDate() + 1);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

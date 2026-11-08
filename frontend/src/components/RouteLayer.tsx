/**
 * RouteLayer — draws the Trip Bucket as a route on the Leaflet map:
 * numbered stop markers + a line in bucket order (dashed from the user's
 * location to the first stop when it's known).
 *
 * The map re-frames the route only when the assistant changed it
 * (AssistantContext.routeFocus), not on manual adds from the map itself.
 */

import { useEffect, useMemo, useRef } from 'react';
import { Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { POI } from '../api';
import { useTripBucket } from '../context/TripBucketContext';
import { useAssistant } from '../context/AssistantContext';
import { buildRouteStops, routeBoundsPoints } from '../utils/routeGeometry';

const ROUTE_COLOR = '#7c3aed';
const DESKTOP_QUERY = '(min-width: 900px)';

function stopIcon(n: number): L.DivIcon {
  return L.divIcon({
    className: 'router-route-stop',
    html: `<div style="width:30px;height:30px;border-radius:50%;background:${ROUTE_COLOR};color:#fff;border:3px solid #fff;box-shadow:0 2px 10px rgba(124,58,237,.5);display:flex;align-items:center;justify-content:center;font:800 14px Heebo,sans-serif">${n}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

const USER_ICON = L.divIcon({
  className: 'router-route-user',
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 4px rgba(37,99,235,.25)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export default function RouteLayer({ onSelect }: Readonly<{ onSelect: (poi: POI) => void }>) {
  const map = useMap();
  const { items, userLocation } = useTripBucket();
  const { routeFocus } = useAssistant();
  const stops = useMemo(() => buildRouteStops(items), [items]);
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  // Imperative markers (same approach as MarkersLayer) so they sit above photo markers.
  useEffect(() => {
    const layers: L.Marker[] = stops.map(s => {
      const m = L.marker([s.lat, s.lng], { icon: stopIcon(s.index), zIndexOffset: 2000, keyboard: true, title: `${s.index}. ${s.poi.name}` });
      m.on('click', e => { L.DomEvent.stopPropagation(e); onSelectRef.current(s.poi); });
      return m.addTo(map);
    });
    if (userLocation && stops.length) {
      layers.push(L.marker([userLocation.lat, userLocation.lng], { icon: USER_ICON, zIndexOffset: 1900, interactive: false }).addTo(map));
    }
    return () => layers.forEach(l => l.remove());
  }, [stops, userLocation, map]);

  // Re-frame the route after assistant-driven changes, leaving room for the chat panel / sheet.
  const lastFocus = useRef(routeFocus);
  useEffect(() => {
    if (routeFocus === lastFocus.current) return;
    lastFocus.current = routeFocus;
    const pts = routeBoundsPoints(stops, userLocation);
    if (!pts.length) return;
    const desktop = window.matchMedia(DESKTOP_QUERY).matches;
    const opts: L.FitBoundsOptions = {
      maxZoom: 13,
      // RTL layout: desktop chat panel is docked on the left; mobile sheet (peek) covers the bottom.
      paddingTopLeft: desktop ? [420, 90] : [30, 90],
      paddingBottomRight: desktop ? [40, 40] : [30, 180],
      duration: 0.8,
    };
    if (pts.length === 1) map.flyTo(pts[0], 12, { duration: 0.8 });
    else map.flyToBounds(L.latLngBounds(pts), opts);
  }, [routeFocus, stops, userLocation, map]);

  if (!stops.length) return null;
  const line = stops.map(s => [s.lat, s.lng] as [number, number]);

  return (
    <>
      {/* white casing under the line keeps it readable on any tile colour */}
      <Polyline positions={line} pathOptions={{ color: '#fff', weight: 8, opacity: 0.9, interactive: false }} />
      <Polyline positions={line} pathOptions={{ color: ROUTE_COLOR, weight: 4, opacity: 0.95, interactive: false }} />
      {userLocation && (
        <Polyline
          positions={[[userLocation.lat, userLocation.lng], line[0]]}
          pathOptions={{ color: ROUTE_COLOR, weight: 3, opacity: 0.7, dashArray: '6 8', interactive: false }}
        />
      )}
    </>
  );
}

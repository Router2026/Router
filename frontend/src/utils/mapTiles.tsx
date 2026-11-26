// One basemap for every Leaflet map in the app, so the tile provider changes in one place.
//
// Why Esri World Street Map: the free OpenStreetMap tile server blocks apps under its usage
// policy ("Access blocked") and CARTO basemaps now return an "API KEY REQUIRED" image. Esri's
// street map needs no key, has Hebrew labels for Israel, and only requires attribution.

import { TileLayer } from 'react-leaflet';

export const BASEMAP_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
export const BASEMAP_ATTRIBUTION = 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors';
export const BASEMAP_MAX_ZOOM = 19;

export function BaseTileLayer() {
  return <TileLayer url={BASEMAP_URL} attribution={BASEMAP_ATTRIBUTION} maxZoom={BASEMAP_MAX_ZOOM} />;
}

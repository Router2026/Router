const API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? "";
const BASE = "https://places.googleapis.com/v1";

export interface PlacesEnrichment {
  placeId: string;
  photoUrls: string[];
  photoCredit: string;
}

async function getPhotoUrl(photoName: string): Promise<string> {
  const res = await fetch(
    `${BASE}/${photoName}/media?maxWidthPx=1200&skipHttpRedirect=true&key=${API_KEY}`,
  );
  if (!res.ok) return "";
  const data = await res.json() as { photoUri?: string };
  return data.photoUri ?? "";
}

export async function enrichFromPlaces(
  name: string,
  latitude: number,
  longitude: number,
): Promise<PlacesEnrichment | null> {
  const res = await fetch(`${BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": "places.id,places.photos,places.attributions",
    },
    body: JSON.stringify({
      textQuery: name,
      locationBias: {
        circle: {
          center: { latitude, longitude },
          radius: 3000,
        },
      },
      maxResultCount: 1,
      languageCode: "he",
    }),
  });

  if (!res.ok) return null;
  const data = await res.json() as { places?: Array<{ id: string; photos?: Array<{ name: string; authorAttributions?: Array<{ displayName: string }> }> }> };
  const place = data.places?.[0];
  if (!place) return null;

  const photos = place.photos?.slice(0, 5) ?? [];
  const photoUrls = (await Promise.all(photos.map(p => getPhotoUrl(p.name)))).filter(Boolean);

  const credit = photos[0]?.authorAttributions?.[0]?.displayName ?? "Google";

  return { placeId: place.id, photoUrls, photoCredit: credit };
}

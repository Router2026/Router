# Example API Responses

## POST /api/locations/:id/images
**Request body:**
```json
{ "image_url": "https://example.com/trail.jpg" }
```
**Response 201:**
```json
{
  "data": {
    "image": {
      "id": 42,
      "user_id": 7,
      "location_id": 123,
      "image_url": "https://example.com/trail.jpg",
      "created_at": "2025-03-20T10:00:00Z",
      "username": "david_hiker"
    },
    "xp": {
      "new_xp": 110,
      "new_level": 1,
      "level_label": "חוקר",
      "leveled_up": true
    },
    "limit": 5
  },
  "error": null
}
```
**429 (spam limit):**
```json
{
  "data": null,
  "error": { "message": "Maximum 5 images per location reached", "code": "LIMIT_REACHED" }
}
```

---

## GET /api/trips/public
**Response 200:**
```json
{
  "data": [
    {
      "id": 1,
      "user_id": 7,
      "title": "טיול ביום בגליל",
      "description": "מסלול יפהפה דרך נחלי הגליל",
      "route_geojson": null,
      "is_public": true,
      "created_at": "2025-03-15T08:30:00Z",
      "creator_username": "david_hiker",
      "creator_avatar": "https://example.com/avatar.jpg",
      "creator_xp": 1250,
      "location_count": 4,
      "locations": [
        {
          "id": 1,
          "location_id": 55,
          "name": "נחל עמוד",
          "category": "נחל",
          "latitude": 32.85,
          "longitude": 35.5,
          "main_image": "https://example.com/nachal.jpg",
          "order_index": 0,
          "region_name": "גליל",
          "difficulty": "בינוני"
        }
      ]
    }
  ],
  "error": null
}
```

---

## POST /api/favorites/:locationId
**Response 201:**
```json
{
  "data": {
    "favorited": true,
    "favorite": {
      "id": 88,
      "user_id": 7,
      "location_id": 55,
      "created_at": "2025-03-20T11:00:00Z"
    }
  },
  "error": null
}
```

## DELETE /api/favorites/:locationId
**Response 200:**
```json
{ "data": { "favorited": false }, "error": null }
```

---

## GET /api/users/me/favorites
**Response 200:**
```json
{
  "data": [
    {
      "id": 88,
      "user_id": 7,
      "location_id": 55,
      "created_at": "2025-03-20T11:00:00Z",
      "name": "נחל עמוד",
      "category": "נחל",
      "region_name": "גליל",
      "latitude": 32.85,
      "longitude": 35.5,
      "main_image": "https://example.com/nachal.jpg",
      "difficulty": "בינוני",
      "average_rating": 4.7
    }
  ],
  "error": null
}
```

---

## PATCH /api/users/me
**Request body:**
```json
{
  "bio": "טייל נלהב מהגליל 🏔️",
  "avatar_url": "https://example.com/me.jpg",
  "favorite_regions": ["גליל", "גולן"],
  "instagram": "@david_trails",
  "website": "https://mytrails.co.il"
}
```
**Response 200:**
```json
{
  "data": {
    "id": 7,
    "username": "david_hiker",
    "full_name": "David Cohen",
    "bio": "טייל נלהב מהגליל 🏔️",
    "avatar_url": "https://example.com/me.jpg",
    "cover_image": null,
    "favorite_regions": ["גליל", "גולן"],
    "instagram": "@david_trails",
    "website": "https://mytrails.co.il",
    "xp": 1250,
    "xp_points": 1250,
    "level": "נווט",
    "level_number": 5,
    "reports_count": 5,
    "reviews_count": 12,
    "trips_count": 3,
    "created_at": "2024-01-15T00:00:00Z"
  },
  "error": null
}
```

---

## Level Formula Reference

| XP     | level = floor(sqrt(xp/50)) | Label          |
|--------|---------------------------|----------------|
| 0–49   | 0                         | מטייל מתחיל    |
| 50–199 | 1                         | חוקר           |
| 200–449| 2                         | חוקר           |
| 450–799| 3                         | שועל שטח       |
| 800–1249| 4                        | מגלה           |
| 1250–1799| 5                       | נווט           |
| 1800+  | 6+                        | אלוף המסלולים  |

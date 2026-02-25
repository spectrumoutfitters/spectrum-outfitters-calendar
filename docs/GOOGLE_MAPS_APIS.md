# Google Maps Platform — Which APIs to Enable

For **Spectrum Outfitters Calendar** (event location, address validation, Street View, directions), enable these in [Google Cloud Console](https://console.cloud.google.com/apis/library):

## Required for current features

| API | Purpose |
|-----|--------|
| **Street View Static API** | Backend proxy for a single Street View image (fallback when interactive fails). |
| **Maps JavaScript API** | **Interactive** Street View in the Add Event modal: drag to look around, use arrows to move to nearby positions. Same `GOOGLE_MAPS_API_KEY` in `backend/.env`; the key is served to the frontend for this. |

## Optional (improve address handling)

| API | Purpose |
|-----|--------|
| **Geocoding API** | Convert addresses to coordinates. The app currently uses Nominatim (free) for validation; enabling this would allow switching to Google for geocoding. |
| **Address Validation API** | Stricter address verification and formatting. Optional if you want Google’s validation instead of or in addition to Nominatim. |

## Not needed for the "Directions" button

The **Directions** button in the Add Event modal opens the device’s maps app (or app chooser on mobile) with the address pre-filled. It uses a `geo:` link and/or Google Maps web URL; it does **not** call Google’s Directions API from the server.

You do **not** need to enable:

- **Directions API** — only needed if you were computing or displaying turn-by-turn directions inside the app.
- **Navigation SDK** — for in-app navigation UI, not for opening an external maps app.
- **Routes API** / **Distance Matrix API** — for server-side routing/distance, not for the "open in maps" button.

## Summary

- **Enable:** **Street View Static API** (static image fallback) and **Maps JavaScript API** (interactive Street View: drag to look around, move to nearby positions).
- **Optional:** Geocoding API, Address Validation API.
- **Do not enable** for this feature: Directions API, Navigation SDK, Routes API, Distance Matrix API.

Use the **same API key** in `backend/.env` as `GOOGLE_MAPS_API_KEY` for the Street View proxy.

## Troubleshooting: Street View returns 502

If the in-app Street View snapshot fails with **502**, the UI will show the exact error message from Google. Fix it in Google Cloud:

1. **Enable Street View Static API** — In [APIs & Services → Library](https://console.cloud.google.com/apis/library), search for “Street View Static API” and enable it for your project.
2. **Enable billing** — Maps Platform APIs require a billing account (free tier is available). In [Billing](https://console.cloud.google.com/billing), link a billing account to the project.
3. **API key restrictions** — The Street View request is made from your **backend**, not the browser. If the key is restricted:
   - **Do not** restrict by “HTTP referrers (websites)” only — that blocks server-side calls.
   - Use an **unrestricted** key, or restrict by **IP addresses** and add your server’s IP.

After changing the key or project, restart the backend.

For **interactive** Street View (drag to look around), the same key is loaded in the browser. If the key is restricted, add your app origins under **HTTP referrers** (e.g. `http://localhost:5173/*`, `https://yourdomain.com/*`).

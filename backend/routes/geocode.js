/**
 * Geocode (address validation) and Street View snapshot.
 * - GET /api/geocode?address=... — validate address via Nominatim (free), returns { lat, lng, display_name, valid }.
 * - GET /api/streetview?lat=&lng= — proxy Google Street View Static image (optional GOOGLE_MAPS_API_KEY).
 */
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';
// Nominatim usage policy requires a custom User-Agent identifying the app (not a library default)
const NOMINATIM_HEADERS = {
  'User-Agent': 'SpectrumOutfittersCalendar/1.0 (Event location lookup; https://nominatim.org/usage-policy)'
};
// Nominatim allows max 1 request per second; throttle to avoid 429/403
let lastNominatimRequest = 0;
async function throttledNominatimFetch(url) {
  const now = Date.now();
  const elapsed = now - lastNominatimRequest;
  if (elapsed < 1100) await new Promise((r) => setTimeout(r, 1100 - elapsed));
  lastNominatimRequest = Date.now();
  return fetch(url, { headers: NOMINATIM_HEADERS });
}

// GET /?address=... — validate address (Nominatim, no key required). Mounted at /api/geocode
router.get('/', async (req, res) => {
  try {
    const address = (req.query.address || '').trim();
    if (!address || address.length < 5) {
      return res.status(400).json({ valid: false, error: 'Enter an address to validate.' });
    }
    const url = `${NOMINATIM_BASE}?format=json&q=${encodeURIComponent(address)}&limit=1`;
    const resp = await throttledNominatimFetch(url);
    if (!resp.ok) {
      console.warn('Nominatim geocode error:', resp.status, await resp.text().catch(() => ''));
      return res.status(502).json({ valid: false, error: 'Address lookup failed. Try again in a moment.' });
    }
    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) {
      return res.json({ valid: false, error: 'Address not found. Check spelling or try a different format.' });
    }
    const first = data[0];
    const lat = parseFloat(first.lat);
    const lng = parseFloat(first.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.json({ valid: false, error: 'Invalid coordinates returned.' });
    }
    res.json({
      valid: true,
      lat,
      lng,
      display_name: first.display_name || ''
    });
  } catch (e) {
    console.error('Geocode error:', e?.message || e);
    res.status(500).json({ valid: false, error: 'Address lookup failed.' });
  }
});

// GET /suggest?q=... — address autocomplete: returns list of suggestions for dropdown. Mounted at /api/geocode
router.get('/suggest', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) {
      return res.json({ suggestions: [] });
    }
    const url = `${NOMINATIM_BASE}?format=json&q=${encodeURIComponent(q)}&addressdetails=1&limit=6`;
    const resp = await throttledNominatimFetch(url);
    if (!resp.ok) {
      console.warn('Nominatim suggest error:', resp.status, await resp.text().catch(() => ''));
      return res.json({ suggestions: [], error: 'Address search temporarily unavailable.' });
    }
    const data = await resp.json();
    const suggestions = (Array.isArray(data) ? data : []).map((item) => ({
      display_name: item.display_name || '',
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon)
    })).filter((s) => s.display_name && !Number.isNaN(s.lat) && !Number.isNaN(s.lon));
    res.json({ suggestions });
  } catch (e) {
    console.error('Geocode suggest error:', e?.message || e);
    res.json({ suggestions: [] });
  }
});

// GET /streetview?lat=&lng= — proxy Street View image (requires GOOGLE_MAPS_API_KEY). Mounted at /api/geocode
router.get('/streetview', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: 'lat and lng required' });
    }
    const key = (process.env.GOOGLE_MAPS_API_KEY || '').trim();
    if (!key) {
      return res.status(404).json({ error: 'Street View not configured. Add GOOGLE_MAPS_API_KEY to backend/.env and restart the backend.' });
    }
    const size = '400x300';
    const url = `https://maps.googleapis.com/maps/api/streetview?size=${size}&location=${lat},${lng}&key=${key}`;
    const imgResp = await fetch(url);
    const contentType = (imgResp.headers.get('content-type') || '').toLowerCase();

    // Google often returns 200 with JSON body on error (e.g. REQUEST_DENIED, ZERO_RESULTS)
    if (contentType.includes('application/json')) {
      const json = await imgResp.json();
      const status = json.status || '';
      const errMsg = json.error_message || 'Street View unavailable.';
      console.warn('Street View API returned JSON:', status, errMsg);
      return res.status(502).json({ error: errMsg });
    }

    if (!imgResp.ok) {
      const body = await imgResp.text();
      let errMsg = 'Could not load Street View image.';
      try {
        const json = JSON.parse(body);
        if (json.error_message) errMsg = json.error_message;
      } catch (_) {}
      console.warn('Street View API HTTP error:', imgResp.status, body?.slice(0, 300));
      return res.status(502).json({ error: errMsg });
    }

    res.set('Cache-Control', 'private, max-age=3600');
    res.set('Content-Type', contentType || 'image/jpeg');
    const buf = await imgResp.arrayBuffer();
    res.send(Buffer.from(buf));
  } catch (e) {
    console.error('Streetview proxy error:', e?.message || e);
    res.status(500).json({ error: 'Failed to load Street View.' });
  }
});

export default router;

import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import {
  getGoogleCalendarConfig,
  getAuthUrl,
  handleOAuthCallback,
  pullChangesFromGoogle,
  disconnectGoogleCalendar,
  listCalendars,
  setCalendarId,
  setSyncCalendarIds,
  clearGoogleSourcedScheduleEntries
} from '../utils/googleCalendarService.js';

const router = express.Router();

// Callback does NOT require auth (Google redirects here)
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    await handleOAuthCallback({ code, state });

    // Simple success page (works even if the app isn't open)
    res
      .status(200)
      .send(
        `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Google Calendar Connected</title>
    <style>
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:32px;background:#f9fafb;color:#111827}
      .card{max-inline-size:720px;margin:0 auto;background:white;border:1px solid #e5e7eb;border-radius:12px;padding:24px}
      .ok{font-size:18px;font-weight:700}
      .muted{color:#6b7280;margin-block-start:8px}
      code{background:#f3f4f6;padding:2px 6px;border-radius:6px}
    </style>
  </head>
  <body>
    <div class="card">
      <div class="ok">✅ Google Calendar connected successfully</div>
      <div class="muted">You can close this window and return to the app.</div>
      <div class="muted">If you don’t see it update, use <code>Sync Now</code> in the admin schedule view.</div>
    </div>
  </body>
</html>`
      );
  } catch (error) {
    res
      .status(400)
      .send(
        `<!doctype html><html><body style="font-family:system-ui;padding:24px;">
          <h2>❌ Google Calendar connection failed</h2>
          <pre>${String(error?.message || error)}</pre>
        </body></html>`
      );
  }
});

// Everything else requires admin
router.use(authenticateToken);
router.use(requireAdmin);

router.get('/status', async (req, res) => {
  try {
    const cfg = await getGoogleCalendarConfig();
    let sync_calendar_ids = null;
    if (cfg.sync_calendar_ids && typeof cfg.sync_calendar_ids === 'string') {
      try {
        const parsed = JSON.parse(cfg.sync_calendar_ids);
        if (Array.isArray(parsed)) sync_calendar_ids = parsed;
      } catch (_) {}
    }
    res.json({
      connected: cfg.is_connected === 1 && !!cfg.refresh_token,
      calendar_id: cfg.calendar_id || 'primary',
      sync_calendar_ids: sync_calendar_ids,
      last_synced_at: cfg.last_synced_at || null
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get Google Calendar status', details: error.message });
  }
});

router.get('/auth-url', async (req, res) => {
  try {
    const { url } = await getAuthUrl({ userId: req.user?.id });
    res.json({ url });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/disconnect', async (req, res) => {
  try {
    await disconnectGoogleCalendar();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disconnect', details: error.message });
  }
});

router.post('/sync-now', async (req, res) => {
  // Allow up to 2 minutes for multi-calendar sync (5+ calendars can take a while)
  req.setTimeout(120000);
  try {
    const result = await pullChangesFromGoogle({ fullSync: true });
    res.json({
      ok: true,
      result: {
        processed: result.processed,
        errors: result.errors
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Sync failed', details: error.message });
  }
});

// Extra (helps pick the shared calendar)
router.get('/calendars', async (req, res) => {
  try {
    const calendars = await listCalendars();
    res.json({ calendars });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list calendars', details: error.message });
  }
});

router.put('/calendar', async (req, res) => {
  try {
    const { calendar_id } = req.body;
    await setCalendarId(calendar_id);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/sync-calendars', async (req, res) => {
  try {
    const { calendar_ids } = req.body;
    await setSyncCalendarIds(Array.isArray(calendar_ids) ? calendar_ids : []);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Remove all Google-synced events, then re-sync from currently selected calendars only
router.post('/clear-and-resync', async (req, res) => {
  req.setTimeout(120000);
  try {
    const deleted = await clearGoogleSourcedScheduleEntries();
    const result = await pullChangesFromGoogle({ fullSync: true });
    res.json({
      ok: true,
      deleted,
      synced: result.processed,
      errors: result.errors
    });
  } catch (error) {
    res.status(500).json({ error: 'Cleanup/sync failed', details: error.message });
  }
});

export default router;


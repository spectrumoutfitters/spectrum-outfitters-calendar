import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import {
  getPublicBookingPayload,
  computeAvailableBookingSlots,
  submitCustomerBooking,
  getAdminBookingSnapshot,
  persistBookingSettings
} from '../utils/customerBookingService.js';
import {
  sendMailViaGoogle,
  hasGmailSendScope,
  hasSenderIdentityScope,
  getGoogleCalendarConfig,
  isGoogleCalendarConnected
} from '../utils/googleCalendarService.js';

export const bookingPublicRouter = express.Router();

const bookingConfigLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false
});

const bookingSlotsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false
});

const bookingSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false
});

bookingPublicRouter.get('/config', bookingConfigLimiter, async (req, res) => {
  try {
    const config = await getPublicBookingPayload();
    res.json(config);
  } catch (err) {
    console.error('Public booking config error:', err);
    res.status(500).json({ error: 'Unable to load booking configuration' });
  }
});

bookingPublicRouter.get('/slots', bookingSlotsLimiter, async (req, res) => {
  try {
    const publicCfg = await getPublicBookingPayload();
    if (!publicCfg.enabled) {
      return res.status(503).json({ error: 'Booking is disabled or Google is not connected', slots: [] });
    }

    const { slots, reason, freebusy_errors } = await computeAvailableBookingSlots();
    return res.json({ slots, ...(reason ? { reason } : {}), ...(freebusy_errors ? { freebusy_errors } : {}) });
  } catch (err) {
    console.error('Public booking slots error:', err);
    res.status(500).json({ error: 'Unable to load available slots' });
  }
});

bookingPublicRouter.post('/submit', bookingSubmitLimiter, async (req, res) => {
  try {
    const result = await submitCustomerBooking(req.body || {});
    res.json(result);
  } catch (err) {
    const code = err?.code || 'unknown';

    const statusMap = {
      disabled: 503,
      google: 503,
      notify: 503,
      google_insert: 502,
      conflict: 409,
      spam: 400,
      validation: 400
    };

    const status = statusMap[code] || 400;
    if (status >= 500) {
      console.error('Booking submit failure:', code, err);
    }

    res.status(status).json({ error: err?.message || 'Booking failed', code });
  }
});

export const bookingAdminRouter = express.Router();
bookingAdminRouter.use(authenticateToken);
bookingAdminRouter.use(requireAdmin);

bookingAdminRouter.get('/settings', async (req, res) => {
  try {
    const snapshot = await getAdminBookingSnapshot();
    res.json(snapshot);
  } catch (err) {
    console.error('Admin booking settings get error:', err);
    res.status(500).json({ error: 'Failed to load booking settings' });
  }
});

bookingAdminRouter.patch('/settings', async (req, res) => {
  try {
    await persistBookingSettings(req.body || {});
    const snapshot = await getAdminBookingSnapshot();
    res.json({ ok: true, settings: snapshot });
  } catch (err) {
    console.error('Admin booking settings save error:', err);
    res.status(400).json({ error: err?.message || 'Failed to save settings' });
  }
});

bookingAdminRouter.post('/test-email', async (req, res) => {
  try {
    const connected = await isGoogleCalendarConnected();
    if (!connected) {
      return res.status(400).json({ error: 'Connect Google Calendar first.' });
    }
    const cfg = await getGoogleCalendarConfig();
    if (!hasGmailSendScope(cfg.oauth_scopes)) {
      return res.status(400).json({
        error: 'Gmail send permission missing. Disconnect and reconnect Google in Admin.'
      });
    }
    if (!hasSenderIdentityScope(cfg.oauth_scopes)) {
      return res.status(400).json({
        error:
          'Google needs permission to read your primary email address (for the "From:" line). Disconnect and reconnect Google in Admin → Google Calendar.'
      });
    }

    let to = '';
    const bodyTo = typeof req.body?.to === 'string' ? req.body.to.trim().toLowerCase() : '';
    if (bodyTo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bodyTo)) {
      to = bodyTo;
    } else {
      const snap = await getAdminBookingSnapshot();
      if (!snap.notify_emails?.length) {
        return res.status(400).json({ error: 'Add notify emails in booking settings, or send ?to=inbox@yourshop.com.' });
      }
      to = snap.notify_emails[0];
    }

    await sendMailViaGoogle({
      to,
      subject: '[SO Booking test] Notifications are working',
      text:
        `This test message confirms Gmail send permission for Spectrum Outfitters customer booking.\r\nSent to: ${to}\r\nTimestamp: ${new Date().toISOString()}`,
      html: `<p>This test confirms <strong>Gmail send</strong> for customer booking notices.</p><p>To: ${to}</p>`
    });

    res.json({ ok: true, sent_to: to });
  } catch (err) {
    console.error('Booking test email error:', err);
    res.status(500).json({ error: err?.message || 'Failed to send test email' });
  }
});

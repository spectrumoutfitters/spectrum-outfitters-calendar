import express from 'express';
import crypto from 'crypto';
import db from '../database/db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

function normalizeSlug(input) {
  if (!input) return '';
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-') // only allow a–z, 0–9, dash
    .replace(/^-+|-+$/g, '')       // trim leading/trailing dashes
    .slice(0, 50);
}

function generateRandomSlug() {
  // 10 random base36 chars from crypto for uniqueness
  return crypto.randomBytes(6).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toLowerCase();
}

/**
 * POST /api/links/shorten
 * Auth: admin
 * Body: { target_url, label?, custom_slug? }
 * Returns: { slug, target_url, label, path, full_url? }
 */
router.post('/api/links/shorten', authenticateToken, requireAdmin, async (req, res) => {
  const { target_url: rawTarget, label, custom_slug } = req.body || {};
  const target = (rawTarget || '').trim();

  if (!target) {
    return res.status(400).json({ error: 'target_url is required' });
  }

  // Basic URL validation; allow both http and https
  try {
    // eslint-disable-next-line no-new
    new URL(target);
  } catch {
    return res.status(400).json({ error: 'target_url must be a valid URL (include http:// or https://)' });
  }

  let slug = normalizeSlug(custom_slug);

  if (custom_slug && !slug) {
    return res.status(400).json({ error: 'custom_slug must contain letters, numbers, or dashes' });
  }

  try {
    if (slug) {
      // Custom slug: reject if already taken
      const existing = await db.getAsync('SELECT id FROM short_links WHERE slug = ?', [slug]);
      if (existing) {
        return res.status(409).json({ error: 'That short link is already in use. Choose a different slug.' });
      }
    } else {
      // Auto-generate slug with a few retries on collision
      let attempts = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const candidate = generateRandomSlug();
        const existing = await db.getAsync('SELECT id FROM short_links WHERE slug = ?', [candidate]);
        if (!existing) {
          slug = candidate;
          break;
        }
        attempts += 1;
        if (attempts > 5) {
          return res.status(500).json({ error: 'Failed to generate unique short link, please try again.' });
        }
      }
    }

    await db.runAsync(
      `INSERT INTO short_links (slug, target_url, label, created_by)
       VALUES (?, ?, ?, ?)`,
      [slug, target, label || null, req.user.id]
    );

    const path = `/secure/${slug}`;
    const base = (process.env.SHORT_LINK_BASE_URL || '').trim().replace(/\/+$/, '');
    const fullUrl = base ? `${base}${path}` : undefined;
    res.json({
      slug,
      target_url: target,
      label: label || null,
      path,
      full_url: fullUrl,
    });
  } catch (err) {
    console.error('shortLinks shorten error:', err?.message || err);
    if (String(err?.message || '').includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'That short link is already in use.' });
    }
    res.status(500).json({ error: 'Failed to create short link' });
  }
});

/**
 * GET /secure/:slug
 * Public branded redirect page, e.g. securepay.spectrumoutfitters.com/secure/abc123
 * Shows a quick "Securing your payment" screen, then forwards to target_url.
 */
router.get('/secure/:slug', async (req, res) => {
  const { slug } = req.params;
  try {
    const row = await db.getAsync(
      'SELECT target_url, label FROM short_links WHERE slug = ?',
      [slug]
    );
    if (!row) {
      return res.status(404).send('Link not found');
    }
    const target = row.target_url;
    const label = (row.label || '').slice(0, 80);
    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Spectrum Outfitters — Secure Payment</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        color-scheme: dark;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: radial-gradient(circle at top, #111827 0, #020617 55%, #000000 100%);
        color: #f9fafb;
      }
      .card {
        width: 100%;
        max-width: 420px;
        border-radius: 1.25rem;
        padding: 1.75rem 1.75rem 1.5rem;
        background: linear-gradient(145deg, rgba(15,23,42,0.96), rgba(12,10,5,0.98));
        box-shadow:
          0 18px 45px rgba(0,0,0,0.8),
          0 0 0 1px rgba(148,163,184,0.22);
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1.25rem;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.25rem 0.65rem;
        border-radius: 999px;
        font-size: 0.65rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        background: rgba(22,163,74,0.12);
        color: #bbf7d0;
        border: 1px solid rgba(16,185,129,0.6);
      }
      .lock {
        width: 40px;
        height: 40px;
        border-radius: 999px;
        background: radial-gradient(circle at 30% 10%, #facc15, #a16207 60%, #1c1917 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 0 1px rgba(250,204,21,0.35), 0 10px 25px rgba(0,0,0,0.7);
      }
      .lock-icon {
        width: 20px;
        height: 20px;
      }
      .spinner-ring {
        position: relative;
        width: 40px;
        height: 40px;
      }
      .spinner-ring::before {
        content: "";
        position: absolute;
        inset: -6px;
        border-radius: 999px;
        border: 2px solid rgba(248,250,252,0.15);
        border-top-color: #facc15;
        border-right-color: #facc15;
        animation: spin 1s linear infinite;
      }
      h1 {
        margin: 0;
        font-size: 1.1rem;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: #e5e7eb;
      }
      p {
        margin: 0;
      }
      .subtitle {
        font-size: 0.78rem;
        color: #9ca3af;
        margin-top: 0.25rem;
      }
      .label {
        margin-top: 0.75rem;
        font-size: 0.8rem;
        color: #e5e7eb;
      }
      .label span {
        display: inline-flex;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        vertical-align: bottom;
      }
      .hint {
        margin-top: 1rem;
        font-size: 0.7rem;
        color: #9ca3af;
      }
      .hint-strong {
        color: #e5e7eb;
        font-weight: 600;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    </style>
  </head>
  <body>
    <main class="card" aria-busy="true">
      <div class="brand">
        <div class="spinner-ring">
          <div class="lock">
            <svg class="lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <rect x="5" y="10" width="14" height="9" rx="2" ry="2" stroke="rgba(15,23,42,0.95)" fill="rgba(15,23,42,0.95)"/>
              <path d="M8 10V8a4 4 0 0 1 8 0v2" stroke="#facc15" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="12" cy="14" r="1.4" fill="#fefce8"/>
              <path d="M12 15.6V17" stroke="#fefce8" stroke-linecap="round"/>
            </svg>
          </div>
        </div>
        <div>
          <div class="badge">
            <span>Secure Spectrum Pay</span>
          </div>
          <h1>Checking your secure payment link…</h1>
        </div>
      </div>
      <p class="subtitle">
        Please wait a moment while we redirect you to our payment partner&apos;s encrypted checkout.
      </p>
      ${label ? `<p class="label">For: <span>${label.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span></p>` : ''}
      <p class="hint">
        You&apos;ll see <span class="hint-strong">securelink-prod.valorpaytech.com</span> in the address bar next —
        that&apos;s our PCI-compliant payment provider.
      </p>
    </main>
    <script>
      (function () {
        var target = ${JSON.stringify(target)};
        // Brief pause so the secure screen is visible, then redirect.
        setTimeout(function () {
          window.location.replace(target);
        }, 600);
      })();
    </script>
  </body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('shortLinks redirect error:', err?.message || err);
    res.status(500).send('Failed to redirect');
  }
});

/**
 * Legacy GET /pay/:slug
 * Keep existing links working; fast 302 redirect with no interstitial.
 */
router.get('/pay/:slug', async (req, res) => {
  const { slug } = req.params;
  try {
    const row = await db.getAsync(
      'SELECT target_url FROM short_links WHERE slug = ?',
      [slug]
    );
    if (!row) {
      return res.status(404).send('Link not found');
    }
    res.redirect(row.target_url);
  } catch (err) {
    console.error('shortLinks legacy redirect error:', err?.message || err);
    res.status(500).send('Failed to redirect');
  }
});

export default router;


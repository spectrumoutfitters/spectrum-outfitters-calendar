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
 * Returns: { slug, target_url, label, path }
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

    const path = `/pay/${slug}`;
    res.json({
      slug,
      target_url: target,
      label: label || null,
      path,
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
 * GET /pay/:slug
 * Public redirect: looks like spectrumoutfitters.com/pay/abc123 and 302-redirects to target_url
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
    console.error('shortLinks redirect error:', err?.message || err);
    res.status(500).send('Failed to redirect');
  }
});

export default router;


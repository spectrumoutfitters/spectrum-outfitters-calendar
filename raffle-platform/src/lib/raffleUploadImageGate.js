/**
 * Prize-image upload sanitizers (POST /api/admin/[slug]/upload-image).
 * Admin-key verification stays in verifyRaffleAdmin; this covers slug path
 * segments, MIME allowlist, size cap, and extension mapping.
 */

export const ALLOWED_RAFFLE_UPLOAD_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const MAX_RAFFLE_UPLOAD_BYTES = 2 * 1024 * 1024;

/** Strip path separators and other non [A-Za-z0-9_-]; empty → "event". */
export function safeSlugSegment(slug) {
  const s = String(slug ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return s || 'event';
}

export function extensionForAllowedMime(mime) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

export function validateRaffleUploadBytesAndType(size, type) {
  if (size > MAX_RAFFLE_UPLOAD_BYTES) {
    return { ok: false, error: 'file_too_large' };
  }
  const mime = type || 'application/octet-stream';
  if (!ALLOWED_RAFFLE_UPLOAD_MIMES.has(mime)) {
    return { ok: false, error: 'invalid_type' };
  }
  return { ok: true, mime, ext: extensionForAllowedMime(mime) };
}

export function raffleImagePublicUrl(slug, filename) {
  return `/raffle-images/${safeSlugSegment(slug)}/${filename}`;
}

/**
 * Strip CR/LF/control chars from values interpolated into raw MIME headers.
 * Public booking puts customer_name into Subject; unsanitized newlines enable header injection.
 */
export function sanitizeEmailHeaderValue(raw, { maxLen = 200 } = {}) {
  const cleaned = String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!Number.isFinite(maxLen) || maxLen <= 0) return cleaned;
  return cleaned.slice(0, maxLen);
}

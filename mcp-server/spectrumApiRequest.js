/**
 * Spectrum MCP HTTP request shaping.
 * Base URL trailing slashes are stripped. Endpoints that start with "http"
 * (case-sensitive) are used as-is; everything else is concatenated.
 * An admin token is attached as a Bearer header and overrides any caller header.
 */

export const MISSING_API_BASE_ERROR =
  'SPECTRUM_API_BASE_URL is not set (e.g. https://login.spectrumoutfitters.com/api)';

export function resolveSpectrumApiUrl(apiBase, endpoint) {
  const base = (apiBase || '').replace(/\/+$/, '');
  if (!base) {
    throw new Error(MISSING_API_BASE_ERROR);
  }
  return endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;
}

export function spectrumApiHeaders(adminToken, extraHeaders) {
  const headers = {
    'User-Agent': 'SpectrumMCP/1.0',
    ...(extraHeaders || {}),
  };
  if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
  return headers;
}

export function loginEventsEndpoint(limit = 50, offset = 0) {
  return `/admin/security/login-events?limit=${limit}&offset=${offset}`;
}

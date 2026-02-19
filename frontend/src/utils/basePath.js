/**
 * Base path for the app when deployed under a subpath (e.g. spectrumoutfitters.com/so-app).
 * Set VITE_BASE_PATH in .env when building for production (e.g. VITE_BASE_PATH=/so-app).
 * No trailing slash.
 */
export const BASE_PATH = (import.meta.env.VITE_BASE_PATH || '').replace(/\/+$/, '');

export function withBase(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return BASE_PATH ? `${BASE_PATH}${p}` : p;
}

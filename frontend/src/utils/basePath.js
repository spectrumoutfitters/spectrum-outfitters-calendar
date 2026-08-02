/**
 * Base path for the app when deployed under a subpath (e.g. spectrumoutfitters.com/so-app).
 * Set VITE_BASE_PATH in .env when building for production (e.g. VITE_BASE_PATH=/so-app).
 * No trailing slash.
 */

/** Pure join for Vite base path + app-relative path (testable without import.meta). */
export function joinBasePath(basePath, path) {
  const base = String(basePath || '').replace(/\/+$/, '');
  const p = String(path || '').startsWith('/') ? String(path) : `/${path}`;
  return base ? `${base}${p}` : p;
}

export const BASE_PATH = (import.meta.env?.VITE_BASE_PATH || '').replace(/\/+$/, '');

export function withBase(path) {
  return joinBasePath(BASE_PATH, path);
}

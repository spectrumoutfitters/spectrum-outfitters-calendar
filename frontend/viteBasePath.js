/**
 * Deployed Vite base and the dev-server API rewrite.
 * VITE_BASE_PATH=/so-app/ becomes base `/so-app/` and proxy paths lose that prefix.
 */

export function normalizeViteBasePath(raw) {
  const basePath = (raw || '').replace(/\/+$/, '');
  const base = basePath ? `${basePath}/` : '/';
  return { basePath, base };
}

export function rewriteViteApiPath(path, basePath) {
  const escaped = basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return path.replace(new RegExp(`^${escaped}`), '');
}

/** First non-loopback IPv4, for the dev cert SAN. Family must be the string 'IPv4'. */
export function firstNonInternalIPv4(nets) {
  for (const name of Object.keys(nets)) {
    for (const n of nets[name]) {
      if (n.family === 'IPv4' && !n.internal) return n.address;
    }
  }
  return null;
}

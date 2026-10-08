/** Vite dev server port the launcher tells phones to open for camera access. */
export const FRONTEND_DEV_PORT = 5173;

/**
 * LAN URL for the Vite dev server. Phones must use https so the camera is allowed.
 * @param {string} host
 */
export function frontendDevUrl(host) {
  return `https://${host}:${FRONTEND_DEV_PORT}`;
}

/**
 * Pull the LAN IPv4 and port from a backend startup log.
 * The backend prints `Network: http://192.168.x.x:PORT`.
 * @param {string} output
 * @returns {{ ip: string, port: string } | null}
 */
export function parseBackendNetworkAddress(output) {
  if (typeof output !== 'string' || !output) return null;
  const networkMatch = output.match(/Network:\s+http:\/\/([\d.]+):(\d+)/);
  if (!networkMatch) return null;
  return { ip: networkMatch[1], port: networkMatch[2] };
}

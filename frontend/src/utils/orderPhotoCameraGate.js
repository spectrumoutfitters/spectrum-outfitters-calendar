/**
 * Products.jsx order-photo camera host gate.
 * Distinct from BarcodeScannerModal (#126): 127.0.0.1 counts as localhost,
 * and protocol === 'https:' is treated as allowed (no isSecureContext check).
 */

export function isOrderPhotoCameraHostAllowed({ hostname, protocol } = {}) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || protocol === 'https:';
}

/**
 * Block only when getUserMedia is missing AND the host is not localhost/127/https.
 * When getUserMedia exists, the page still tries (current Products.jsx behavior).
 */
export function shouldBlockOrderPhotoCamera({ hostname, protocol, hasGetUserMedia } = {}) {
  if (hasGetUserMedia) return false;
  const isLocalhost =
    hostname === 'localhost' || hostname === '127.0.0.1' || protocol === 'https:';
  return !isLocalhost && protocol !== 'https:';
}

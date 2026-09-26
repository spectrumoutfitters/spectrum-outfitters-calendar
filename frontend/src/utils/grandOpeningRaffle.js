const DEFAULT_RAFFLE_ORIGIN = 'https://raffle.spectrumoutfitters.com';

/**
 * Staff grand-opening links. One trailing slash is removed so paths are not doubled.
 * A subpath on the origin is kept.
 */
export function raffleGrandOpeningUrls(origin) {
  const base = (origin || DEFAULT_RAFFLE_ORIGIN).replace(/\/$/, '');
  return {
    adminUrl: `${base}/admin/grand-opening`,
    publicEntryUrl: `${base}/e/grand-opening`,
    checkUrl: `${base}/api/event/grand-opening`,
  };
}

/**
 * The embedded raffle is live only when the event endpoint succeeds and returns an event.
 * A bare { ok: true } or an error status must stay in setup.
 */
export function raffleEventIsLive(responseOk, data) {
  return Boolean(responseOk && data?.ok === true && data?.event);
}

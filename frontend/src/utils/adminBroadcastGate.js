/** Client gate for POST /push/broadcast from the admin Broadcast modal. */

export function canSendBroadcast(title, body) {
  return Boolean(String(title || '').trim() && String(body || '').trim());
}

export function buildBroadcastPayload(title, body, target) {
  return {
    title: String(title || '').trim(),
    body: String(body || '').trim(),
    target,
  };
}

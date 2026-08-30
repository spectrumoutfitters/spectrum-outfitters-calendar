/**
 * Dashboard Assistant config coerce + force-sync targeting.
 * Distinct from dashboard-config auth (#89): this shapes the persisted payload
 * and which client ids are marked to pull. A bad coerce can wipe assistant
 * credentials for every client.
 * Kept free of fs/Express so unit tests need no disk.
 */

/**
 * Non-array items/categoryOrder become []. spectrumServer must be a truthy
 * object (arrays pass — typeof [] === 'object'). Falsy updatedAt uses nowIso.
 */
export function coerceDashboardConfigPayload(body, nowIso) {
  const updatedAt = body?.updatedAt || nowIso;
  return {
    items: Array.isArray(body?.items) ? body.items : [],
    categoryOrder: Array.isArray(body?.categoryOrder) ? body.categoryOrder : [],
    spectrumServer:
      body?.spectrumServer && typeof body.spectrumServer === 'object' ? body.spectrumServer : null,
    updatedAt,
  };
}

/**
 * Trimmed clientId targets one client (no duplicate). Empty/whitespace targets
 * everyone: stamps forceSyncRequestedAt and unions all known client ids.
 */
export function applyForceSyncRequest(state, clientIdRaw, nowIso) {
  const clientId = (clientIdRaw || '').toString().trim();
  const forceSyncClientIds = Array.isArray(state?.forceSyncClientIds)
    ? [...state.forceSyncClientIds]
    : [];
  let forceSyncRequestedAt = state?.forceSyncRequestedAt ?? null;

  if (clientId) {
    if (!forceSyncClientIds.includes(clientId)) forceSyncClientIds.push(clientId);
  } else {
    forceSyncRequestedAt = nowIso;
    for (const id of Object.keys(state?.clients || {})) {
      if (!forceSyncClientIds.includes(id)) forceSyncClientIds.push(id);
    }
  }

  return {
    forceSyncClientIds,
    forceSyncRequestedAt,
    forClientId: clientId || null,
  };
}

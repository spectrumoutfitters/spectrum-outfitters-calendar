/**
 * Admin event-config panel coercion (load/save hydration).
 * Distinct from API-route `adminEventConfigGate` (#104), which only
 * rejects a missing x-admin-key and coerces non-array raffles to [].
 *
 * These clamps run before Apps Script save and on every GET hydrate:
 * zero-ish ticket fields fall back to defaults (0 max-per-purchase → 100),
 * inactive raffle flags treat sheet "FALSE" as off, and sortOrder 0 is
 * treated as missing on save (`sortOrder || index + 1`).
 */

export function coerceAdminEventFields(ev) {
  const src = ev || {};
  return {
    name: String(src.name ?? ''),
    description: String(src.description ?? ''),
    logoUrl: String(src.logoUrl ?? ''),
    primaryColor: String(src.primaryColor ?? '#c9a227'),
    secondaryColor: String(src.secondaryColor ?? '#1a1a1a'),
    theme: src.theme === 'light' ? 'light' : 'dark',
    active: Boolean(src.active),
    defaultTestMode: Boolean(src.defaultTestMode),
    blockTestWrite: Boolean(src.blockTestWrite),
    bonusRulesJson: String(src.bonusRulesJson ?? ''),
    paidTicketsEnabled: Boolean(src.paidTicketsEnabled),
    ticketPriceCents: Math.max(0, Math.floor(Number(src.ticketPriceCents) || 0)),
    ticketCurrency: String(src.ticketCurrency ?? 'usd').toLowerCase().slice(0, 8) || 'usd',
    paidTicketsMaxPerPurchase: Math.max(1, Math.floor(Number(src.paidTicketsMaxPerPurchase) || 100)),
    baseTicketsPerEntry: Math.max(1, Math.floor(Number(src.baseTicketsPerEntry) || 2)),
    newsletterBonusEnabled: src.newsletterBonusEnabled !== false,
    newsletterBonusTickets: Math.max(0, Math.floor(Number(src.newsletterBonusTickets) || 0)),
  };
}

/** Sheet/sqlite may send boolean false or the string "FALSE". */
export function isAdminRaffleActive(active) {
  return active !== false && String(active).toUpperCase() !== 'FALSE';
}

/**
 * @param {object} r
 * @param {() => string} [newClientListKey]
 */
export function normalizeAdminRaffleRow(r, newClientListKey) {
  const src = r || {};
  const id = String(src.raffleId || src.id || '').trim() || 'new-prize';
  const existingKey =
    typeof src._clientListKey === 'string' && src._clientListKey.length > 0
      ? src._clientListKey
      : '';
  const makeKey = typeof newClientListKey === 'function' ? newClientListKey : () => '';
  return {
    id,
    raffleId: id,
    title: String(src.title || ''),
    subtitle: String(src.subtitle || ''),
    imageUrl: String(src.imageUrl || '').trim(),
    valueLabel: String(src.valueLabel ?? '').trim().slice(0, 160),
    sortOrder: Number.isFinite(Number(src.sortOrder)) ? Number(src.sortOrder) : 0,
    active: isAdminRaffleActive(src.active),
    drawAt: String(src.drawAt ?? '').trim().slice(0, 50),
    _clientListKey: existingKey || makeKey(),
  };
}

/** Empty raffle lists get a local grand-prize row so the editor is never blank. */
export function ensureAdminRaffleRows(rows, newClientListKey) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length) return list;
  return [
    normalizeAdminRaffleRow(
      { raffleId: 'grand-prize', title: 'Grand prize', sortOrder: 1 },
      newClientListKey,
    ),
  ];
}

/** PUT body raffles[] — sortOrder 0/NaN falls back to 1-based index. */
export function serializeAdminRafflesForSave(raffles) {
  return (raffles || []).map((r, i) => ({
    raffleId: String(r.raffleId ?? '').trim() || String(r.id ?? '').trim(),
    title: String(r.title ?? '').trim(),
    subtitle: r.subtitle,
    imageUrl: String(r.imageUrl ?? '').trim(),
    valueLabel: String(r.valueLabel ?? '').trim().slice(0, 160),
    sortOrder: r.sortOrder || i + 1,
    active: r.active,
    drawAt: String(r.drawAt ?? '').trim().slice(0, 50),
  }));
}

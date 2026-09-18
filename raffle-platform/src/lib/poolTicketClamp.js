/** Integer ticket count clamp for the paid-ticket pool field. */

export function clampPoolTicketCount(n, max) {
  const ceiling = Number.isFinite(Number(max)) ? Number(max) : 0;
  const raw = Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.min(ceiling, Math.floor(raw)));
}

export function parsePoolTicketText(text) {
  if (text === '' || text == null) return 0;
  const n = parseInt(String(text), 10);
  return Number.isFinite(n) ? n : 0;
}

export function digitsOnlyTicketText(value) {
  return String(value ?? '').replace(/\D/g, '');
}

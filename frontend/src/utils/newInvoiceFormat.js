/**
 * New Invoice customer/vehicle field normalize (on blur / create).
 *
 * titleCase: trim → lower → whitespace-split → capitalize first char only
 * (does not title-case hyphenated or apostrophe parts). Distinct from
 * backend helpers.toTitleCase (`\b\w` word-boundary).
 *
 * formatPhoneUS: digits-only; <7 keep original; 10 → (xxx) xxx-xxxx;
 * 11 starting with 1 → +1 (...); otherwise keep original (7–9, 11 not-1, 12+).
 */

export function titleCase(input) {
  const s = String(input || '').trim();
  if (!s) return '';
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

export function digitsOnly(s) {
  return String(s || '').replace(/\D+/g, '');
}

export function formatPhoneUS(s) {
  const d = digitsOnly(s);
  if (d.length < 7) return String(s || '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d.startsWith('1')) return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return String(s || '');
}

export function vehicleLabel(v) {
  const label = [v?.year, v?.make, v?.model].filter(Boolean).join(' ');
  return label || v?.vin || v?.license_plate || '—';
}

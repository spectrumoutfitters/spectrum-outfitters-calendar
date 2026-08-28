/**
 * Test-mode raffle rows are excluded from official draws, but they used to
 * occupy the one-per-phone slot. Anyone can POST testMode:true (or use ?test=1)
 * and lock a phone out of the real raffle.
 *
 * Keep in sync with raffle-platform/google-apps-script/Code.gs:
 *   isTestModeFlag_ / rowOccupiesPhoneSlot_ / resolveUpdateTestMode_
 */

export function isTestModeFlag(value) {
  if (value === true || value === 1) return true;
  const s = String(value ?? '').trim().toUpperCase();
  return s === 'TRUE' || s === '1' || s === 'YES';
}

/** Official (non-test) rows occupy the uniqueness slot; test rows do not. */
export function rowOccupiesPhoneSlot(rowIsTest) {
  return !rowIsTest;
}

/**
 * Whether existing sheet rows should block a new submission for this phone.
 * rows: { slug, phoneNorm, isTest }[]
 */
export function phoneTakenForOfficialEntry(rows, slug, phoneNorm) {
  const wantSlug = String(slug || '');
  const wantPhone = String(phoneNorm || '');
  if (!wantSlug || !wantPhone) return false;
  for (const row of rows || []) {
    if (String(row.slug || '') !== wantSlug) continue;
    if (String(row.phoneNorm || '') !== wantPhone) continue;
    if (rowOccupiesPhoneSlot(isTestModeFlag(row.isTest))) return true;
  }
  return false;
}

/**
 * Manage-entry must not flip real tickets into test (or demote test tickets
 * to real) based on a client ?test=1 flag. Event-wide defaultTestMode still wins.
 */
export function resolveUpdateTestMode({ existingRowsAreAllTest, eventDefaultTestMode }) {
  if (isTestModeFlag(eventDefaultTestMode)) return true;
  return !!existingRowsAreAllTest;
}

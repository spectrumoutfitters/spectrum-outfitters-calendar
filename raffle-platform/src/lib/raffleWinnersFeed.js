/**
 * Pure helpers mirroring Apps Script public winners feed + draw test-row filters.
 * Kept in sync with raffle-platform/google-apps-script/Code.gs
 * (handleGetPublicWinnersFeedGet_, handleDrawWinner_ pool filter).
 */

/** Sheets cells store isTest as TRUE/FALSE strings or booleans. */
export function isTestCell(value) {
  return String(value || '').toUpperCase() === 'TRUE' || value === true;
}

/**
 * Resolve Winners sheet column indexes from an optional header row.
 * Fallback positions match Code.gs defaults when headers are missing/partial.
 */
export function resolveWinnersColMap(headerRow) {
  const defaults = {
    drawId: 0,
    timestamp: 1,
    slug: 2,
    raffleId: 3,
    winnerName: 4,
    ticketsInPool: 7,
    isTest: 8,
  };

  if (!Array.isArray(headerRow) || !headerRow.length) return { ...defaults };

  const hasHeader =
    String(headerRow[0] || '')
      .trim()
      .toLowerCase() === 'drawid';
  if (!hasHeader) return { ...defaults };

  const idx = (name) => {
    const want = String(name).toLowerCase();
    for (let c = 0; c < headerRow.length; c++) {
      if (
        String(headerRow[c] || '')
          .trim()
          .toLowerCase() === want
      ) {
        return c;
      }
    }
    return -1;
  };

  const pick = (name, fallback) => {
    const i = idx(name);
    return i < 0 ? fallback : i;
  };

  return {
    drawId: pick('drawId', defaults.drawId),
    timestamp: pick('timestamp', defaults.timestamp),
    slug: pick('slug', defaults.slug),
    raffleId: pick('raffleId', defaults.raffleId),
    winnerName: pick('winnerName', defaults.winnerName),
    ticketsInPool: pick('ticketsInPool', defaults.ticketsInPool),
    isTest: pick('isTest', defaults.isTest),
  };
}

/**
 * Project public live-board winners for a slug (no phone/email).
 * Skips test draws, empty drawIds, and other slugs; sorts newest first; caps at limit.
 *
 * @param {unknown[][]} values Full sheet values (optional header row)
 * @param {string} slug
 * @param {Record<string, string>} [titleById]
 * @param {number} [limit=15]
 */
export function projectPublicWinnersFeed(values, slug, titleById = {}, limit = 15) {
  if (!Array.isArray(values) || !values.length) return [];

  const hasHeader =
    String(values[0][0] || '')
      .trim()
      .toLowerCase() === 'drawid';
  const cols = resolveWinnersColMap(hasHeader ? values[0] : null);
  const startR = hasHeader ? 1 : 0;
  const wantSlug = String(slug || '').trim();
  const rawRows = [];

  for (let r = startR; r < values.length; r++) {
    const row = values[r];
    if (!row) continue;
    if (String(row[cols.slug] || '').trim() !== wantSlug) continue;
    if (isTestCell(row[cols.isTest])) continue;

    const drawId = String(row[cols.drawId] || '').trim();
    if (!drawId) continue;

    const tsVal = row[cols.timestamp];
    let drewAtMs =
      tsVal instanceof Date ? tsVal.getTime() : new Date(tsVal).getTime();
    if (Number.isNaN(drewAtMs)) drewAtMs = 0;

    const rid = String(row[cols.raffleId] || '').trim();
    const ticketsInPool = Math.max(0, Math.floor(Number(row[cols.ticketsInPool]) || 0));
    rawRows.push({
      drawId,
      drewAtMs,
      raffleId: rid,
      raffleTitle: titleById[rid] || rid,
      winnerName: String(row[cols.winnerName] || '').trim(),
      ticketsInPool,
    });
  }

  rawRows.sort((a, b) => b.drewAtMs - a.drewAtMs);

  const out = [];
  for (let k = 0; k < rawRows.length && k < limit; k++) {
    const x = rawRows[k];
    out.push({
      drawId: x.drawId,
      drewAt: x.drewAtMs ? new Date(x.drewAtMs).toISOString() : null,
      raffleId: x.raffleId,
      raffleTitle: x.raffleTitle,
      winnerName: x.winnerName,
      ticketsInPool: x.ticketsInPool,
    });
  }
  return out;
}

/**
 * Filter Entries rows for a draw pool by testModeOnly (column 10 = isTest).
 * Entries layout: [ts, slug, name, phone, email, raffleId, ..., tickets, isTest, ...]
 */
export function entryPassesDrawTestFilter(isTestValue, testModeOnly) {
  const isTest = isTestCell(isTestValue);
  if (testModeOnly && !isTest) return false;
  if (!testModeOnly && isTest) return false;
  return true;
}

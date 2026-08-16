/**
 * Mirrors raffle-platform/google-apps-script/Code.gs handleUpdateEntryByToken_
 * split-plan gate. Editable sheet rows must not be deleted unless this returns { ok: true }.
 *
 * Production writes still happen in Apps Script; this helper locks the pre-delete decision
 * so manage-entry cannot drop free/newsletter tickets when the client split is short.
 */

export function freeTicketsForManageUpdate({
  bonusTickets,
  newsletterOptIn,
  newsletterBonusTickets,
}) {
  const bonuses = Math.max(0, Number(bonusTickets) || 0);
  const nl =
    newsletterOptIn === true
      ? Math.max(0, Math.floor(Number(newsletterBonusTickets) || 0))
      : 0;
  return bonuses + nl;
}

/**
 * @param {object} input
 * @param {'single'|'split'} input.ticketMode
 * @param {string[]} input.raffleIds active pool ids
 * @param {string[]|null} [input.splitRaffleIds]
 * @param {boolean} [input.splitEvenly]
 * @param {Record<string, number>|null} [input.ticketSplit]
 * @param {number} input.totalEntries free tickets including preserved newsletter bonus
 * @returns {{ ok: true, plan?: object } | { ok: false, error: string, code: string }}
 */
export function evaluateManageEntrySplitPlan(input) {
  const ticketMode = String(input?.ticketMode || 'single');
  if (ticketMode !== 'split') return { ok: true };

  try {
    const plan = buildTicketSplitPlan({
      raffleIds: input.raffleIds || [],
      splitRaffleIds: input.splitRaffleIds,
      splitEvenly: input.splitEvenly,
      ticketSplit: input.ticketSplit,
      totalEntries: input.totalEntries,
    });
    if (!plan || !plan.rows.length) {
      return { ok: false, error: 'Could not build ticket split.', code: 'split' };
    }
    if (!plan.rows.some((row) => row.weight > 0)) {
      return { ok: false, error: 'No ticket weight in split — check pools.', code: 'split' };
    }
    return { ok: true, plan };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), code: 'split' };
  }
}

/** Same rules as Code.gs buildTicketSplitPlan_. */
export function buildTicketSplitPlan({
  raffleIds,
  splitRaffleIds,
  splitEvenly,
  ticketSplit,
  totalEntries,
}) {
  const allIds = (raffleIds || []).map((id) => String(id || '').trim()).filter(Boolean);
  if (!allIds.length) return null;

  let targetIds = [];
  const rawSplit = splitRaffleIds;
  if (Array.isArray(rawSplit) && rawSplit.length) {
    const seen = {};
    for (const raw of rawSplit) {
      const rid = String(raw || '').trim();
      if (!rid || seen[rid]) continue;
      if (!allIds.includes(rid)) {
        throw new Error('Invalid pool in selection: ' + rid);
      }
      seen[rid] = true;
      targetIds.push(rid);
    }
  } else {
    targetIds = allIds.slice();
  }

  if (targetIds.length < 2) {
    throw new Error('Split needs at least two prize pools — use single-pool entry for one pool.');
  }

  const explicitCustom =
    (!Array.isArray(rawSplit) || !rawSplit.length) &&
    splitEvenly === false &&
    ticketSplit &&
    typeof ticketSplit === 'object';

  if (!explicitCustom) {
    const n = targetIds.length;
    const rowsE = [];
    let acc = 0;
    for (let j = 0; j < n; j++) {
      let wj;
      if (j === n - 1) {
        wj = totalEntries - acc;
      } else {
        wj = totalEntries / n;
        acc += wj;
      }
      rowsE.push({ raffleId: targetIds[j], weight: wj });
    }
    return { rows: rowsE, evenly: true, poolIds: targetIds.slice() };
  }

  const raw = ticketSplit || {};
  const rowsC = [];
  let sum = 0;
  for (const id of allIds) {
    let w = Number(raw[id]);
    if (!(w >= 0) || Number.isNaN(w)) w = 0;
    rowsC.push({ raffleId: id, weight: w });
    sum += w;
  }
  const tol = Math.max(1e-6, 1e-4 * Math.max(1, totalEntries));
  if (Math.abs(sum - totalEntries) > tol) {
    throw new Error('Pool tickets must add up to your total (' + String(totalEntries) + ').');
  }
  const hasAny = rowsC.some((row) => row.weight > 0);
  if (!hasAny) return null;
  return {
    rows: rowsC,
    evenly: false,
    poolIds: rowsC.filter((row) => row.weight > 0).map((row) => row.raffleId),
  };
}

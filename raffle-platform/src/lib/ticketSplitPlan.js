/**
 * Pure ticket split planner mirroring Apps Script buildTicketSplitPlan_.
 * Kept in sync with raffle-platform/google-apps-script/Code.gs.
 */

/**
 * @param {{ splitRaffleIds?: string[], splitEvenly?: boolean, ticketSplit?: Record<string, number> }} p
 * @param {{ id: string }[]} raffles Active pools
 * @param {number} totalEntries
 * @returns {null|{ rows: {raffleId: string, weight: number}[], evenly: boolean, poolIds: string[] }}
 */
export function buildTicketSplitPlan(p, raffles, totalEntries) {
  const allIds = [];
  for (let i = 0; i < raffles.length; i++) allIds.push(raffles[i].id);
  if (!allIds.length) return null;

  let targetIds = [];
  const rawSplit = p?.splitRaffleIds;
  if (Array.isArray(rawSplit) && rawSplit.length) {
    const seenPick = {};
    for (let si = 0; si < rawSplit.length; si++) {
      const rid = String(rawSplit[si] || '').trim();
      if (!rid || seenPick[rid]) continue;
      let foundR = false;
      for (let t = 0; t < raffles.length; t++) {
        if (raffles[t].id === rid) {
          foundR = true;
          break;
        }
      }
      if (!foundR) throw new Error('Invalid pool in selection: ' + rid);
      seenPick[rid] = true;
      targetIds.push(rid);
    }
  } else {
    targetIds = allIds.slice();
  }

  if (targetIds.length < 2) {
    throw new Error(
      'Split needs at least two prize pools — use single-pool entry for one pool.'
    );
  }

  const explicitCustom =
    (!Array.isArray(rawSplit) || !rawSplit.length) &&
    p.splitEvenly === false &&
    p.ticketSplit &&
    typeof p.ticketSplit === 'object';

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

  const raw = p.ticketSplit || {};
  const rowsC = [];
  let sum = 0;
  for (let k = 0; k < allIds.length; k++) {
    const id = allIds[k];
    let w = Number(raw[id]);
    if (!(w >= 0) || Number.isNaN(w)) w = 0;
    rowsC.push({ raffleId: id, weight: w });
    sum += w;
  }
  const tol = Math.max(1e-6, 1e-4 * Math.max(1, totalEntries));
  if (Math.abs(sum - totalEntries) > tol) {
    throw new Error(
      'Pool tickets must add up to your total (' + String(totalEntries) + ').'
    );
  }
  let hasAny = false;
  for (let h = 0; h < rowsC.length; h++) {
    if (rowsC[h].weight > 0) hasAny = true;
  }
  if (!hasAny) return null;
  const poolIdsC = [];
  for (let pc = 0; pc < rowsC.length; pc++) {
    if (rowsC[pc].weight > 0) poolIdsC.push(rowsC[pc].raffleId);
  }
  return { rows: rowsC, evenly: false, poolIds: poolIdsC };
}

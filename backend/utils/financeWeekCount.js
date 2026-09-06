/**
 * Cash-flow / forecast week-window coercion.
 * Preserves `parseInt(raw) || fallback` — no min/max clamp.
 *
 * Falsy after parseInt (NaN, 0, '') falls back. Negatives and huge values
 * are kept (a negative week count makes the week loop a no-op; a huge count
 * hammers the DB). Distinct from #84 dailyRevenueMerge / #76 compliance periods.
 */

export const CASH_FLOW_WEEKS_DEFAULT = 12;
export const FORECAST_HISTORY_DEFAULT = 12;
export const FORECAST_PROJECT_DEFAULT = 8;

export function parseFinanceWeekCount(raw, fallback) {
  return parseInt(raw) || fallback;
}

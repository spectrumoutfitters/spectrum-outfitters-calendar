/**
 * Houston TX sales-tax estimate used by ComplianceCenter when taxable
 * sales change. Distinct from compliance due-date / days-until (#61/#80)
 * and P&L week math (#84).
 *
 * `parseFloat || 0` then `toFixed(2)` — non-numeric input becomes `0.00`.
 * Do not switch to Number() without checking NaN/`null` edges.
 */
export const HOUSTON_TX_SALES_TAX_RATE = 0.0825;

export function estimatedHoustonSalesTax(taxableSales) {
  const taxable = parseFloat(taxableSales) || 0;
  return (taxable * HOUSTON_TX_SALES_TAX_RATE).toFixed(2);
}

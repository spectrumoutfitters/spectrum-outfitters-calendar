/**
 * Valor Pay revenue sync: fetch transactions by date range, aggregate by day,
 * for daily income. Populates processor_daily_revenue with processor = 'valorpay'.
 *
 * API: Valor Pay Merchant API (Transaction List with Date Range).
 * Auth: appid, appkey, epi in request body.
 * Docs: https://valorapi.readme.io/reference/merchant-api-documentation
 */

const PROCESSOR_NAME = 'valorpay';

const DEFAULT_BASE_URL = 'https://securelink-staging.valorpaytech.com:4430';
// SecureLink uses query-param endpoints (e.g. ?saleapi=). Transaction list may be ?txnfetch= or ?transactionlist=
const TXN_LIST_QUERY = 'txnfetch';

function getBaseUrl() {
  return (process.env.VALOR_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
}

function getTxnListUrl() {
  if (process.env.VALOR_TXN_LIST_URL) {
    return process.env.VALOR_TXN_LIST_URL;
  }
  const base = getBaseUrl();
  return base.includes('?') ? `${base}&${TXN_LIST_QUERY}=` : `${base}/?${TXN_LIST_QUERY}=`;
}

function isValorPayDisabled() {
  const v = (process.env.VALOR_PAY_DISABLED || '').toString().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function isConfigured() {
  if (isValorPayDisabled()) return false;
  const appId = (process.env.VALOR_APP_ID || '').trim().replace(/^["']|["']$/g, '');
  const appKey = (process.env.VALOR_APP_KEY || '').trim().replace(/^["']|["']$/g, '');
  return !!(appId && appKey);
}

/**
 * Fetch transactions from Valor Pay for a date range.
 * Tries common request/response shapes; adapt if Valor returns something different.
 *
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Promise<Array<{ amount: number, amount_refunded?: number, date: string, status: string, type?: string }>>}
 */
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function getValorPayTransactionsByDateRange(startDate, endDate) {
  if (!isConfigured()) return [];

  const url = getTxnListUrl();
  const appId = (process.env.VALOR_APP_ID || '').trim().replace(/^["']|["']$/g, '');
  const appKey = (process.env.VALOR_APP_KEY || '').trim().replace(/^["']|["']$/g, '');
  const today = new Date().toISOString().slice(0, 10);
  const endCap = endDate > today ? today : endDate;
  const toYYYYMMDD = (d) => d.replace(/-/g, '');
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear() % 100).padStart(2, '0');
  const mmyy = mm + yy;

  const epiRaw = (process.env.VALOR_EPI || '').trim().replace(/^["']|["']$/g, '');
  const epiNum = epiRaw && /^\d+$/.test(epiRaw) ? parseInt(epiRaw, 10) : null;

  const all = [];
  const limit = 100;
  const maxDaysPerRequest = 30;

  let chunkStart = startDate;
  while (chunkStart <= endCap) {
    const chunkEnd = addDays(chunkStart, maxDaysPerRequest - 1);
    const chunkEndCap = chunkEnd > endCap ? endCap : chunkEnd;
    const startStr = toYYYYMMDD(chunkStart);
    const endStr = toYYYYMMDD(chunkEndCap);

    const baseBody = {
      appid: appId,
      appkey: appKey,
      txn_type: 'sale',
      amount: 1,
      startDate: startStr,
      endDate: endStr,
      from_date: startStr,
      to_date: endStr,
      start_date: startStr,
      end_date: endStr,
      expirydate: mmyy,
      expiry_date: mmyy,
      shipping_country: 'US',
      billing_country: 'US',
      cardnumber: '4111111111111111',
      cvv: '999',
      limit,
      offset: 0,
    };
    if (epiRaw) {
      baseBody.epi = epiRaw;
      baseBody.EPI = epiRaw;
      baseBody.epi_id = epiNum !== null ? epiNum : epiRaw;
      baseBody.EPI_ID = epiNum !== null ? epiNum : epiRaw;
    }

    let offset = 0;
    let chunkDone = false;
    while (!chunkDone) {
      const body = { ...baseBody, offset };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      }).catch((err) => {
        console.warn('Valor Pay transaction list request failed:', err?.message || err);
        return null;
      });

      if (!res || !res.ok) {
        const text = res ? await res.text() : '';
        console.warn('Valor Pay transaction list error:', res?.status, url, text?.slice(0, 300));
        if (text && text.includes('E109') && text.includes('TOO MANY FAILED')) {
          console.warn('Valor Pay: Too many failed requests (E109). Wait at least 1 hour before clicking Sync again.');
          return all;
        }
        if (text && text.includes('INVALID EPI ID')) {
          console.warn('Valor Pay: EPI ID not accepted. Ask Valor Pay support for the correct EPI for txnfetch.');
        } else if (text && text.includes('INVALID EPI') && !text.includes('INVALID EPI ID')) {
          console.warn('Valor Pay: Set VALOR_EPI in backend/.env (from Valor Portal → API Keys).');
        }
        return all;
      }

      const data = await res.json().catch(() => ({}));
      const list =
        data?.data ??
        data?.transactions ??
        data?.transactionList ??
        data?.result ??
        data?.list ??
        data?.records ??
        (Array.isArray(data) ? data : []);
      const arr = Array.isArray(list) ? list : Object.values(list || {}).filter(Array.isArray).flat();
      for (const t of arr) all.push(t);
      if (arr.length < limit) chunkDone = true;
      else offset += limit;
    }

    chunkStart = addDays(chunkEndCap, 1);
    await new Promise((r) => setTimeout(r, 1500));
  }

  if (all.length === 0) {
    console.warn('Valor Pay sync: 0 transactions for', startDate, 'to', endCap, '| URL:', url);
  }
  return all;
}

/**
 * Normalize a single transaction for aggregation (amount in dollars, date YYYY-MM-DD, status, type).
 */
function normalizeTxn(t) {
  let date = t.date ?? t.transactionDate ?? t.created ?? t.createdAt ?? t.txn_date ?? t.sale_date ?? t.auth_date ?? '';
  if (typeof date === 'number') date = new Date(date * 1000).toISOString().slice(0, 10);
  if (date && date.length >= 10) date = date.slice(0, 10);
  else date = '';

  const status = (t.status ?? t.responseCode ?? t.result ?? t.response_code ?? t.approvalCode ?? '').toString().toLowerCase();
  const type = (t.type ?? t.txn_type ?? t.transactionType ?? t.tran_type ?? 'sale').toString().toLowerCase();

  let amount = parseFloat(t.amount ?? t.total ?? t.saleAmount ?? t.sale_amount ?? t.authAmount ?? t.auth_amount ?? 0) || 0;
  if (amount > 0 && amount < 100 && (t.amountCents != null || t.amount_cents != null)) {
    amount = (t.amountCents ?? t.amount_cents ?? 0) / 100;
  }
  const refund = parseFloat(t.refundAmount ?? t.amount_refunded ?? t.amountRefunded ?? 0) || 0;

  return { date, status, type, amount, refund };
}

/**
 * Aggregate Valor Pay transactions into daily totals. Counts approved sales; subtracts refunds.
 *
 * @param {Array} transactions - raw from getValorPayTransactionsByDateRange
 * @returns {Array<{ date: string, revenue: string, charge_count: number, refund_total: string }>}
 */
export function aggregateValorPayByDay(transactions) {
  const byDay = {};

  for (const t of transactions) {
    const n = normalizeTxn(t);
    if (!n.date) continue;

    const isApproved =
      n.status === 'approved' ||
      n.status === '00' ||
      n.status === '0' ||
      n.status === 'succeeded' ||
      n.status === 'complete' ||
      n.status === 'captured' ||
      n.status === 'y' ||
      n.status === 'yes' ||
      n.status === 'auth' ||
      n.status === 'closed' ||
      (n.status === '' && n.type === 'sale');
    const isRefund = n.type === 'refund' || n.type === 'refund_offset' || n.type === 'refundoffset';

    if (!byDay[n.date]) byDay[n.date] = { revenue: 0, charges: 0, refunds: 0 };

    if (isRefund) {
      byDay[n.date].refunds += n.amount || 0;
    } else if (isApproved) {
      byDay[n.date].revenue += n.amount || 0;
      byDay[n.date].charges += 1;
      if (n.refund > 0) byDay[n.date].refunds += n.refund;
    }
  }

  return Object.entries(byDay).map(([date, d]) => ({
    date,
    revenue: (d.revenue - d.refunds).toFixed(2),
    charge_count: d.charges,
    refund_total: d.refunds.toFixed(2),
  }));
}

export { PROCESSOR_NAME, isConfigured };

# Valor Pay – Daily Income Integration

Spectrum Outfitters uses **Valor Pay** as the payment processor. When you charge customers via Valor Pay, those transactions are synced into daily income and appear in cash flow, P&L, and forecasts.

## How it works

- **Sync**: The app calls Valor Pay’s **Transaction List (Date Range)** API with your App ID and App Key, then aggregates approved sales by day (minus refunds) into `processor_daily_revenue` (processor = `valorpay`).
- **Daily income rule**: For each day we use **one** source: Shop Monkey (if present) → **Valor Pay** (if present) → manual daily sales. We never add two sources for the same day.
- **Auto-sync**: When `VALOR_APP_ID` and `VALOR_APP_KEY` are set, the backend syncs the last 7 days every 5 minutes.

## Keys (from your Valor Pay keys file)

Configured in `backend/.env`:

| Env var | Description | Your value source |
|--------|-------------|--------------------|
| `VALOR_APP_ID` | Merchant App ID | App ID from keys file |
| `VALOR_APP_KEY` | API authentication | VL550 App Key (or VT App Key) from keys file |
| `VALOR_EPI` | Optional endpoint ID (10-digit, often starts with 2) | Valor Portal → Merchant Management → API Keys if required |
| `VALOR_API_BASE_URL` | Base URL for Valor API | Default: `https://securelink-staging.valorpaytech.com:4430` (use production URL when going live) |
| `VALOR_TXN_LIST_URL` | Optional full URL for transaction list | Only set if the transaction list endpoint is different from `{base}/api/valor/transaction-list` |

Keys contain special characters (`%`, `$`, `#`); in `.env` they are in double quotes.

## Valor Pay API references

- [Merchant API documentation](https://valorapi.readme.io/reference/merchant-api-documentation)
- [Transaction List with Date Range API](https://valorapi.readme.io/reference/transaction-list-with-date-range-api)
- Auth: `appid`, `appkey`, and optionally `epi` in the request body (JSON).

## If sync returns “0 days” or fails

1. **Check the server console** (where you run `node server.js` or `npm start`). You should see logs such as:
   - `Valor Pay transaction list error: 404 ...` → wrong URL; try setting `VALOR_TXN_LIST_URL` (see below).
   - `Valor Pay: no transaction array in response. Response keys: ...` → response shape is different; we can adapt parsing if you share the keys.
   - `Valor Pay sync: 0 transactions for YYYY-MM-DD to YYYY-MM-DD | URL: ...` → API returned no rows for that range (or wrong endpoint/auth).

2. **Transaction list URL**: The app calls `{VALOR_API_BASE_URL}/?txnfetch=` by default. If Valor’s docs give a different endpoint (e.g. `?transactionlist=` or a full path), set in `.env`:
   ```env
   VALOR_TXN_LIST_URL=https://securelink-staging.valorpaytech.com:4430/?transactionlist=
   ```
   Use the exact URL from Valor Pay’s “Transaction List with Date Range” API docs.

3. **EPI**: If the API returns “EPI required” or similar, get your EPI from Valor Portal (Merchant Management → Settings → API Keys) and set `VALOR_EPI` in `.env`.

4. **"INVALID EPI ID"**: If you use a Virtual Terminal EPI and the correct VT App Key but still get this error, contact Valor Pay support and ask which EPI to use for the **txnfetch (transaction list)** API, or whether transaction list needs to be enabled for your account. Some setups require a specific “reporting” or merchant-level EPI.
5. **Production**: For live transactions, switch `VALOR_API_BASE_URL` to the production base URL provided by Valor Pay.

## Finance UI

- Go to **Finance** → **Revenue**.
- The **Valor Pay** card shows last sync and totals; use **Sync Now** to pull history or refresh the last 7 days.

After a successful sync, Valor Pay revenue is used for daily income on days when Shop Monkey has no data and appears in cash flow and forecast.

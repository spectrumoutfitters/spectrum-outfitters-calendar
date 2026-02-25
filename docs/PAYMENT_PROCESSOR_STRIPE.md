# Payment Processor (Stripe) – Daily Income Integration

When you charge customers via **Stripe**, those charges can automatically populate daily income in Spectrum Outfitters so they appear in cash flow, P&L, and forecasts.

## How it works

- **Sync**: The app pulls successful Stripe charges by date range and aggregates them by day into `processor_daily_revenue`.
- **Daily income rule**: For each day, we use **one** source: Shop Monkey (if present) → **Stripe** (if present) → manual daily sales. We never add two sources for the same day.
- **Auto-sync**: If `STRIPE_SECRET_KEY` is set, the backend syncs the last 7 days every 5 minutes.
- **Webhook (optional)**: Stripe can send `charge.succeeded` / `charge.refunded` to our endpoint so we update that day’s total in near real time.

## Setup

### 1. Add API keys to `backend/.env`

```env
# Stripe (payment processor – daily income from charges)
STRIPE_SECRET_KEY=sk_live_xxxx
# Optional: for real-time updates when a charge happens (Stripe Dashboard → Developers → Webhooks)
STRIPE_WEBHOOK_SECRET=whsec_xxxx
```

- Get **Secret key** from [Stripe Dashboard](https://dashboard.stripe.com/apikeys) (use **Live** for production).
- For **Webhook signing secret**: in Stripe Dashboard → Developers → Webhooks → Add endpoint:
  - URL: `https://your-domain.com/api/payment-processor/webhook`
  - Events: `charge.succeeded`, `charge.captured`, `charge.refunded`

### 2. Install dependency and run migrations

From the project root (or `backend/`):

```bash
cd backend
npm install
```

Migrations run at server startup and create the `processor_daily_revenue` table if needed.

### 3. Sync from the app

- Go to **Finance** → **Revenue**.
- Use **Payment Processor (Stripe)** → **Sync Now** to pull all history (or rely on auto-sync for the last 7 days).

After sync, Stripe revenue is used for daily income on days when Shop Monkey has no data, and appears in cash flow and forecast.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/payment-processor/revenue/sync` | Admin | Sync Stripe charges into daily revenue (body: `start_date`, `end_date` optional). |
| GET | `/api/payment-processor/revenue/status` | User | Last sync time and recent daily totals. |
| POST | `/api/payment-processor/webhook` | None (Stripe signature) | Stripe webhook for real-time charge/refund updates. |

## Using a different processor (e.g. Square)

The same pattern can be used for Square or others: add a table or `processor` column, implement a sync that fetches payments and aggregates by day, and plug that source into the finance “one source per day” logic (e.g. after Shop Monkey, before manual).

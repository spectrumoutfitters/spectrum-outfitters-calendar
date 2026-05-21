# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Spectrum Outfitters is a monorepo with a **Node.js/Express backend** (port 5000) and a **React/Vite frontend** (port 5173). The database is file-based **SQLite** (`backend/database/shop_tasks.db`). No external services (Docker, Redis, Postgres) are needed for core dev.

### Starting the application

```bash
# From repo root — starts both backend + frontend concurrently
npm run dev

# Or individually:
npm run dev:backend   # Express on port 5000 (node --watch)
npm run dev:frontend  # Vite on port 5173 (HTTPS with self-signed cert)
```

### Database initialization

On a **fresh checkout** (no `backend/database/shop_tasks.db`), you must initialize the database before the backend will fully work:

```bash
cd backend && npm run init-db
```

This creates tables and seeds the default admin user (`admin` / `SpectrumAdmin2024!`).

**Important:** The `init-db` migration (`database/migrations.js`) only creates the base schema. Many route handlers expect additional columns/tables (e.g. `estimated_time_minutes` on `tasks`, `task_subtasks`, `task_assignments`, `task_breaks`, `inventory_items`, `messages`, `schedule_events`, etc.) that are added by standalone migration scripts in `backend/database/add_*.js`. The server's `database/startup.js` (`runStartupMigrations`) handles some of these idempotently at boot, but not all. If you hit `SQLITE_ERROR: no such table/column` errors, run the relevant `backend/database/add_*.js` script or add the column/table manually.

### Frontend HTTPS

Vite dev server generates a self-signed TLS certificate at startup. When testing in a browser, you must accept the certificate warning. API calls from the frontend proxy through Vite to `http://localhost:5000`.

### Lint / Test / Build

- **No dedicated lint or test scripts** exist for the main backend or frontend. The raffle-platform sub-app has `npm run lint` (`tsc --noEmit`).
- **Frontend build:** `cd frontend && npm run build` (Vite production build).
- The project has no automated test suite.

### Key environment variables

The backend requires a `backend/.env` file. Minimum required:

```
PORT=5000
JWT_SECRET=<32+ character random string>
DATABASE_PATH=./database/shop_tasks.db
NODE_ENV=development
```

See `docs/ENV_VARIABLES.md` for the full list. Optional integrations (Stripe, ShopMonkey, Google Calendar, Anthropic AI) require their own API keys but are not needed for core functionality.

### Sub-projects

| Directory | Description | Required for core dev |
|---|---|---|
| `backend/` | Express API + SQLite | Yes |
| `frontend/` | React + Vite SPA | Yes |
| `raffle-platform/` | Next.js raffle app | No |
| `launcher/` | Desktop launcher | No |
| `server-monitor/` | Electron health monitor | No |
| `mcp-server/` | MCP server for Cursor | No |

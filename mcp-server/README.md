# Spectrum MCP Server

MCP server for **Spectrum Outfitters Calendar**. Exposes API health, security sessions, login events, and deployment docs to Cursor so the AI can check server status and read docs.

## Tools

| Tool | Description |
|------|-------------|
| `spectrum_health` | Check API health (no auth). |
| `spectrum_active_sessions` | List active user sessions (admin token required). |
| `spectrum_login_events` | Recent login events with optional `limit` / `offset`. |
| `spectrum_security_stats` | Security overview: active sessions, logins today, failed logins. |

## Resources

| URI | Description |
|-----|-------------|
| `spectrum://docs/DEPLOYMENT` | Deployment guide (`docs/DEPLOYMENT.md`). |
| `spectrum://docs/GO_LIVE_CHECKLIST` | Go-live checklist (`docs/GO_LIVE_CHECKLIST.md`). |

## Setup

1. **Install**

   ```bash
   cd mcp-server
   npm install
   ```

2. **Environment**

   - `SPECTRUM_API_BASE_URL` — e.g. `https://login.spectrumoutfitters.com/api` (required for API tools).
   - `SPECTRUM_ADMIN_TOKEN` — Admin JWT from the web app (DevTools → Application → Local Storage → `token`). Required for sessions, login events, and security stats.
   - `SPECTRUM_PROJECT_ROOT` — Optional. Path to the Calendar repo root (for doc resources). Defaults to parent of `mcp-server`.

3. **Run locally** (stdio, for Cursor)

   ```bash
   node index.js
   ```

   Or from repo root:

   ```bash
   node mcp-server/index.js
   ```

## Cursor MCP configuration

Add the Spectrum MCP server in Cursor:

1. Open **Cursor Settings → MCP** (or **Features → MCP**).
2. Add a new server, for example:

   **Option A – Command (recommended)**

   - **Command:** `node`
   - **Args:** `C:\Users\pearl\Documents\Spectrum Outfitters\Applications\Spectrum Outfitters Calendar\mcp-server\index.js`  
     (use the full path to `mcp-server/index.js` on your machine)
   - **Env (optional):**
     - `SPECTRUM_API_BASE_URL` = `https://login.spectrumoutfitters.com/api`
     - `SPECTRUM_ADMIN_TOKEN` = *(paste your admin token)*

   **Option B – npx from repo root**

   - **Command:** `npx`
   - **Args:** `-y`, `node`, `mcp-server/index.js`
   - **Cwd:** `C:\Users\pearl\Documents\Spectrum Outfitters\Applications\Spectrum Outfitters Calendar`
   - **Env:** same as above.

   Use the **absolute path** to the Calendar project on your machine so Cursor can resolve it.

3. Save. After Cursor restarts or reconnects, you can ask the AI to:
   - “Check Spectrum API health”
   - “List active sessions on Spectrum”
   - “What does the deployment doc say about the database?”

## Security

- Do **not** commit `SPECTRUM_ADMIN_TOKEN`. Set it only in Cursor’s MCP server **env** or in a local `.env` that is in `.gitignore`.
- The server only **reads** from your API; it does not change data or deploy.

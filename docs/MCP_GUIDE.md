# Using MCP with Spectrum Outfitters Calendar

MCP (Model Context Protocol) lets Cursor’s AI use external tools and data. Here’s how to use it with this app.

---

## 1. Built-in MCP you can use now

### Browser (cursor-ide-browser)

If you have the **cursor-ide-browser** MCP server configured in Cursor:

- **Test the live app** – Ask the AI to open `https://login.spectrumoutfitters.com`, log in (if you provide test credentials), and check that key flows work (schedule, time clock, inventory, etc.).
- **Verify deploy** – After a deploy, ask it to open the site and confirm the new build or feature is visible.
- **UI checks** – “Click through Admin → Schedule and tell me if the calendar loads” or “Check dark mode on the login page.”

Use Cursor’s MCP settings to add the browser server if it’s not already there.

### Web fetch

Cursor can use **mcp_web_fetch** (or similar) to:

- Pull in external docs (e.g. deployment or API docs) when you ask about them.
- Check that a URL returns 200 or inspect a simple API response.

### Shell

With a **shell** MCP (or Cursor’s built-in terminal):

- Run `npm run build` in frontend/backend.
- Run `node scripts/deploy.cjs` (with appropriate caution and env).
- Run lint/tests from the project root.

The AI can run these when you ask (“run the deploy script” or “build the frontend”).

---

## 2. Spectrum MCP server (included)

The repo includes a **Spectrum MCP server** in `mcp-server/` that exposes your API and docs.

**Tools:** `spectrum_health`, `spectrum_active_sessions`, `spectrum_login_events`, `spectrum_security_stats`  
**Resources:** `spectrum://docs/DEPLOYMENT`, `spectrum://docs/GO_LIVE_CHECKLIST`

See **`mcp-server/README.md`** for setup and Cursor MCP configuration. You need:

- `SPECTRUM_API_BASE_URL` (e.g. `https://login.spectrumoutfitters.com/api`)
- `SPECTRUM_ADMIN_TOKEN` (from web app Local Storage) for sessions and security tools

---

## 3. Where to configure MCP in Cursor

- **Cursor Settings → MCP** (or “Features → MCP”): add or edit MCP servers.
- Each server has a **command** (e.g. `npx -y @anthropic-ai/mcp-server-browser`) and optionally **env** (e.g. `API_BASE_URL`, `ADMIN_TOKEN` for a custom server).
- For a custom Spectrum MCP server, use a **project-specific** config if available, and keep secrets in env only.

---

## 4. Safe use

- **Secrets:** Don’t put API tokens or SSH keys in prompts or in committed files. Use env vars or gitignored config for the MCP server.
- **Deploy tool:** If you add a “deploy” tool, use it only when you explicitly ask to deploy; consider a dry-run or confirmation step.
- **Server Monitor:** The Spectrum Server Monitor app (Electron) is separate from MCP; it’s for humans. MCP is for giving the AI in Cursor the same kind of visibility (health, sessions) and, optionally, controlled deploy.

---

## 5. Quick reference

| Goal | How with MCP |
|------|----------------|
| Test live app in browser | Use **cursor-ide-browser**; ask AI to open login.spectrumoutfitters.com and walk through flows. |
| Check API health / sessions | Use **Spectrum MCP** (`mcp-server/`) — tools `spectrum_health`, `spectrum_active_sessions`, `spectrum_security_stats`. |
| Run deploy from chat | Use **shell** (e.g. “run `node scripts/deploy.cjs`” from project root). |
| Use deployment docs in chat | Use **Spectrum MCP** resources `spectrum://docs/DEPLOYMENT` and `spectrum://docs/GO_LIVE_CHECKLIST`. |

/** Operator-facing copy for raffle admin stats/draw/export error codes. */
export function formatAdminApiError(code) {
  if (code === 'unauthorized') {
    return (
      'Admin key was rejected. Paste the exact value from your Google Sheet (Events row for this slug, column adminKey) — ' +
      'no extra spaces. If you just created a new Apps Script project, open it from Extensions → Apps Script on this spreadsheet so it stays bound to the same file.'
    );
  }
  if (code === 'apps_script_timeout') {
    return (
      'Google Apps Script took too long to respond (cold start or heavy sheet). Wait 30 seconds and reload. ' +
      'If this keeps happening, open the script from your spreadsheet and run a quick test, then try again.'
    );
  }
  if (code === 'server_misconfigured') {
    return (
      'The raffle server is missing APPS_SCRIPT_URL. That must be your Apps Script web app URL (starts with https://script.google.com/macros/s/ and ends with /exec)—not your Google Sheet link (docs.google.com/spreadsheets/…). ' +
      'From the sheet: Extensions → Apps Script → Deploy → Manage deployments → copy the Web app URL. ' +
      'On the droplet: put APPS_SCRIPT_URL=…/exec in /etc/spectrum-raffle.env, copy that file to /opt/spectrum-raffle/raffle-platform/.env.local, then pm2 restart spectrum-raffle. ' +
      'Or set GitHub secret RAFFLE_APPS_SCRIPT_URL and push main.'
    );
  }
  return code || 'Request failed';
}

/**
 * Win chance if one more ticket were added now (uniform over tickets in the drum).
 * `tickets <= 0` is an empty pool; avg tickets is 0 when people exist but tickets do not.
 */
export function rafflePoolOdds(tickets, people) {
  if (tickets <= 0) {
    return { oneIn: '—', pctLabel: 'No tickets yet', avgTickets: people > 0 ? '0' : '—' };
  }
  const pct = 100 / tickets;
  const pctLabel =
    pct >= 10 ? `~${pct.toFixed(0)}%` : pct >= 1 ? `~${pct.toFixed(1)}%` : `~${pct.toFixed(2)}%`;
  const avgTickets =
    people > 0 ? (tickets / people).toFixed(people > 5 ? 1 : 2) : tickets > 0 ? String(tickets) : '—';
  return {
    oneIn: `1 in ${tickets.toLocaleString()}`,
    pctLabel: `${pctLabel} per ticket`,
    avgTickets,
  };
}

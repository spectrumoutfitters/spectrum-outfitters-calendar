export function getAppsScriptUrl(): string | null {
  const url = process.env.APPS_SCRIPT_URL?.trim();
  return url && url.length > 0 ? url : null;
}

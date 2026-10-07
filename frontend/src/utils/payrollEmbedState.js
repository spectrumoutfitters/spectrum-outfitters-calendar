/** How long to wait before treating the payroll iframe as failed to load. */
export const PAYROLL_IFRAME_LOAD_TIMEOUT_MS = 12000;

/** Embedded payroll app. The access check must pass before this URL is shown. */
export const PAYROLL_IFRAME_SRC = '/payroll-system/index.html';

/**
 * Sensitive payroll UI. Fail closed while the access check is in flight,
 * when access is missing, or when that check returns an error.
 * @returns {'loading' | 'denied' | 'unavailable' | 'embed'}
 */
export function payrollPanelKind({ loading, hasAccess, error, iframeLoadFailed }) {
  if (loading) return 'loading';
  if (error || !hasAccess) return 'denied';
  if (iframeLoadFailed) return 'unavailable';
  return 'embed';
}

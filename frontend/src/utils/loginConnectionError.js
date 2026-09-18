/** Map raw login failures to operator-facing copy when the backend is unreachable. */

export function mapLoginConnectionError(error) {
  const msg = String(error || '');
  if (
    msg.includes('Cannot connect') ||
    msg.includes('ERR_CONNECTION_REFUSED') ||
    msg.includes('Network Error')
  ) {
    return 'Cannot connect to server. Please ensure the backend is running on port 5000.';
  }
  return error;
}

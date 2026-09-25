/**
 * Axios response-interceptor decisions for the shared API client.
 * Network failures are classified before 401/403 so a transport error
 * does not clear the session. 401 and 403 both force login unless the
 * browser is already on a path ending in `/login`.
 */

export const API_NETWORK_ERROR_MESSAGE =
  'Cannot connect to server. Please ensure the backend is running on port 5000.';

export function isApiNetworkError(error) {
  return error.code === 'ERR_NETWORK' ||
    error.code === 'ERR_EMPTY_RESPONSE' ||
    error.message.includes('Network Error') ||
    error.message.includes('ERR_CONNECTION_REFUSED') ||
    error.message.includes('Empty response');
}

export function apiFailureAction(error, pathname) {
  if (isApiNetworkError(error)) {
    return {
      type: 'network',
      clearToken: false,
      redirectToLogin: false,
      message: API_NETWORK_ERROR_MESSAGE,
    };
  }

  const status = error.response?.status;
  const onLogin = String(pathname || '').endsWith('/login');
  if ((status === 401 || status === 403) && !onLogin) {
    return {
      type: 'auth',
      clearToken: true,
      redirectToLogin: true,
      message: null,
    };
  }

  return {
    type: 'reject',
    clearToken: false,
    redirectToLogin: false,
    message: null,
  };
}

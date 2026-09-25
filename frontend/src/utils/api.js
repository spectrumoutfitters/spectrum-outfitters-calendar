import axios from 'axios';
import { apiFailureAction } from './apiFailure';
import { withBase } from './basePath';

// Use current hostname for API calls (works for localhost and network IP)
// Use relative path to leverage Vite proxy (which handles HTTPS->HTTP conversion)
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // With VITE_BASE_PATH (e.g. /so-app), API must be under that prefix so Vite proxy still hits /api on the dev server.
  return withBase('/api');
};

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const action = apiFailureAction(error, window.location.pathname);
    // Handle connection refused (backend not running) and empty responses.
    // Don't redirect on network errors, let the component handle it.
    if (action.type === 'network') {
      console.error('❌ Cannot connect to backend server. Is it running?');
      console.error('Backend should be running on http://localhost:5000');
      console.error('Error details:', error.code, error.message);
      return Promise.reject({
        ...error,
        isNetworkError: true,
        message: action.message,
      });
    }

    // Redirect to login on 401 (Unauthorized) or 403 (Forbidden) errors
    // 403 can mean invalid/expired token (should be 401 but some endpoints return 403)
    if (action.redirectToLogin) {
      localStorage.removeItem('token');
      window.location.href = withBase('/login');
    }
    return Promise.reject(error);
  }
);

export default api;


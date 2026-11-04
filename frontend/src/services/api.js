import axios from 'axios';

// Base API URL, overridable via Vite env. Falls back to the local backend.
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Backend origin (base URL without the trailing `/api`) used to build image URLs.
export const API_ORIGIN = BASE_URL.replace(/\/api\/?$/, '');

// Storage keys shared across the app.
export const TOKEN_KEY = 'swms_token';
export const USER_KEY = 'swms_user';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 20000
});

// Attach the bearer token to every outgoing request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Clear the session and bounce to login on auth failures.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Build an absolute URL for a backend-hosted asset.
 * Relative paths like `/uploads/abc.jpg` are prefixed with `API_ORIGIN`.
 */
export function resolveImageUrl(path) {
  if (!path || typeof path !== 'string') return '';
  if (path.startsWith('http')) return path;
  return `${API_ORIGIN}${path}`;
}

// Pull a human-readable message from an axios error.
export function getErrorMessage(error) {
  return error?.response?.data?.message || error?.message || 'Something went wrong';
}

export default api;

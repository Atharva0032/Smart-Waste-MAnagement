import api from './api';

// POST /auth/register
export async function register(payload) {
  const { data } = await api.post('/auth/register', payload);
  return data;
}

// POST /auth/login
export async function login(payload) {
  const { data } = await api.post('/auth/login', payload);
  return data;
}

// GET /auth/me
export async function getMe() {
  const { data } = await api.get('/auth/me');
  return data;
}

// PUT /auth/profile
export async function updateProfile(payload) {
  const { data } = await api.put('/auth/profile', payload);
  return data;
}

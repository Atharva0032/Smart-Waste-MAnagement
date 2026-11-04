import api from './api';

// GET /admin/stats
export async function getStats() {
  const { data } = await api.get('/admin/stats');
  return data;
}

// GET /admin/complaints?status=&area=&wasteType=&search=&page=&limit=
export async function getComplaints(params = {}) {
  const { data } = await api.get('/admin/complaints', { params });
  return data;
}

// PUT /admin/complaints/:id/assign
export async function assignComplaint(id, workerId) {
  const { data } = await api.put(`/admin/complaints/${id}/assign`, { workerId });
  return data;
}

// PUT /admin/complaints/:id/status
export async function updateComplaintStatus(id, status, note) {
  const { data } = await api.put(`/admin/complaints/${id}/status`, { status, note });
  return data;
}

// DELETE /admin/complaints/:id
export async function deleteComplaint(id) {
  const { data } = await api.delete(`/admin/complaints/${id}`);
  return data;
}

// GET /admin/workers
export async function getWorkers() {
  const { data } = await api.get('/admin/workers');
  return data;
}

// POST /admin/workers
export async function createWorker(payload) {
  const { data } = await api.post('/admin/workers', payload);
  return data;
}

// PUT /admin/workers/:id
export async function updateWorker(id, payload) {
  const { data } = await api.put(`/admin/workers/${id}`, payload);
  return data;
}

// DELETE /admin/workers/:id
export async function deleteWorker(id) {
  const { data } = await api.delete(`/admin/workers/${id}`);
  return data;
}

// GET /admin/users
export async function getUsers() {
  const { data } = await api.get('/admin/users');
  return data;
}

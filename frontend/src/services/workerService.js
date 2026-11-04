import api from './api';

// GET /workers/assigned
export async function getAssigned() {
  const { data } = await api.get('/workers/assigned');
  return data;
}

// GET /workers/complaints/:id
export async function getComplaint(id) {
  const { data } = await api.get(`/workers/complaints/${id}`);
  return data;
}

// PUT /workers/complaints/:id/status
export async function updateStatus(id, status, note) {
  const { data } = await api.put(`/workers/complaints/${id}/status`, { status, note });
  return data;
}

/**
 * Resolve a complaint with a completion photo (multipart).
 * `onProgress(percent)` is called during upload when provided.
 */
export async function resolveComplaint(id, formData, onProgress) {
  const config = {};
  if (typeof onProgress === 'function') {
    config.onUploadProgress = (event) => {
      if (event.total) {
        onProgress(Math.round((event.loaded * 100) / event.total));
      }
    };
  }
  const { data } = await api.put(`/workers/complaints/${id}/resolve`, formData, config);
  return data;
}

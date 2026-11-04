import api from './api';

/**
 * Create a complaint with a multipart payload.
 * `onProgress(percent)` is called during upload when provided.
 */
export async function createComplaint(formData, onProgress) {
  const config = {};
  if (typeof onProgress === 'function') {
    config.onUploadProgress = (event) => {
      if (event.total) {
        onProgress(Math.round((event.loaded * 100) / event.total));
      }
    };
  }
  const { data } = await api.post('/complaints', formData, config);
  return data;
}

// GET /complaints/my
export async function getMyComplaints() {
  const { data } = await api.get('/complaints/my');
  return data;
}

// GET /complaints/:id
export async function getComplaint(id) {
  const { data } = await api.get(`/complaints/${id}`);
  return data;
}

// GET /complaints/track/:trackingId (public, no auth required)
export async function trackComplaint(trackingId) {
  const { data } = await api.get(`/complaints/track/${trackingId}`);
  return data;
}

// DELETE /complaints/:id
export async function deleteComplaint(id) {
  const { data } = await api.delete(`/complaints/${id}`);
  return data;
}

// POST /ai/verify — send an image for AI waste classification.
export async function verifyImage(file) {
  const formData = new FormData();
  formData.append('image', file);
  const { data } = await api.post('/ai/verify', formData);
  return data;
}

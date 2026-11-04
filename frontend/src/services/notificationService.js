import api from './api';

// GET /notifications
export async function getNotifications() {
  const { data } = await api.get('/notifications');
  return data;
}

// PUT /notifications/:id/read
export async function markAsRead(id) {
  const { data } = await api.put(`/notifications/${id}/read`);
  return data;
}

// PUT /notifications/read-all
export async function markAllAsRead() {
  const { data } = await api.put('/notifications/read-all');
  return data;
}

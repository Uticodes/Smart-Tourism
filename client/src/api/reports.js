import api from './client.js';

/** fields: plain object; photos: File[]. Sent as multipart so the photos travel with the form. */
export function submitReport(fields, photos) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null && v !== '') form.append(k, String(v));
  photos.forEach((file) => form.append('photos', file));
  return api.post('/reports', form, { timeout: 60000 }).then((r) => r.data.report);
}

export const fetchMyReports = () => api.get('/reports/mine').then((r) => r.data.reports);
export const updateMyReport = (id, data) => api.put(`/reports/${id}`, data).then((r) => r.data.report);
export const fetchNearbyReports = (params) => api.get('/reports/nearby', { params }).then((r) => r.data.reports);
export const respondToReport = (id, data) => api.post(`/reports/${id}/responses`, data).then((r) => r.data.result);

export const adminListReports = (params) => api.get('/admin/reports', { params }).then((r) => r.data);
export const adminGetReport = (id) => api.get(`/admin/reports/${id}`).then((r) => r.data.report);
export const adminDecideReport = (id, data) => api.patch(`/admin/reports/${id}`, data).then((r) => r.data.report);

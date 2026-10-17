import api from './client.js';

export const adminListAttractions = (params) => api.get('/admin/attractions', { params }).then((r) => r.data.attractions);
export const adminGetAttraction = (id) => api.get(`/admin/attractions/${id}`).then((r) => r.data.attraction);
export const adminCreateAttraction = (data) => api.post('/admin/attractions', data).then((r) => r.data.attraction);
export const adminUpdateAttraction = (id, data) => api.put(`/admin/attractions/${id}`, data).then((r) => r.data.attraction);
export const adminDeactivateAttraction = (id) => api.delete(`/admin/attractions/${id}`).then((r) => r.data.attraction);

export const adminListCategories = () => api.get('/admin/categories').then((r) => r.data.categories);
export const adminCreateCategory = (data) => api.post('/admin/categories', data).then((r) => r.data.categories);
export const adminUpdateCategory = (id, data) => api.put(`/admin/categories/${id}`, data).then((r) => r.data.categories);
export const adminDeleteCategory = (id) => api.delete(`/admin/categories/${id}`).then((r) => r.data.categories);

export const adminAnalytics = (range) => api.get('/admin/analytics', { params: { range } }).then((r) => r.data);

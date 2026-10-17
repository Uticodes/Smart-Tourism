import api from './client.js';

const base = (id) => `/attractions/${id}/reviews`;
export const fetchReviews = (id) => api.get(base(id)).then((r) => r.data);
export const createReview = (id, data) => api.post(base(id), data).then((r) => r.data);
export const updateReview = (id, data) => api.put(`${base(id)}/mine`, data).then((r) => r.data);
export const deleteReview = (id) => api.delete(`${base(id)}/mine`).then((r) => r.data);

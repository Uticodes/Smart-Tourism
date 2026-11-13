import api from './client.js';

export const searchNearby = (params) => api.get('/attractions/nearby', { params }).then((r) => r.data);
export const fetchAttraction = (id) => api.get(`/attractions/${id}`).then((r) => r.data.attraction);
export const lookupPlaces = (q, signal) => api.get('/attractions/lookup', { params: { q }, signal }).then((r) => r.data.places || []);

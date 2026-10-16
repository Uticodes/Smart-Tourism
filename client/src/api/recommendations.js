import api from './client.js';

export const fetchRecommendations = (params) => api.get('/recommendations', { params }).then((r) => r.data);

/** Tells the server which result was opened and at what rank (MRR). Never blocks navigation. */
export function recordSelection({ search_id, attraction_id, rank }) {
  if (!search_id) return;
  api.post('/recommendations/selection', { search_id, attraction_id, rank }).catch(() => {});
}

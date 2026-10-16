import api from './client.js';

export const fetchCategories = () => api.get('/categories').then((r) => r.data.categories);
export const fetchPreferences = () => api.get('/users/me/preferences').then((r) => r.data.preferences);
export const savePreferences = (categoryIds) =>
  api.put('/users/me/preferences', { category_ids: categoryIds }).then((r) => r.data.preferences);

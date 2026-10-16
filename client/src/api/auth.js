import api from './client.js';

export const fetchMe = () => api.get('/auth/me').then((r) => r.data.user);
export const register = (data) => api.post('/auth/register', data).then((r) => r.data.user);
export const login = (data) => api.post('/auth/login', data).then((r) => r.data.user);
export const logout = () => api.post('/auth/logout');

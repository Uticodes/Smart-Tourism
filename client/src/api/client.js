import axios from 'axios';

// One Axios instance for the whole app. withCredentials sends the
// httpOnly auth cookie that the server sets on login.
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 15000,
});

/** Turns an Axios error into one sentence the user can act on. */
export function errorMessage(err) {
  if (err.response?.data?.error) return err.response.data.error;
  if (err.code === 'ECONNABORTED') return 'The server took too long to respond. Try again.';
  if (!err.response) return 'Cannot reach the server. Check that the API is running.';
  return 'Something went wrong. Try again.';
}

export default api;

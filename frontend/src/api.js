const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

/**
 * Universal request wrapper handling JWT injection and FastAPI error formats
 */
export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  const config = {
    ...options,
    headers,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);

  // Parse JSON or fallback to text
  let data;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    // Extract FastAPI detailed error messages
    let errorMessage = 'An error occurred. Please try again.';
    if (data && typeof data === 'object') {
      if (Array.isArray(data.detail)) {
        // FastAPI validation errors
        errorMessage = data.detail.map((err) => `${err.loc?.slice(1).join('.')}: ${err.msg}`).join(', ');
      } else if (typeof data.detail === 'string') {
        errorMessage = data.detail;
      } else if (data.message) {
        errorMessage = data.message;
      }
    } else if (typeof data === 'string' && data.length > 0) {
      errorMessage = data;
    }

    const error = new Error(errorMessage);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// Convenient HTTP methods
export const api = {
  get: (endpoint, options) => apiRequest(endpoint, { method: 'GET', ...options }),
  post: (endpoint, body, options) => apiRequest(endpoint, { method: 'POST', body, ...options }),
  patch: (endpoint, body, options) => apiRequest(endpoint, { method: 'PATCH', body, ...options }),
  delete: (endpoint, options) => apiRequest(endpoint, { method: 'DELETE', ...options }),
};

// Auth API Endpoints
export const authApi = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  getMe: () => api.get('/auth/me'),
  updateProfile: (profileData) => api.patch('/auth/me', profileData),
  changePassword: (passwords) => api.post('/auth/change-password', passwords),
};

// Bookings API Endpoints
export const bookingsApi = {
  getToday: (params) => api.get(`/bookings/today${params ? '?' + new URLSearchParams(params).toString() : ''}`),
  list: (params) => api.get(`/bookings${params ? '?' + new URLSearchParams(params).toString() : ''}`),
  getMyBookings: (params) =>
    api.get(`/bookings?my_bookings=true${params ? '&' + new URLSearchParams(params).toString() : ''}`),
  create: (data) => api.post('/bookings', data),
  getById: (id) => api.get(`/bookings/${id}`),
  cancel: (id) => api.delete(`/bookings/${id}`),
  requestCancel: (id, reason) => api.post(`/bookings/${id}/cancel-request`, { reason }),
  reviewCancel: (id, action, admin_notes) => api.post(`/bookings/${id}/cancel-review`, { action, admin_notes }),
  getPendingCancellations: () => api.get('/bookings/cancellations/pending'),
};

// Notifications API Endpoints
export const notificationsApi = {
  list: (params) => api.get(`/notifications/my${params ? '?' + new URLSearchParams(params).toString() : ''}`),
  markAsRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.post('/notifications/read-all'),
  clearAll: () => api.delete('/notifications/clear-all'),
  delete: (id) => api.delete(`/notifications/${id}`),
};

// Rooms API Endpoints
export const roomsApi = {
  list: (params) => api.get(`/rooms${params ? '?' + new URLSearchParams(params).toString() : ''}`),
  getById: (id) => api.get(`/rooms/${id}`),
  create: (data) => api.post('/rooms', data),
  update: (id, data) => api.patch(`/rooms/${id}`, data),
  delete: (id) => api.delete(`/rooms/${id}`),
};

// Users API Endpoints
export const usersApi = {
  list: (params) => api.get(`/users${params ? '?' + new URLSearchParams(params).toString() : ''}`),
  updateRoles: (id, payload) =>
    api.patch(`/users/${id}/roles`, Array.isArray(payload) ? { roles: payload } : payload),
  delete: (id) => api.delete(`/users/${id}`),
};

// Issues API Endpoints
export const issuesApi = {
  listAll: (params) => api.get(`/rooms/issues/all${params ? '?' + new URLSearchParams(params).toString() : ''}`),
  update: (id, data) => api.patch(`/rooms/issues/${id}`, data),
  delete: (id) => api.delete(`/rooms/issues/${id}`),
  create: (roomId, data) => api.post(`/rooms/${roomId}/issues`, data),
  listForRoom: (roomId) => api.get(`/rooms/${roomId}/issues`),
};

export default api;

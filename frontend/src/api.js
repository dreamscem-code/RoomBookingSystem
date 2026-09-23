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

// Lightweight In-Memory RAM Cache with TTL
const _apiCache = new Map();

export function getCached(key, maxAgeMs = 180000) {
  const item = _apiCache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > maxAgeMs) {
    _apiCache.delete(key);
    return null;
  }
  return item.data;
}

export function setCached(key, data) {
  _apiCache.set(key, { data, timestamp: Date.now() });
}

export function invalidateCache(prefix) {
  if (!prefix) {
    _apiCache.clear();
    return;
  }
  for (const key of _apiCache.keys()) {
    if (key.startsWith(prefix)) {
      _apiCache.delete(key);
    }
  }
}

// Bookings API Endpoints with Caching & Auto-Invalidation
export const bookingsApi = {
  getToday: async (params, useCache = true) => {
    const cacheKey = params ? `bookings_today_${new URLSearchParams(params).toString()}` : 'bookings_today';
    if (useCache) {
      const cached = getCached(cacheKey, 90000);
      if (cached) return cached;
    }
    const data = await api.get(`/bookings/today${params ? '?' + new URLSearchParams(params).toString() : ''}`);
    setCached(cacheKey, data);
    return data;
  },
  list: async (params, useCache = true) => {
    const cacheKey = params ? `bookings_list_${new URLSearchParams(params).toString()}` : 'bookings_list';
    if (useCache) {
      const cached = getCached(cacheKey, 90000);
      if (cached) return cached;
    }
    const data = await api.get(`/bookings${params ? '?' + new URLSearchParams(params).toString() : ''}`);
    setCached(cacheKey, data);
    return data;
  },
  getMyBookings: (params) =>
    api.get(`/bookings?my_bookings=true${params ? '&' + new URLSearchParams(params).toString() : ''}`),
  create: async (data) => {
    invalidateCache('bookings_');
    return api.post('/bookings', data);
  },
  update: async (id, data) => {
    invalidateCache('bookings_');
    return api.patch(`/bookings/${id}`, data);
  },
  getById: (id) => api.get(`/bookings/${id}`),
  cancel: async (id) => {
    invalidateCache('bookings_');
    return api.delete(`/bookings/${id}`);
  },
  requestCancel: async (id, reason) => {
    invalidateCache('bookings_');
    return api.post(`/bookings/${id}/cancel-request`, { reason });
  },
  reviewCancel: async (id, action, admin_notes) => {
    invalidateCache('bookings_');
    return api.post(`/bookings/${id}/cancel-review`, { action, admin_notes });
  },
  getPendingCancellations: () => api.get('/bookings/cancellations/pending'),
};

/**
 * Prefetch bookings for a given month into RAM cache.
 * Can be called in the background or when hovering links.
 */
export async function prefetchMonthBookings(targetDate = new Date()) {
  try {
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const startOfMonth = new Date(year, month, 1, 0, 0, 0);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

    const startDate = new Date(startOfMonth);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(endOfMonth);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
    endDate.setHours(23, 59, 59, 999);

    const params = {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
    };
    return await bookingsApi.list(params);
  } catch (err) {
    console.debug('Prefetch error:', err);
  }
}

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
  list: async (params) => {
    const cacheKey = params ? `rooms_${new URLSearchParams(params).toString()}` : 'rooms_all';
    const cached = getCached(cacheKey, 120000);
    if (cached) return cached;
    const data = await api.get(`/rooms${params ? '?' + new URLSearchParams(params).toString() : ''}`);
    setCached(cacheKey, data);
    return data;
  },
  getById: (id) => api.get(`/rooms/${id}`),
  create: async (data) => {
    invalidateCache('rooms_');
    return api.post('/rooms', data);
  },
  update: async (id, data) => {
    invalidateCache('rooms_');
    return api.patch(`/rooms/${id}`, data);
  },
  delete: async (id) => {
    invalidateCache('rooms_');
    return api.delete(`/rooms/${id}`);
  },
};

// Users API Endpoints
export const usersApi = {
  list: async (params) => {
    const cacheKey = params ? `users_${new URLSearchParams(params).toString()}` : 'users_all';
    const cached = getCached(cacheKey, 180000);
    if (cached) return cached;
    const data = await api.get(`/users${params ? '?' + new URLSearchParams(params).toString() : ''}`);
    setCached(cacheKey, data);
    return data;
  },
  updateRoles: async (id, payload) => {
    invalidateCache('users_');
    return api.patch(`/users/${id}/roles`, Array.isArray(payload) ? { roles: payload } : payload);
  },
  delete: async (id) => {
    invalidateCache('users_');
    return api.delete(`/users/${id}`);
  },
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

import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getProfile: () => api.get('/auth/profile')
};

// Monitors API
export const monitorsAPI = {
  getAll: (orgId) => api.get(`/organizations/${orgId}/monitors`),
  getOne: (orgId, monitorId) => api.get(`/organizations/${orgId}/monitors/${monitorId}`),
  create: (orgId, data) => api.post(`/organizations/${orgId}/monitors`, data),
  update: (orgId, monitorId, data) => api.patch(`/organizations/${orgId}/monitors/${monitorId}`, data),
  delete: (orgId, monitorId) => api.delete(`/organizations/${orgId}/monitors/${monitorId}`),
  getStats: (orgId, monitorId, period = '24h') =>
    api.get(`/organizations/${orgId}/monitors/${monitorId}/stats?period=${period}`)
};

// Incidents API
export const incidentsAPI = {
  getAll: (orgId, params = {}) => api.get(`/organizations/${orgId}/incidents`, { params }),
  getOne: (orgId, incidentId) => api.get(`/organizations/${orgId}/incidents/${incidentId}`),
  update: (orgId, incidentId, data) => api.patch(`/organizations/${orgId}/incidents/${incidentId}`, data),
  addUpdate: (orgId, incidentId, message) =>
    api.post(`/organizations/${orgId}/incidents/${incidentId}/updates`, { message }),
  getStats: (orgId) => api.get(`/organizations/${orgId}/incidents/stats`)
};

// Dashboard API
export const dashboardAPI = {
  getStats: (orgId) => api.get(`/organizations/${orgId}/dashboard`)
};

export default api;

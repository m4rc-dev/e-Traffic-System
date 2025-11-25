import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000, // 5 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
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
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    } else if (error.code === 'NETWORK_ERROR' || error.message === 'Network Error') {
      // Handle network errors (backend not available)
      console.warn('Backend API not available:', error.message);
      // Don't redirect on network errors, let the app handle it gracefully
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  getCurrentUser: () => api.get('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    api.put('/auth/change-password', { currentPassword, newPassword }),
};

// Admin API
export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getEnforcers: (params) => api.get('/admin/enforcers', { params }),
  createEnforcer: (data) => api.post('/admin/enforcers', data),
  updateEnforcer: (id, data) => api.put(`/admin/enforcers/${id}`, data),
  deleteEnforcer: (id) => api.delete(`/admin/enforcers/${id}`),
  getNextBadgeNumber: () => api.get('/admin/next-badge-number'),
  getSettings: () => api.get('/admin/settings'),
  updateSettings: (data) => api.put('/admin/settings', data),
  getRepeatOffenders: (params) => api.get('/admin/repeat-offenders', { params }),
};

// Violations API
export const violationsAPI = {
  getViolations: (params) => api.get('/violations', { params }),
  getViolation: (id) => api.get(`/violations/${id}`),
  createViolation: (data) => api.post('/violations', data),
  updateViolation: (id, data) => api.put(`/violations/${id}`, data),
  deleteViolation: (id) => api.delete(`/violations/${id}`),
  getViolationStats: () => api.get('/violations/stats/overview'),
  sendSMS: (id, data) => api.post(`/violations/${id}/send-sms`, data),
  exportViolations: (params) => {
    // Build URL with parameters
    const queryString = new URLSearchParams(params).toString();
    const url = `${API_BASE_URL}/violations/export?${queryString}`;
    
    // Return a direct fetch call for better control over the response
    return fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
  },
};

// Reports API
export const reportsAPI = {
  getViolationsReport: (params) => api.get('/reports/violations', { params }),
  getEnforcersReport: (params) => api.get('/reports/enforcers', { params }),
  getDailySummary: (params) => api.get('/reports/daily-summary', { params }),
  getMonthlyReport: (params) => api.get('/reports/monthly', { params }),
  testDatabase: () => api.get('/reports/test-db'),
};

// SMS API
export const smsAPI = {
  getLogs: (params) => api.get('/sms/logs', { params }),
  getStats: () => api.get('/sms/stats'),
  sendTest: (data) => api.post('/sms/test', data),
};

export default api;

import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const response = await api.get('/auth/me');
        setUser(response.data.user);
      }
    } catch (error) {
      // Only clear token on 401 (unauthorized) errors, not network errors or other issues
      if (error.response?.status === 401) {
        // Token is invalid or expired
        localStorage.removeItem('token');
        setUser(null);
      } else if (!error.isNetworkError && error.response?.status !== 500) {
        // Only clear token for auth-related errors, not server errors
        // Network errors and 500 errors shouldn't clear the token
        console.warn('Auth check failed, but keeping token:', error.message);
      }
      // Don't clear token on network errors (backend not running) or server errors
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password, browserGeo = null) => {
    try {
      const body = { username, password };
      if (browserGeo) body.browserGeo = browserGeo;
      const response = await api.post('/auth/login', body);
      localStorage.setItem('token', response.data.token);
      setUser(response.data.user);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed'
      };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      setUser(null);
    }
  };

  const refreshUser = async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data.user);
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAdmin: user?.role === 'admin' || user?.is_master_admin === true,
    hasPayrollAccess: user?.payroll_access === true || user?.is_master_admin === true,
    isMasterAdmin: user?.is_master_admin === true,
    refreshUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};


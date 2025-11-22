import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../services/api';
import wsService from '../services/websocket';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [currentOrg, setCurrentOrg] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      const savedOrg = localStorage.getItem('currentOrg');

      if (token && savedUser) {
        try {
          setUser(JSON.parse(savedUser));

          const { data } = await authAPI.getProfile();
          setUser(data.user);
          setOrganizations(data.organizations);

          if (savedOrg) {
            const org = data.organizations.find(o => o.id === savedOrg);
            if (org) {
              setCurrentOrg(org);
              wsService.connect();
              wsService.joinOrganization(org.id);
            }
          } else if (data.organizations.length > 0) {
            setCurrentOrg(data.organizations[0]);
            wsService.connect();
            wsService.joinOrganization(data.organizations[0].id);
          }
        } catch (error) {
          console.error('Auth initialization error:', error);
          logout();
        }
      }

      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    const { data } = await authAPI.login({ email, password });

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    setUser(data.user);
    setOrganizations(data.organizations);

    if (data.organizations.length > 0) {
      const org = data.organizations[0];
      setCurrentOrg(org);
      localStorage.setItem('currentOrg', org.id);

      wsService.connect();
      wsService.joinOrganization(org.id);
    }

    return data;
  };

  const register = async (formData) => {
    const { data } = await authAPI.register(formData);

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    setUser(data.user);
    setOrganizations([data.organization]);
    setCurrentOrg(data.organization);
    localStorage.setItem('currentOrg', data.organization.id);

    wsService.connect();
    wsService.joinOrganization(data.organization.id);

    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('currentOrg');

    if (currentOrg) {
      wsService.leaveOrganization(currentOrg.id);
    }
    wsService.disconnect();

    setUser(null);
    setOrganizations([]);
    setCurrentOrg(null);
  };

  const switchOrganization = (orgId) => {
    const org = organizations.find(o => o.id === orgId);
    if (org) {
      if (currentOrg) {
        wsService.leaveOrganization(currentOrg.id);
      }

      setCurrentOrg(org);
      localStorage.setItem('currentOrg', org.id);

      wsService.joinOrganization(org.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organizations,
        currentOrg,
        loading,
        login,
        register,
        logout,
        switchOrganization,
        isAuthenticated: !!user
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export default AuthContext;

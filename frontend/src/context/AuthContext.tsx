import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { authApi } from '../api/auth.api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('rocketwheel_access_token') || localStorage.getItem('medipulse_access_token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const userData = await authApi.me();
        setUser(userData);
      } catch (err) {
        localStorage.removeItem('rocketwheel_access_token');
        localStorage.removeItem('rocketwheel_refresh_token');
        localStorage.removeItem('medipulse_access_token');
        localStorage.removeItem('medipulse_refresh_token');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const res = await authApi.login({ email, password });
    localStorage.setItem('rocketwheel_access_token', res.accessToken);
    localStorage.setItem('rocketwheel_refresh_token', res.refreshToken);
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    localStorage.removeItem('rocketwheel_access_token');
    localStorage.removeItem('rocketwheel_refresh_token');
    localStorage.removeItem('medipulse_access_token');
    localStorage.removeItem('medipulse_refresh_token');
    setUser(null);
    window.location.href = '/staff/login';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

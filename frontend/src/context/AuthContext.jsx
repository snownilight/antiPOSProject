/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import API_BASE_URL from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('authUser');
    try {
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem('authToken');
  });

  // Keep localStorage in sync with state changes
  useEffect(() => {
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('authUser', JSON.stringify(user));
    } else {
      localStorage.removeItem('authUser');
    }
  }, [user]);

  const login = useCallback(async (username, password) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    console.log('Login Response:', data);

    if (!response.ok) {
      throw new Error(data.message || '登入失敗，請檢查帳號密碼');
    }

    if (data.code === 200 && data.data) {
      const { token: userToken, username: userVal, role, displayName } = data.data;
      localStorage.setItem('authToken', userToken);
      localStorage.setItem('authUser', JSON.stringify({ username: userVal, role, displayName }));
      setToken(userToken);
      setUser({ username: userVal, role, displayName });
      return data.data;
    } else {
      console.error('Login condition check failed:', { code: data.code, data: data.data });
      throw new Error(data.message || '登入失敗');
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    setToken(null);
    setUser(null);
  }, []);

  const setCustomerSession = useCallback((customerToken, tableInfo) => {
    const customerUser = {
      username: `table:${tableInfo.id}`,
      role: 'CUSTOMER',
      displayName: `${tableInfo.name}桌顧客`,
      tableId: tableInfo.id,
      tableName: tableInfo.name,
      tableToken: tableInfo.token
    };
    localStorage.setItem('authToken', customerToken);
    localStorage.setItem('authUser', JSON.stringify(customerUser));
    setToken(customerToken);
    setUser(customerUser);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, setCustomerSession }}>
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

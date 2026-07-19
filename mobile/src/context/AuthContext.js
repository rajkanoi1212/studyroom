import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../api/client";

const AuthContext = createContext(null);
const STORAGE_KEY = "studyroom.auth";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const { user, token } = JSON.parse(raw);
          setUser(user); setToken(token);
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(async (user, token) => {
    setUser(user); setToken(token);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ user, token }));
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.login(email, password);
    await persist(data.user, data.token);
  }, [persist]);

  const register = useCallback(async (name, email, password) => {
    const data = await api.register(name, email, password);
    await persist(data.user, data.token);
  }, [persist]);

  const logout = useCallback(async () => {
    setUser(null); setToken(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

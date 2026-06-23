import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, apiEnabled } from "../lib/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("ef_token") || "");
  const [loading, setLoading] = useState(apiEnabled);

  const persist = (t, u) => {
    setToken(t || "");
    setUser(u || null);
    if (t) localStorage.setItem("ef_token", t);
    else localStorage.removeItem("ef_token");
  };

  const refresh = useCallback(async () => {
    if (!apiEnabled || !token) {
      setLoading(false);
      return;
    }
    try {
      const { user: u } = await api.me(token);
      setUser(u);
    } catch {
      persist("", null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email, password) => {
    const { token: t, user: u } = await api.login(email, password);
    persist(t, u);
    return u;
  };

  const register = async (email, password, name) => {
    const data = await api.registerHost(email, password, name);
    if (data.pending) return data; // email verification required
    persist(data.token, data.user);
    return data.user;
  };

  const logout = () => persist("", null);

  const loginWithToken = (t, u) => persist(t, u);

  const patchUser = (partial) => setUser((prev) => (prev ? { ...prev, ...partial } : prev));

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        apiEnabled,
        login,
        register,
        logout,
        loginWithToken,
        patchUser,
        isSuperAdmin: user?.role === "super_admin",
        isHost: user?.role === "host" || user?.role === "super_admin",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

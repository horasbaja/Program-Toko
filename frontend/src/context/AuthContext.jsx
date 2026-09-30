import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const AuthCtx = createContext(null);

const cached = () => {
  try {
    return JSON.parse(localStorage.getItem("hb_user"));
  } catch {
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => (localStorage.getItem("hb_token") ? cached() : false) || false);

  useEffect(() => {
    if (!localStorage.getItem("hb_token")) return;
    api.get("/auth/me").then((r) => {
      setUser(r.data);
      localStorage.setItem("hb_user", JSON.stringify(r.data));
    }).catch(() => null);
  }, []);

  const login = async (username, password) => {
    const { data } = await api.post("/auth/login", { username, password });
    localStorage.setItem("hb_token", data.token);
    localStorage.setItem("hb_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("hb_token");
    localStorage.removeItem("hb_user");
    setUser(false);
  };

  return <AuthCtx.Provider value={{ user, login, logout, isAdmin: user?.role === "admin" }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

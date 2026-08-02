"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type StoredUser = { name: string } | null;

type UserContextValue = {
  user: StoredUser;
  login: (user: StoredUser) => void;
  logout: () => void;
};

const UserContext = createContext<UserContextValue | null>(null);

const STORAGE_KEY = "av_user";

function readStoredUser(): StoredUser {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<StoredUser>(null);

  useEffect(() => {
    setUser(readStoredUser());
  }, []);

  const login = (nextUser: StoredUser) => {
    setUser(nextUser);
    try {
      if (nextUser) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  return (
    <UserContext.Provider value={{ user, login, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser debe usarse dentro de un UserProvider");
  }
  return ctx;
}

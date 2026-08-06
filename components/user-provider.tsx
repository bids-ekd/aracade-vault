"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

export type StoredUser = { name: string } | null;

type UserContextValue = {
  user: StoredUser;
  login: (user: StoredUser) => void;
  logout: () => void;
};

const UserContext = createContext<UserContextValue | null>(null);

const STORAGE_KEY = "av_user";

const listeners = new Set<() => void>();
let cachedUser: StoredUser = null;
let cacheInitialized = false;

function readStoredUser(): StoredUser {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function getSnapshot(): StoredUser {
  if (!cacheInitialized) {
    cachedUser = readStoredUser();
    cacheInitialized = true;
  }
  return cachedUser;
}

function getServerSnapshot(): StoredUser {
  return null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setStoredUser(user: StoredUser) {
  cachedUser = user;
  cacheInitialized = true;
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
  listeners.forEach((listener) => listener());
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const user = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const login = (nextUser: StoredUser) => setStoredUser(nextUser);
  const logout = () => setStoredUser(null);

  return <UserContext.Provider value={{ user, login, logout }}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser debe usarse dentro de un UserProvider");
  }
  return ctx;
}

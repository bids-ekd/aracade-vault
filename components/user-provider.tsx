"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type AuthUser = { name: string; email: string } | null;

type UserContextValue = {
  user: AuthUser;
  loading: boolean;
  logout: () => Promise<void>;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(
        sessionUser
          ? {
              name:
                (sessionUser.user_metadata?.display_name as string | undefined) ??
                sessionUser.email!,
              email: sessionUser.email!,
            }
          : null,
      );
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
  };

  return <UserContext.Provider value={{ user, loading, logout }}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser debe usarse dentro de un UserProvider");
  }
  return ctx;
}

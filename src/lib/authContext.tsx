"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "./supabase/client";
import { getProfile } from "./services/users";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  avatarUrl: string;
  setAvatarUrl: (url: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  avatarUrl: "",
  setAvatarUrl: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState("");
  const supabase = createClient();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!user) {
      setAvatarUrl("");
      return;
    }
    getProfile(user.id).then((p) => setAvatarUrl(p?.avatar_url || ""));
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, avatarUrl, setAvatarUrl }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { createClient } from "./supabase/client";
import { getProfile } from "./services/users";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  avatarUrl: string;
  setAvatarUrl: (url: string) => void;
  username: string | null;
  setUsername: (username: string | null) => void;
  signingOut: boolean;
  setSigningOut: (signingOut: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  avatarUrl: "",
  setAvatarUrl: () => {},
  username: null,
  setUsername: () => {},
  signingOut: false,
  setSigningOut: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [username, setUsername] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const supabase = createClient();
  const pathname = usePathname();

  useEffect(() => {
    // Once the route has actually changed away from the page that triggered
    // sign-out, the ProfileHeader instance racing against the auth-state
    // update has unmounted, so it's safe to clear the flag for future visits.
    setSigningOut(false);
  }, [pathname]);

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
      const nextUser = session?.user ?? null;
      // Events like TOKEN_REFRESHED fire a new user object with the same id;
      // only update state when the actual user changes, so effects keyed on
      // `user` (e.g. sign-in redirects) don't re-fire and cause a nav loop.
      setUser((prev) => (prev?.id === nextUser?.id ? prev : nextUser));
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!user) {
      setAvatarUrl("");
      setUsername(null);
      return;
    }
    getProfile(user.id).then((p) => {
      setAvatarUrl(p?.avatar_url || "");
      setUsername(p?.username ?? null);
    });
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        avatarUrl,
        setAvatarUrl,
        username,
        setUsername,
        signingOut,
        setSigningOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthUser, fetchMe, hasPermission, isAdmin, logout as apiLogout } from "./auth";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<AuthUser | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

// Pages that work signed out, and pages a user with a pending password change may open
const PUBLIC_PATHS = ["/login"];
const PASSWORD_PATH = "/change-password";

// Which pages each kind of user may open. The backend enforces access; this only
// keeps people away from pages that would fail.
export function canOpen(user: AuthUser | null, path: string): boolean {
  if (!user) return false;
  if (path.startsWith("/map") || path.startsWith("/timeline")) return isAdmin(user);
  if (path.startsWith("/admin")) return hasPermission(user, "auditor");
  return true;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const path = usePathname();

  const refresh = useCallback(async () => {
    try {
      const me = await fetchMe();
      setUser(me);
      return me;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Any API call that finds the session gone (expired, revoked, user deactivated) signs out here
  useEffect(() => {
    const onExpired = () => { setUser(null); router.replace("/login"); };
    const onPassword = () => router.replace(PASSWORD_PATH);
    window.addEventListener("ndap:unauthorized", onExpired);
    window.addEventListener("ndap:password-change", onPassword);
    return () => {
      window.removeEventListener("ndap:unauthorized", onExpired);
      window.removeEventListener("ndap:password-change", onPassword);
    };
  }, [router]);

  useEffect(() => {
    if (loading || PUBLIC_PATHS.includes(path)) return;
    if (!user) router.replace("/login");
    else if (user.must_change_password && path !== PASSWORD_PATH) router.replace(PASSWORD_PATH);
    else if (!user.must_change_password && !canOpen(user, path)) router.replace("/chat");
  }, [loading, user, path, router]);

  const signOut = useCallback(async () => {
    await apiLogout();
    setUser(null);
    router.replace("/login");
  }, [router]);

  return <AuthContext.Provider value={{ user, loading, refresh, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

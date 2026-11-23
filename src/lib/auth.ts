// Sign-in is checked by the backend, which keeps the session in an httpOnly cookie.
// Nothing about the session is stored in the browser's JS-readable storage.

export type Role = "admin" | "user";
export type Permission = "reviewer" | "auditor";

export interface AuthUser {
  username: string;
  display_name: string;
  role: Role;
  permissions: Permission[];
  must_change_password: boolean;
}

async function detail(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body.detail === "string") return body.detail;
  } catch { /* not JSON */ }
  return `HTTP ${res.status}`;
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const res = await fetch("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: username.trim(), password }),
  });
  if (!res.ok) throw new Error(await detail(res));
  return res.json();
}

export async function logout(): Promise<void> {
  await fetch("/api/v1/auth/logout", { method: "POST" }).catch(() => undefined);
}

// null when signed out
export async function fetchMe(): Promise<AuthUser | null> {
  const res = await fetch("/api/v1/auth/me", { cache: "no-store" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(await detail(res));
  return res.json();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await fetch("/api/v1/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  if (!res.ok) throw new Error(await detail(res));
}

export const isAdmin = (u: AuthUser | null) => u?.role === "admin";
export const hasPermission = (u: AuthUser | null, p: Permission) =>
  isAdmin(u) || !!u?.permissions.includes(p);

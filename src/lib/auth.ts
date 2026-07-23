export const STATIC_CREDENTIALS = [
  { username: "admin@ihfciitd.com", password: "IITdelhi#2026" },
];

export function login(username: string, password: string): boolean {
  const match = STATIC_CREDENTIALS.find(
    (c) => c.username === username && c.password === password
  );
  if (match) {
    sessionStorage.setItem("ihfc_auth", JSON.stringify({ username: match.username }));
    return true;
  }
  return false;
}

export function logout() {
  sessionStorage.removeItem("ihfc_auth");
}

export function getAuthUser(): string | null {
  try {
    const raw = sessionStorage.getItem("ihfc_auth");
    if (!raw) return null;
    const { username } = JSON.parse(raw);
    return username ?? null;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getAuthUser() !== null;
}

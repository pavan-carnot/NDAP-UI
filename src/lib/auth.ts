export const STATIC_CREDENTIALS = [
  { username: "admin", password: "admin@123" },
  { username: "secretary", password: "niti@2024" },
];

export function login(username: string, password: string): boolean {
  const match = STATIC_CREDENTIALS.find(
    (c) => c.username === username && c.password === password
  );
  if (match) {
    sessionStorage.setItem("mnre_auth", JSON.stringify({ username: match.username }));
    return true;
  }
  return false;
}

export function logout() {
  sessionStorage.removeItem("mnre_auth");
}

export function getAuthUser(): string | null {
  try {
    const raw = sessionStorage.getItem("mnre_auth");
    if (!raw) return null;
    const { username } = JSON.parse(raw);
    return username ?? null;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  // login commented out — always authenticated
  return true;
}

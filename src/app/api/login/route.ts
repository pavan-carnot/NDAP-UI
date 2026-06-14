import { NextResponse } from "next/server";

const FIXED_USERNAME = "admin";
const FIXED_PASSWORD = "ndap2024";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { username, password } = body as { username?: string; password?: string };

  if (username === FIXED_USERNAME && password === FIXED_PASSWORD) {
    const apiKey = process.env.NEXT_PUBLIC_API_KEY ?? "";
    const response = NextResponse.json({ apiKey });
    response.cookies.set("ndap_auth", "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8,
      path: "/",
    });
    return response;
  }

  return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
}

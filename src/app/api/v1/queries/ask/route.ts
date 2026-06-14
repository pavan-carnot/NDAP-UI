import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Absorb Next.js prefetch GET requests — never let them reach the backend
export async function GET() {
  return NextResponse.json({ detail: "Method not allowed" }, { status: 405 });
}

// Proxy POST to backend with all headers intact
export async function POST(request: NextRequest) {
  const body = await request.text();

  const forwardHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const apiKey = request.headers.get("x-api-key");
  if (apiKey) forwardHeaders["X-API-Key"] = apiKey;

  const res = await fetch(`${BACKEND}/api/v1/queries/ask`, {
    method: "POST",
    headers: forwardHeaders,
    body,
  });

  const data = await res.text();
  return new NextResponse(data, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

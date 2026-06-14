import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Next.js App Router config — disable body size limit and set a long timeout
export const maxDuration = 300; // 5 minutes (Vercel/Next.js max for hobby = 60s, self-hosted = unlimited)

export async function POST(req: NextRequest) {
  const body = await req.text();
  const apiKey = req.headers.get("X-API-Key") ?? "";

  let res: Response;
  try {
    // AbortController gives us an explicit timeout independent of Next.js proxy limits
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 min

    res = await fetch(`${API_BASE}/api/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "X-API-Key": apiKey } : {}),
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upstream request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const data = await res.text();
  return new NextResponse(data, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}

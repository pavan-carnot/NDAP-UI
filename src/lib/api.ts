import type {
  QueryResult,
  HealthStatus,
  Document,
  RecentQuery,
  EsChunk,
} from "./types";

const BASE = "/api";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function getHealth(): Promise<HealthStatus> {
  return json<HealthStatus>(await fetch(`${BASE}/health`));
}

export async function runQuery(
  query: string,
  sessionId: string | null,
  model: string
): Promise<QueryResult> {
  return json<QueryResult>(
    await fetch(`${BASE}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, session_id: sessionId, model }),
    })
  );
}

export async function getDocuments(): Promise<Document[]> {
  return json<Document[]>(await fetch(`${BASE}/documents`));
}

export async function deleteDocument(
  filename: string
): Promise<{ pg: unknown; es_removed: number }> {
  return json(
    await fetch(`${BASE}/documents/${encodeURIComponent(filename)}`, {
      method: "DELETE",
    })
  );
}

export async function uploadDocument(
  file: File,
  useVision: boolean,
  useStructurer: boolean
): Promise<{ filename: string; chunks: number }> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("use_vision", String(useVision));
  fd.append("use_structurer", String(useStructurer));
  return json(await fetch(`${BASE}/documents/upload`, { method: "POST", body: fd }));
}

export async function getRecentQueries(limit = 10): Promise<RecentQuery[]> {
  return json<RecentQuery[]>(await fetch(`${BASE}/queries/recent?limit=${limit}`));
}

export async function getTableData(
  table: string,
  limit = 50
): Promise<Record<string, unknown>[]> {
  return json(await fetch(`${BASE}/db/${table}?limit=${limit}`));
}

export async function getEsChunks(filename: string): Promise<EsChunk[]> {
  return json<EsChunk[]>(
    await fetch(`${BASE}/es/chunks/${encodeURIComponent(filename)}`)
  );
}

export async function getLogs(): Promise<string[]> {
  return json<string[]>(await fetch(`${BASE}/logs`));
}

export async function getLogContent(
  filename: string
): Promise<{ filename: string; content: string }> {
  return json(await fetch(`${BASE}/logs/${encodeURIComponent(filename)}`));
}

export async function clearStaleCache(): Promise<{ deleted: number }> {
  return json(await fetch(`${BASE}/cache/stale`, { method: "DELETE" }));
}

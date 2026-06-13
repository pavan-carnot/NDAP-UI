import type {
  QueryResult,
  HealthStatus,
  Document,
  RecentQuery,
  EsChunk,
  Skill,
} from "./types";

const BASE = "/api";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    try {
      const body = JSON.parse(text);
      throw new Error((body.detail ?? body.message ?? text) || `HTTP ${res.status}`);
    } catch (e) {
      if (e instanceof SyntaxError) throw new Error(text || `HTTP ${res.status}`);
      throw e;
    }
  }
  return res.json() as Promise<T>;
}

export async function getHealth(): Promise<HealthStatus> {
  return json<HealthStatus>(await fetch(`${BASE}/health`));
}

export async function runQuery(
  query: string,
  sessionId: string | null,
  model: string,
  agent?: string | null
): Promise<QueryResult> {
  return json<QueryResult>(
    await fetch(`${BASE}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, session_id: sessionId, model, agent }),
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

// ── v1 API (multi-agent workflow) ──────────────────────────────────────────

export async function askQuery(
  message: string,
  sessionId: string | null,
  mode = "fast",
  agent?: string | null
): Promise<QueryResult> {
  const raw = await json<{ answer: string; chunks: QueryResult["chunks"]; metadata: QueryResult["meta"] }>(
    await fetch(`${BASE}/v1/queries/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, sessionId, mode, agent }),
    })
  );
  // Normalise v1 shape (metadata) → existing QueryResult shape (meta)
  return {
    session_id: sessionId ?? "",
    answer: raw.answer,
    chunks: raw.chunks,
    context: "",
    meta: raw.metadata,
  };
}

export async function getSkills(): Promise<Skill[]> {
  return json<Skill[]>(await fetch(`${BASE}/v1/skills`));
}

export async function resetSession(sessionId: string): Promise<void> {
  await fetch(`${BASE}/v1/session/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
}

// ── Map / Spatial Analytics ────────────────────────────────────────────────

export interface MapDataset {
  id: string;
  source_file: string;
  metric: string;
  description?: string;
}

export type MapDataPoint = {
  location: string;
  value: number;
  unit: string;
  time: string;
  latitude: number;
  longitude: number;
};

export async function getMapDatasets(): Promise<MapDataset[]> {
  return json<MapDataset[]>(await fetch(`${BASE}/map/datasets`));
}

const mapMetricsCache = new Map<string, Promise<string[]>>();

export function getMapMetrics(sourceFile: string): Promise<string[]> {
  if (mapMetricsCache.has(sourceFile)) {
    return mapMetricsCache.get(sourceFile)!;
  }
  const promise = fetch(`${BASE}/map/metrics?source_file=${encodeURIComponent(sourceFile)}`).then(res => {
    if (!res.ok) throw new Error("Failed to fetch map metrics");
    return res.json() as Promise<string[]>;
  });
  mapMetricsCache.set(sourceFile, promise);
  return promise;
}

export async function getMapData(datasetId: string, states?: string[]): Promise<MapDataPoint[]> {
  let url = `${BASE}/map/data?dataset_id=${encodeURIComponent(datasetId)}`;
  if (states && states.length > 0) {
    url += `&states=${encodeURIComponent(states.join(","))}`;
  }
  return json<MapDataPoint[]>(await fetch(url));
}

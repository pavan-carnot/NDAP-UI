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
  agent?: string | null,
  language = "English"
): Promise<QueryResult> {
  const raw = await json<{ answer: string; chunks: QueryResult["chunks"]; metadata: QueryResult["meta"] }>(
    await fetch(`${BASE}/v1/queries/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, sessionId, mode, agent, language }),
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

export async function initSpeechWizard(
  topic: string,
  sessionId?: string | null
): Promise<{ session_id: string; step: string; topic: string; wizard_data: any; message: string }> {
  return json(
    await fetch(`${BASE}/speech/wizard/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, session_id: sessionId }),
    })
  );
}

export async function checkSpeechHistoricalRef(
  topic: string,
  intent: any,
  sessionId?: string | null,
  userRole = "speechwriter"
): Promise<{
  session_id: string;
  step: string;
  topic: string;
  intent: any;
  found_historical_speeches: any[];
  historical_question: string;
  options: string[];
  top_historical_doc?: string;
}> {
  return json(
    await fetch(`${BASE}/speech/wizard/historical_check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, intent, session_id: sessionId, user_role: userRole }),
    })
  );
}

export async function proposeSpeechPlan(
  intent: any,
  selectedHistoricalDoc?: string | null,
  sessionId?: string | null,
  userRole = "speechwriter"
): Promise<any> {
  return json(
    await fetch(`${BASE}/speech/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...intent,
        selected_historical_doc: selectedHistoricalDoc,
        session_id: sessionId,
        user_role: userRole,
      }),
    })
  );
}

export async function approveSpeechPlan(
  planId: string,
  userFeedback = "",
  userRole = "speechwriter"
): Promise<{ plan_id: string; status: string; final_speech: string; outline_used: unknown }> {
  return json(
    await fetch(`${BASE}/speech/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: planId, user_feedback: userFeedback, user_role: userRole }),
    })
  );
}

export async function reviseSpeechPlan(
  planId: string,
  userFeedback: string,
  userRole = "speechwriter"
): Promise<{ plan_id: string; status: string; outline_plan: unknown; message: string }> {
  return json(
    await fetch(`${BASE}/speech/revise`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: planId, user_feedback: userFeedback, user_role: userRole }),
    })
  );
}

export async function searchSpeechArchive(
  query = "",
  speaker = "",
  theme = "",
  year = "",
  userRole = "speechwriter"
): Promise<{ speeches: any[]; count: number }> {
  return json(
    await fetch(`${BASE}/speech/archive/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, speaker, theme, year, user_role: userRole }),
    })
  );
}

// ── Map / Spatial Analytics ────────────────────────────────────────────────

export interface MapDataset {
  id: string;
  source_file: string;
  metric: string;
  label?: string;
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

// Concurrency queue to prevent DB connection pool exhaustion
let _activeFetches = 0;
const _MAX_CONCURRENT = 3;
const _fetchQueue: (() => void)[] = [];

function _acquireSlot(): Promise<void> {
  if (_activeFetches < _MAX_CONCURRENT) {
    _activeFetches++;
    return Promise.resolve();
  }
  return new Promise<void>(resolve => { _fetchQueue.push(resolve); });
}

function _releaseSlot() {
  const next = _fetchQueue.shift();
  if (next) { next(); } else { _activeFetches--; }
}

export function getMapMetrics(sourceFile: string): Promise<string[]> {
  if (mapMetricsCache.has(sourceFile)) {
    return mapMetricsCache.get(sourceFile)!;
  }
  const promise = (async () => {
    await _acquireSlot();
    try {
      const res = await fetch(`${BASE}/map/metrics?source_file=${encodeURIComponent(sourceFile)}`);
      if (!res.ok) throw new Error("Failed to fetch map metrics");
      return await res.json() as string[];
    } finally {
      _releaseSlot();
    }
  })();
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

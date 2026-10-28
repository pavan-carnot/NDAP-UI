import { getAuthUser } from "./auth";
import type {
  QueryResult,
  HealthStatus,
  Document,
  RecentQuery,
  EsChunk,
  Skill,
} from "./types";

const BASE = "/api";

// Containers and chats are owned by the signed-in user
function userHeaders(): Record<string, string> {
  const user = typeof window === "undefined" ? null : getAuthUser();
  return user ? { "X-User": user } : {};
}

// FastAPI errors arrive as {"detail": "..."}; surface just the message
async function errorText(res: Response): Promise<string> {
  const text = await res.text().catch(() => res.statusText);
  try {
    const detail = JSON.parse(text).detail;
    if (typeof detail === "string") return detail;
  } catch { /* not JSON */ }
  return text || `HTTP ${res.status}`;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await errorText(res));
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

export interface AskResult extends QueryResult {
  turn_id?: string;
  chat_name?: string;
}

// With chatId set, sessionId is the knowledge container ("general" = All documents)
// and the turn is saved to that chat.
export async function askQuery(
  message: string,
  sessionId: string | null,
  mode = "fast",
  agent?: string | null,
  language = "English",
  webSearchEnabled = false,
  chatId?: string | null
): Promise<AskResult> {
  const raw = await json<{
    answer: string; chunks: QueryResult["chunks"]; metadata: QueryResult["meta"];
    turn_id?: string; chat_name?: string;
  }>(
    await fetch(`${BASE}/v1/queries/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...userHeaders() },
      body: JSON.stringify({
        message, sessionId, session_id: chatId ? sessionId : undefined, chat_id: chatId ?? undefined,
        mode, agent, language, web_search_enabled: webSearchEnabled,
      }),
    })
  );
  // Normalise v1 shape (metadata) → existing QueryResult shape (meta)
  return {
    session_id: sessionId ?? "",
    answer: raw.answer,
    chunks: raw.chunks,
    context: "",
    meta: raw.metadata,
    turn_id: raw.turn_id,
    chat_name: raw.chat_name,
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

// ── Link Analysis (Neo4j knowledge graph) ──────────────────────────────────

export interface KgNode {
  id: string;
  name: string;
  labels: string[];
  color: string;
  size: number;
  caption: string;
  properties: Record<string, unknown>;
}

export interface KgRelationship {
  id: string;
  from: string;
  to: string;
  type: string;
  caption: string;
  color: string;
  width: number;
  properties: Record<string, unknown>;
}

export interface KgGraphData {
  nodes: KgNode[];
  relationships: KgRelationship[];
}

export type KgStatusState =
  | "not_started" | "initializing" | "processing" | "finalizing" | "completed" | "error";

export interface KgStatus {
  status: KgStatusState;
  progress: number;
  error?: string | null;
  file_names?: string[];
  is_dense?: boolean;
  nodes?: number;
  relationships?: number;
  total_windows?: number;
  failed_windows?: number;
  current_file?: string;
  started_at?: number;
  elapsed_seconds?: number;
}

export async function createGraph(
  sessionId: string,
  fileNames: string[],
  isDense: boolean
): Promise<{ status: string; session_id: string }> {
  return json(
    await fetch(`${BASE}/v1/documents/graph`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, file_names: fileNames, is_dense: isDense }),
    })
  );
}

export async function getGraphStatus(sessionId: string): Promise<KgStatus> {
  return json<KgStatus>(
    await fetch(`${BASE}/v1/documents/graph/status?session_id=${encodeURIComponent(sessionId)}`)
  );
}

export async function getGraphData(sessionId: string): Promise<KgGraphData> {
  return json<KgGraphData>(
    await fetch(`${BASE}/v1/documents/graph/data?session_id=${encodeURIComponent(sessionId)}`)
  );
}


// ── Knowledge containers ────────────────────────────────────────────────────

export const GENERAL_WORKSPACE = "general";

export interface ContainerFile {
  filename: string;
  origin: "upload" | "library";
  status: "active" | "processing" | "failed" | "missing" | string;
  total_chunks: number | null;
  error_message: string | null;
  added_at: string;
}

export interface KnowledgeContainer {
  session_id: string;
  name: string;
  is_pinned: boolean;
  created_at: string;
  timestamp: string;
  chat_count: number;
  files: ContainerFile[];
  file_names: string[];
}

export interface ChatSummary {
  chat_id: string;
  chat_name: string;
  total_messages: number;
  created_at: string;
  updated_at: string;
}

export interface StoredTurn {
  id: string;
  query: string;
  answer: string;
  chunks: QueryResult["chunks"];
  meta: QueryResult["meta"];
  is_note: boolean;
  created_at: string;
}

export interface ChatHistory {
  chatId: string;
  chatName: string;
  total_messages: number;
  messages: StoredTurn[];
}

export interface SavedNote {
  message_id: string;
  chat_id: string;
  chat_name: string;
  query: string;
  answer: string;
  created_at: string;
}

export interface SourceUploadResult {
  session_id: string;
  details: { filename: string; status: string; error?: string }[];
  container: KnowledgeContainer;
}

async function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  return json<T>(
    await fetch(`${BASE}${path}`, {
      method,
      headers: { ...userHeaders(), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  );
}

const enc = encodeURIComponent;

export async function listContainers(): Promise<KnowledgeContainer[]> {
  const res = await send<{ data: { sessions: KnowledgeContainer[] } }>("/v1/documents/containers", "GET");
  return res.data.sessions;
}

// replace: an upload whose name is already indexed overwrites and re-indexes that copy
function sourcesForm(files: File[], libraryFiles: string[], useVision: boolean, replace: boolean) {
  const fd = new FormData();
  files.forEach(f => fd.append("files", f));
  if (libraryFiles.length) fd.append("library_files", JSON.stringify(libraryFiles));
  fd.append("use_vision", String(useVision));
  fd.append("replace", String(replace));
  return fd;
}

export async function createContainer(
  name: string, files: File[], libraryFiles: string[], useVision: boolean, replace = false
): Promise<SourceUploadResult> {
  const fd = sourcesForm(files, libraryFiles, useVision, replace);
  if (name.trim()) fd.append("name", name.trim());
  return json(await fetch(`${BASE}/v1/documents/upload`, { method: "POST", headers: userHeaders(), body: fd }));
}

export async function addSources(
  containerId: string, files: File[], libraryFiles: string[], useVision: boolean, replace = false
): Promise<SourceUploadResult> {
  const fd = sourcesForm(files, libraryFiles, useVision, replace);
  fd.append("session_id", containerId);
  return json(await fetch(`${BASE}/v1/documents/add-upload`, { method: "POST", headers: userHeaders(), body: fd }));
}

export const renameContainer = (id: string, newName: string) =>
  send("/v1/documents/rename-container", "PUT", { session_id: id, new_name: newName });

export const togglePinContainer = (id: string) =>
  send<{ isPinned: boolean }>(`/v1/documents/containers/${enc(id)}/pin`, "POST");

export const touchContainer = (id: string) =>
  send("/v1/documents/timestamp", "PUT", { session_id: id });

export const deleteContainer = (id: string) =>
  send<{ files_removed_from_library: string[]; chats_deleted: number }>(`/v1/documents/containers/${enc(id)}`, "DELETE");

export const removeContainerSource = (id: string, filename: string) =>
  send<{
    removed_from_library: boolean;
    graph: { nodes_deleted: number; relationships_deleted: number; chunks_deleted: number } | null;
  }>(`/v1/documents/containers/${enc(id)}/sources/${enc(filename)}`, "DELETE");

export const listChats = (containerId: string) =>
  send<{ chats: ChatSummary[] }>(`/v1/queries/chat-history/list?session_id=${enc(containerId)}`, "GET").then(r => r.chats);

// Without chatId the server reuses the latest empty chat or starts a new one
export const getChatHistory = (containerId: string, chatId?: string, limit = 200) =>
  send<ChatHistory>(
    `/v1/queries/chat-history?session_id=${enc(containerId)}${chatId ? `&chat_id=${enc(chatId)}` : ""}&limit=${limit}`,
    "GET"
  );

export const renameChat = (containerId: string, chatId: string, newName: string) =>
  send("/v1/queries/chat-history/rename", "PUT", { session_id: containerId, chat_id: chatId, new_chat_name: newName });

export const deleteChat = (containerId: string, chatId: string, clearOnly = false) =>
  send(`/v1/queries/chat-history/${enc(containerId)}/${enc(chatId)}${clearOnly ? "?clear=true" : ""}`, "DELETE");

export const listNotes = (containerId: string) =>
  send<{ notes: SavedNote[] }>(`/v1/queries/notes/list?session_id=${enc(containerId)}`, "GET").then(r => r.notes);

export const toggleNote = (containerId: string, chatId: string, messageId: string) =>
  send<{ save_to_note: boolean }>("/v1/queries/notes/toggle", "POST", { session_id: containerId, chat_id: chatId, message_id: messageId });

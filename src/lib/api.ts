import type {
  QueryResult,
  HealthStatus,
  Document,
  RecentQuery,
  EsChunk,
  Skill,
} from "./types";

const BASE = "/api";

// Every call carries the session cookie (same origin). A lost session or a pending
// password change is announced to AuthProvider, which redirects.
async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, { credentials: "same-origin", ...init });
  if (typeof window !== "undefined") {
    if (res.status === 401) {
      window.dispatchEvent(new Event("ndap:unauthorized"));
    } else if (res.status === 403) {
      const body = await res.clone().json().catch(() => null);
      if (body?.detail === "password_change_required") window.dispatchEvent(new Event("ndap:password-change"));
    }
  }
  return res;
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
  return json<HealthStatus>(await apiFetch(`${BASE}/health`));
}

export async function runQuery(
  query: string,
  sessionId: string | null,
  model: string,
  agent?: string | null
): Promise<QueryResult> {
  return json<QueryResult>(
    await apiFetch(`${BASE}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, session_id: sessionId, model, agent }),
    })
  );
}

export async function getDocuments(): Promise<Document[]> {
  return json<Document[]>(await apiFetch(`${BASE}/documents`));
}

export async function deleteDocument(
  filename: string
): Promise<{ pg: unknown; es_removed: number }> {
  return json(
    await apiFetch(`${BASE}/documents/${encodeURIComponent(filename)}`, {
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
  return json(await apiFetch(`${BASE}/documents/upload`, { method: "POST", body: fd }));
}

export async function getRecentQueries(limit = 10): Promise<RecentQuery[]> {
  return json<RecentQuery[]>(await apiFetch(`${BASE}/queries/recent?limit=${limit}`));
}

export async function getTableData(
  table: string,
  limit = 50
): Promise<Record<string, unknown>[]> {
  return json(await apiFetch(`${BASE}/db/${table}?limit=${limit}`));
}

export async function getEsChunks(filename: string): Promise<EsChunk[]> {
  return json<EsChunk[]>(
    await apiFetch(`${BASE}/es/chunks/${encodeURIComponent(filename)}`)
  );
}

export async function getLogs(): Promise<string[]> {
  return json<string[]>(await apiFetch(`${BASE}/logs`));
}

export async function getLogContent(
  filename: string
): Promise<{ filename: string; content: string }> {
  return json(await apiFetch(`${BASE}/logs/${encodeURIComponent(filename)}`));
}

export async function clearStaleCache(): Promise<{ deleted: number }> {
  return json(await apiFetch(`${BASE}/cache/stale`, { method: "DELETE" }));
}

// ── v1 API (multi-agent workflow) ──────────────────────────────────────────

export interface AskResult extends QueryResult {
  turn_id?: string;
  chat_name?: string;
  follow_up_questions?: string[];
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
  chatId?: string | null,
  model?: string
): Promise<AskResult> {
  const raw = await json<{
    answer: string; chunks: QueryResult["chunks"]; metadata: QueryResult["meta"];
    turn_id?: string; chat_name?: string; follow_up_questions?: string[];
  }>(
    await apiFetch(`${BASE}/v1/queries/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message, sessionId, session_id: chatId ? sessionId : undefined, chat_id: chatId ?? undefined,
        mode, model, agent, language, web_search_enabled: webSearchEnabled,
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
    follow_up_questions: raw.follow_up_questions ?? [],
  };
}

export async function getSkills(): Promise<Skill[]> {
  return json<Skill[]>(await apiFetch(`${BASE}/v1/skills`));
}

export async function resetSession(sessionId: string): Promise<void> {
  await apiFetch(`${BASE}/v1/session/reset`, {
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
  return json<MapDataset[]>(await apiFetch(`${BASE}/map/datasets`));
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
      const res = await apiFetch(`${BASE}/map/metrics?source_file=${encodeURIComponent(sourceFile)}`);
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
  return json<MapDataPoint[]>(await apiFetch(url));
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
  isDense: boolean,
  model?: string
): Promise<{ status: string; session_id: string }> {
  return json(
    await apiFetch(`${BASE}/v1/documents/graph`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, file_names: fileNames, is_dense: isDense, model }),
    })
  );
}

export async function getGraphStatus(sessionId: string): Promise<KgStatus> {
  return json<KgStatus>(
    await apiFetch(`${BASE}/v1/documents/graph/status?session_id=${encodeURIComponent(sessionId)}`)
  );
}

export async function getGraphData(sessionId: string): Promise<KgGraphData> {
  return json<KgGraphData>(
    await apiFetch(`${BASE}/v1/documents/graph/data?session_id=${encodeURIComponent(sessionId)}`)
  );
}

// ── Corpus-wide entity index (built at ingest time, all library documents) ──

function query(params: Record<string, string | number | null | undefined>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== "") q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

export interface EntityHit {
  key: string;
  name: string;
  type: string;
  docs: number;
  mentions: number;
}

export interface EntityDossier {
  key: string;
  name: string;
  type: string;
  doc_count: number;
  mention_count: number;
  documents: { filename: string; doc_type: string | null; mentions: number; pages: string[] }[];
  related: {
    key: string; name: string; entity_type: string; type: string;
    outgoing: boolean; files: string[]; evidence: string | null;
  }[];
  co_occurring: { key: string; name: string; type: string; passages: number; docs: number }[];
  timeline: { date: string; count: number }[];
}

export async function getEntityTypes(): Promise<{ type: string; count: number }[]> {
  return json(await apiFetch(`${BASE}/v1/entities/types`));
}

export async function searchEntities(q: string, type?: string | null, limit = 50): Promise<EntityHit[]> {
  return json(await apiFetch(`${BASE}/v1/entities/search${query({ q, type, limit })}`));
}

export async function getEntityGraph(center?: string | null, limit = 150): Promise<KgGraphData> {
  return json(await apiFetch(`${BASE}/v1/entities/graph${query({ center, limit })}`));
}

export async function getEntityDossier(key: string): Promise<EntityDossier> {
  return json(await apiFetch(`${BASE}/v1/entities/dossier${query({ key })}`));
}

export type TimelineInterval = "day" | "week" | "month" | "quarter" | "year";

export interface TimelineResult {
  buckets: { date: string; count: number }[];
  hits: {
    text: string; source: string; page: string; dates: string[];
    entities: { key: string; name: string }[];
  }[];
  total: number;
  date_min: string | null;
  date_max: string | null;
}

export async function getTimeline(params: {
  start?: string; end?: string; q?: string; entity?: string | null;
  interval?: TimelineInterval; size?: number;
}): Promise<TimelineResult> {
  return json(await apiFetch(`${BASE}/v1/timeline${query(params)}`));
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
  tags?: string[];
  doc_type?: string;
  approval_status?: "approved" | "not_approved" | null;
  sha256?: string | null;
  // ok: matches its fingerprint; mismatch: changed since received; missing: original gone
  integrity_status?: "ok" | "mismatch" | "missing" | null;
}

// owner: created it (or you're an admin); editor: can add/remove files and build the graph;
// viewer: read and ask
export type ContainerAccess = "owner" | "editor" | "viewer";

export interface ContainerShare {
  username: string;
  access: "viewer" | "editor";
}

export interface KnowledgeContainer {
  session_id: string;
  name: string;
  owner: string;
  access: ContainerAccess;     // your access level
  is_pinned: boolean;          // your own pin
  created_at: string;
  timestamp: string;
  chat_count: number;          // your own chats
  files: ContainerFile[];
  file_names: string[];
  is_shared: boolean;          // true when another user owns it and it is shared with you
  shared_by: string | null;    // the owner, for a container shared with you
  shared_with: ContainerShare[];  // who else has access (owners and admins see this)
  share_count: number;
}

export const canEdit = (c: KnowledgeContainer | null | undefined) => c?.access === "owner" || c?.access === "editor";
export const isOwner = (c: KnowledgeContainer | null | undefined) => c?.access === "owner";

// Opening a document goes through the backend, which checks your access to the container
export const containerFileUrl = (containerId: string, filename: string) =>
  `${BASE}/v1/documents/files/${encodeURIComponent(containerId)}/${encodeURIComponent(filename)}`;

// Any library document; admins only (corpus-wide pages)
export const libraryFileUrl = (filename: string) =>
  `${BASE}/v1/documents/library/${encodeURIComponent(filename)}`;

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
  details: { filename: string; status: string; error?: string; duplicate_of?: string }[];
  container: KnowledgeContainer;
}

async function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  return json<T>(
    await apiFetch(`${BASE}${path}`, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  );
}

const enc = encodeURIComponent;

// Your own containers, then the ones shared with you (is_shared tells them apart)
export async function listContainers(): Promise<KnowledgeContainer[]> {
  const res = await send<{ data: { sessions: KnowledgeContainer[]; shared?: KnowledgeContainer[] } }>("/v1/documents/containers", "GET");
  return [...res.data.sessions, ...(res.data.shared ?? [])];
}

// ── Sharing and accounts (admins; auditors may read) ─────────────────────────

export interface ShareEntry extends ContainerShare {
  display_name: string | null;
  is_active: boolean | null;
  granted_by: string;
  granted_at: string;
}

export const listShares = (id: string) =>
  send<{ shares: ShareEntry[] }>(`/v1/admin/containers/${enc(id)}/shares`, "GET").then(r => r.shares);

export const shareContainer = (id: string, username: string, access: "viewer" | "editor") =>
  send<{ shares: ShareEntry[] }>(`/v1/admin/containers/${enc(id)}/shares/${enc(username)}`, "PUT", { access }).then(r => r.shares);

export const unshareContainer = (id: string, username: string) =>
  send<{ shares: ShareEntry[] }>(`/v1/admin/containers/${enc(id)}/shares/${enc(username)}`, "DELETE").then(r => r.shares);

export const listAllContainers = () =>
  send<{ containers: KnowledgeContainer[] }>("/v1/admin/containers", "GET").then(r => r.containers);

export interface UserAccount {
  username: string;
  display_name: string;
  role: "admin" | "user";
  permissions: ("reviewer" | "auditor")[];
  is_active: boolean;
  must_change_password: boolean;
  locked_until: string | null;
  created_by: string | null;
  created_at: string;
  last_login_at: string | null;
}

export const listUsers = () => send<{ users: UserAccount[] }>("/v1/admin/users", "GET").then(r => r.users);

export const createUser = (u: { username: string; password: string; display_name: string; role: string; permissions: string[] }) =>
  send<UserAccount>("/v1/admin/users", "POST", u);

export const updateUser = (username: string, changes: Partial<Pick<UserAccount, "display_name" | "role" | "is_active" | "permissions">>) =>
  send<UserAccount>(`/v1/admin/users/${enc(username)}`, "PATCH", changes);

export const resetUserPassword = (username: string, password: string) =>
  send<UserAccount>(`/v1/admin/users/${enc(username)}/reset-password`, "POST", { password });

export type AuditResult = "success" | "denied" | "not_found" | "rejected" | "error";

export interface AuditEntry {
  id: number;
  seq: number | null;
  actor: string | null;
  role: "admin" | "user" | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  result: AuditResult | null;
  ip: string | null;
  method: string | null;
  route: string | null;
  status_code: number | null;
  duration_ms: number | null;
  detail: Record<string, unknown>;
  created_at: string;
  entry_hash: string | null;
}

export interface AuditFilters {
  actor?: string; action?: string; target_id?: string; since?: string; until?: string;
  result?: AuditResult; role?: "admin" | "user";
}

export const listAudit = (params: AuditFilters & { limit?: number; offset?: number }) =>
  send<{ total: number; entries: AuditEntry[] }>(`/v1/admin/audit${query({ ...params })}`, "GET");

// A plain link: the browser downloads the CSV with the session cookie
export const auditExportUrl = (filters: AuditFilters) => `${BASE}/v1/admin/audit/export${query({ ...filters })}`;

export interface ChainCheck { ok: boolean; entries: number; first_bad_seq: number | null; problem: string | null }

export const verifyAuditChain = () => send<ChainCheck>("/v1/admin/audit/verify", "GET");

// ── Fingerprints and chain of custody ──────────────────────────────────────

export interface CustodyEvent {
  id: number;
  sha256: string | null;
  event: string;
  actor: string | null;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface CustodyRecord {
  filename: string;
  status: string;
  sha256: string | null;
  file_size: number | null;
  file_type: string | null;
  received_at: string | null;
  received_by: string | null;
  received_via: string | null;
  received_into: string | null;
  integrity_status: string | null;
  integrity_checked_at: string | null;
  approval_status: string | null;
  approved_by: string | null;
  total_chunks: number | null;
  doc_type: string | null;
  events: CustodyEvent[];
}

export const getCustody = (filename: string, containerId?: string) =>
  send<CustodyRecord>(`/v1/documents/custody${query({ filename, session_id: containerId })}`, "GET");

export interface IntegrityReport {
  counts: Record<string, number>;
  problems: { filename: string; sha256: string | null; integrity_status: string | null; integrity_checked_at: string | null }[];
  duplicates: { sha256: string; filenames: string[] }[];
  last_run: (Record<string, unknown> & { at: string }) | null;
  chain: { ok: boolean; entries: number; first_bad_id: number | null; problem: string | null };
  audit_chain: ChainCheck;
}

export const getIntegrity = () => send<IntegrityReport>("/v1/admin/integrity", "GET");
export const runIntegrityCheck = () => send<{ status: string }>("/v1/admin/integrity/verify", "POST");

export const setApproval = (filename: string, status: "approved" | "not_approved" | null) =>
  send(`/v1/documents/approval`, "PUT", { filename, status });

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
  return json(await apiFetch(`${BASE}/v1/documents/upload`, { method: "POST", body: fd }));
}

export async function addSources(
  containerId: string, files: File[], libraryFiles: string[], useVision: boolean, replace = false
): Promise<SourceUploadResult> {
  const fd = sourcesForm(files, libraryFiles, useVision, replace);
  fd.append("session_id", containerId);
  return json(await apiFetch(`${BASE}/v1/documents/add-upload`, { method: "POST", body: fd }));
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

export async function generateReport(
  containerId: string,
  templateId = "sitrep",
  model?: string
): Promise<Blob> {
  const res = await apiFetch(`${BASE}/v1/reports/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: containerId, template_id: templateId, model }),
  });
  if (!res.ok) throw new Error(await errorText(res));
  return res.blob();
}

"use client";

import { useState, useEffect, useRef } from "react";
import clsx from "clsx";
import {
  getDocuments,
  deleteDocument,
  uploadDocument,
  getTableData,
  getEsChunks,
  getLogs,
  getLogContent,
  clearStaleCache,
  getHealth,
} from "@/lib/api";
import type { Document, HealthStatus, EsChunk } from "@/lib/types";

type Tab = "ingest" | "elastic" | "postgres" | "logs";

const PG_TABLES = [
  "documents",
  "chunks",
  "query_cache",
  "visual_assets",
  "visual_timeseries",
  "visual_facts",
] as const;

/* ── Status badge ─────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:     "bg-green-100 text-green-700",
    processing: "bg-yellow-100 text-yellow-700",
    failed:     "bg-red-100 text-red-700",
  };
  return (
    <span className={clsx("text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase", map[status] ?? "bg-gray-100 text-gray-600")}>
      {status}
    </span>
  );
}

/* ── Section header ───────────────────────────────────────────────── */
function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-ndap-navy font-bold text-lg">{title}</h2>
      <p className="text-gray-500 text-sm mt-0.5">{sub}</p>
    </div>
  );
}

/* ── File ingestion tab ───────────────────────────────────────────── */
function IngestTab() {
  const [files, setFiles] = useState<File[]>([]);
  const [useVision, setUseVision] = useState(true);
  const [useStructurer, setUseStructurer] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ name: string; status: string; chunks?: number }[]>([]);
  const [docs, setDocs] = useState<Document[]>([]);
  const [deletePending, setDeletePending] = useState<string | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocs = () => {
    setLoadingDocs(true);
    getDocuments()
      .then(setDocs)
      .catch(() => setDocs([]))
      .finally(() => setLoadingDocs(false));
  };

  useEffect(() => { loadDocs(); }, []);

  const handleUpload = async () => {
    if (!files.length) return;
    setUploading(true);
    setProgress([]);

    for (const f of files) {
      setProgress((p) => [...p, { name: f.name, status: "uploading" }]);
      try {
        const res = await uploadDocument(f, useVision, useStructurer);
        setProgress((p) =>
          p.map((r) => r.name === f.name ? { ...r, status: "done", chunks: res.chunks } : r)
        );
      } catch (e) {
        setProgress((p) =>
          p.map((r) => r.name === f.name ? { ...r, status: "error" } : r)
        );
      }
    }

    setUploading(false);
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    loadDocs();
  };

  const confirmDelete = async (fname: string) => {
    try {
      await deleteDocument(fname);
      setDeletePending(null);
      loadDocs();
    } catch {
      setDeletePending(null);
    }
  };

  return (
    <div>
      <SectionHeader
        title="Ingest New Documents"
        sub="Upload PDF, DOCX, Excel, or PPTX files to parse, embed, and index them."
      />

      {/* Upload area */}
      <div
        className="border-2 border-dashed border-ndap-border rounded-2xl p-8 text-center cursor-pointer hover:border-ndap-blue hover:bg-ndap-sky transition-all mb-4"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const dropped = Array.from(e.dataTransfer.files).filter((f) =>
            /\.(pdf|docx|xlsx|xls|pptx|ppt)$/i.test(f.name)
          );
          setFiles((prev) => [...prev, ...dropped]);
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.xlsx,.xls,.pptx,.ppt"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) setFiles(Array.from(e.target.files));
          }}
        />
        <div className="w-12 h-12 rounded-full bg-ndap-sky border border-ndap-border flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-ndap-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className="text-sm font-semibold text-ndap-navy">
          {files.length > 0 ? `${files.length} file(s) selected` : "Click or drag files here"}
        </p>
        <p className="text-xs text-gray-400 mt-1">PDF · DOCX · Excel · PPTX</p>
      </div>

      {/* Options */}
      <div className="flex flex-col gap-3 mb-4">
        {[
          { key: "vision", label: "Extract charts", val: useVision, set: setUseVision },
          { key: "struct", label: "Enrich table rows via LLM Structurer", val: useStructurer, set: setUseStructurer },
        ].map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => opt.set(!opt.val)}
            className={clsx(
              "flex items-center gap-2.5 px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-150",
              opt.val
                ? "bg-ndap-sky border-ndap-blue text-ndap-navy"
                : "bg-white border-gray-200 text-gray-500 hover:border-ndap-border hover:text-gray-700"
            )}
          >
            <span className={clsx(
              "w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 transition-colors",
              opt.val ? "bg-ndap-blue border-ndap-blue" : "bg-white border-gray-300"
            )}>
              {opt.val && (
                <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </span>
            {opt.label}
          </button>
        ))}
      </div>

      <button
        onClick={handleUpload}
        disabled={uploading || !files.length}
        className="flex items-center gap-2 bg-ndap-navy text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-ndap-navyDark disabled:opacity-40 disabled:cursor-not-allowed transition-colors mb-6"
      >
        {uploading && (
          <svg className="w-4 h-4 spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" strokeOpacity={0.3}/>
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
          </svg>
        )}
        Start Ingestion
      </button>

      {/* Progress */}
      {progress.length > 0 && (
        <div className="mb-6 space-y-2">
          {progress.map((p) => (
            <div
              key={p.name}
              className={clsx(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm border",
                p.status === "done"  ? "bg-green-50 border-green-200 text-green-700" :
                p.status === "error" ? "bg-red-50 border-red-200 text-red-700" :
                "bg-blue-50 border-ndap-border text-ndap-blue"
              )}
            >
              <span className="font-mono truncate flex-1">{p.name}</span>
              <span className="font-semibold text-xs whitespace-nowrap">
                {p.status === "done"  ? `✓ ${p.chunks} chunks indexed` :
                 p.status === "error" ? "✗ Failed" : "Processing…"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Indexed files list */}
      <div className="border-t border-ndap-border pt-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-ndap-navy">
            Indexed Files
            <span className="text-gray-400 font-normal text-sm ml-2">({docs.length})</span>
          </h3>
          <button onClick={loadDocs} className="text-xs text-ndap-blue hover:underline">
            Refresh
          </button>
        </div>

        {loadingDocs ? (
          <div className="text-sm text-gray-400 py-4 text-center">Loading…</div>
        ) : docs.length === 0 ? (
          <div className="text-sm text-gray-400 py-4 text-center">No files indexed yet.</div>
        ) : (
          <div className="space-y-2">
            {docs.map((doc) => (
              <div key={doc.filename}>
                {deletePending === doc.filename ? (
                  <div className="flex items-center gap-3 border border-red-300 border-l-4 border-l-red-600 bg-red-50 rounded-xl px-4 py-3">
                    <span className="text-sm text-red-700 flex-1 font-medium">
                      Delete &quot;{doc.filename}&quot; permanently?
                    </span>
                    <button
                      onClick={() => confirmDelete(doc.filename)}
                      className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700"
                    >
                      Yes, delete
                    </button>
                    <button
                      onClick={() => setDeletePending(null)}
                      className="text-xs bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 border border-ndap-border rounded-xl px-4 py-3 bg-white hover:bg-ndap-sky/40 transition-colors">
                    <span className="text-lg">
                      {doc.status === "active" ? "✅" : doc.status === "failed" ? "❌" : "🔄"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ndap-navy truncate">{doc.filename}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        {doc.total_chunks ?? 0} chunks
                        {doc.ocr_executed && " · OCR"}
                        {doc.has_images && ` · ${doc.images_extracted_count ?? 0} images`}
                      </div>
                    </div>
                    <StatusBadge status={doc.status} />
                    {/* <button
                      onClick={() => setDeletePending(doc.filename)}
                      className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button> */}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Elastic tab ──────────────────────────────────────────────────── */
function ElasticTab() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [selected, setSelected] = useState("");
  const [chunks, setChunks] = useState<EsChunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDocuments().then(setDocs).catch(() => setDocs([]));
  }, []);

  const loadChunks = async (fname: string) => {
    setSelected(fname);
    setLoading(true);
    setError(null);
    try {
      const data = await getEsChunks(fname);
      setChunks(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch chunks");
      setChunks([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <SectionHeader
        title="Elasticsearch Index Explorer"
        sub="Inspect raw indexed text and table chunks stored in Elastic."
      />

      {docs.length === 0 ? (
        <div className="text-sm text-gray-400 py-4">No ingested documents found.</div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-5">
            <select
              value={selected}
              onChange={(e) => loadChunks(e.target.value)}
              className="flex-1 text-sm border border-ndap-border rounded-xl px-3 py-2.5 bg-ndap-sky text-ndap-navy focus:outline-none focus:ring-2 focus:ring-ndap-blue"
            >
              <option value="">— Select a file —</option>
              {docs.map((d) => (
                <option key={d.filename} value={d.filename}>{d.filename}</option>
              ))}
            </select>
          </div>

          {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

          {loading ? (
            <div className="text-sm text-gray-400 py-4 text-center">Loading chunks…</div>
          ) : chunks.length > 0 ? (
            <>
              <p className="text-sm text-gray-600 mb-3">
                Found <b className="text-ndap-navy">{chunks.length}</b> chunks for{" "}
                <code className="bg-ndap-sky px-1.5 py-0.5 rounded text-ndap-blue text-xs">{selected}</code>
              </p>
              <div className="space-y-2">
                {chunks.map((c, i) => (
                  <details key={i} className="border border-ndap-border rounded-xl overflow-hidden">
                    <summary className="px-4 py-3 bg-ndap-sky cursor-pointer text-sm font-medium text-ndap-navy hover:bg-blue-100">
                      Chunk [{i + 1}] &nbsp;·&nbsp; Page {c.page ?? "?"} &nbsp;·&nbsp;
                      <span className="text-ndap-blue">{(c.chunk_subtype ?? "text").toUpperCase()}</span>
                    </summary>
                    <div className="p-4 bg-white">
                      <textarea
                        readOnly
                        value={c.text}
                        rows={5}
                        className="w-full text-xs font-mono bg-ndap-sky border border-ndap-border rounded-lg p-2 resize-y text-gray-700 focus:outline-none"
                      />
                      {c.structured_data != null && (
                        <pre className="mt-2 text-xs bg-ndap-navyDark text-blue-200 rounded-lg p-3 overflow-x-auto">
                          {JSON.stringify(c.structured_data as Record<string, unknown>, null, 2)}
                        </pre>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </>
          ) : selected ? (
            <div className="text-sm text-gray-400 py-4 text-center">No chunks found.</div>
          ) : null}
        </>
      )}
    </div>
  );
}

/* ── Postgres tab ─────────────────────────────────────────────────── */
function PostgresTab() {
  const [table, setTable] = useState<string>(PG_TABLES[0]);
  const [limit, setLimit] = useState(50);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [cacheClearing, setCacheClearing] = useState(false);
  const [cacheMsg, setCacheMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getTableData(table, limit);
      setRows(data);
      setCols(data.length > 0 ? Object.keys(data[0]) : []);
    } catch {
      setRows([]);
      setCols([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [table, limit]);

  const handleClearCache = async () => {
    setCacheClearing(true);
    try {
      const res = await clearStaleCache();
      setCacheMsg(`Cleared ${res.deleted} stale cache entries.`);
    } catch {
      setCacheMsg("Cache clear failed.");
    } finally {
      setCacheClearing(false);
      setTimeout(() => setCacheMsg(null), 4000);
    }
  };

  return (
    <div>
      <SectionHeader
        title="PostgreSQL Tables"
        sub="View documents, chunks, visual charts, timeseries data, and query cache."
      />

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select
          value={table}
          onChange={(e) => setTable(e.target.value)}
          className="text-sm border border-ndap-border rounded-xl px-3 py-2.5 bg-ndap-sky text-ndap-navy focus:outline-none focus:ring-2 focus:ring-ndap-blue"
        >
          {PG_TABLES.map((t) => <option key={t}>{t}</option>)}
        </select>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600">Rows:</label>
          <input
            type="range"
            min={10}
            max={200}
            step={10}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="w-28 accent-ndap-blue"
          />
          <span className="text-xs text-gray-600 w-8">{limit}</span>
        </div>

        <button onClick={load} className="text-sm text-ndap-blue hover:underline">
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 py-6 text-center">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-gray-400 py-6 text-center">Table is empty.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ndap-border shadow-sm mb-4">
          <table className="w-full text-xs">
            <thead>
              <tr>
                {cols.map((c) => (
                  <th
                    key={c}
                    className="bg-ndap-navy text-white px-3 py-2.5 text-left font-semibold whitespace-nowrap"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-ndap-sky/40"}>
                  {cols.map((c) => {
                    const val = row[c];
                    const display =
                      val === null ? "—" :
                      typeof val === "object" ? JSON.stringify(val).slice(0, 80) + "…" :
                      String(val).slice(0, 120);
                    return (
                      <td key={c} className="px-3 py-2 text-gray-700 max-w-[200px] truncate border-b border-gray-100" title={String(val ?? "")}>
                        {display}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 mb-6">Showing top {rows.length} rows from <code className="bg-ndap-sky px-1 rounded">{table}</code>.</p>

      {/* Cache management */}
      <div className="border-t border-ndap-border pt-5">
        <h3 className="font-bold text-ndap-navy mb-1">Query Cache Management</h3>
        <p className="text-xs text-gray-500 mb-3">
          Clear stale "sorry" entries from the cache so re-queries hit live retrieval.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={handleClearCache}
            disabled={cacheClearing}
            className="text-sm bg-ndap-error text-white px-4 py-2 rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {cacheClearing ? "Clearing…" : "Clear Stale Cache"}
          </button>
          {cacheMsg && <span className="text-sm text-gray-600">{cacheMsg}</span>}
        </div>
      </div>
    </div>
  );
}

/* ── Logs tab ─────────────────────────────────────────────────────── */
function LogsTab() {
  const [logFiles, setLogFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getLogs().then((files) => {
      setLogFiles(files);
      if (files.length > 0) setSelected(files[0]);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    getLogContent(selected)
      .then((r) => setContent(r.content))
      .catch(() => setContent("Failed to load log."))
      .finally(() => setLoading(false));
  }, [selected]);

  return (
    <div>
      <SectionHeader
        title="System Logs"
        sub="View ingestion pipeline logs generated by the parsing and indexing processes."
      />

      {logFiles.length === 0 ? (
        <div className="text-sm text-gray-400 py-6">No log files found in the logs/ directory.</div>
      ) : (
        <>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="text-sm border border-ndap-border rounded-xl px-3 py-2.5 bg-ndap-sky text-ndap-navy focus:outline-none focus:ring-2 focus:ring-ndap-blue mb-4"
          >
            {logFiles.map((f) => <option key={f}>{f}</option>)}
          </select>

          {loading ? (
            <div className="text-sm text-gray-400 py-4">Loading log…</div>
          ) : (
            <pre className="bg-ndap-navyDark text-blue-200 text-[11px] font-mono rounded-xl p-4 overflow-auto max-h-[60vh] leading-relaxed">
              {content || "Log is empty."}
            </pre>
          )}
        </>
      )}
    </div>
  );
}

/* ── Admin page ───────────────────────────────────────────────────── */
export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("ingest");
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => null);
  }, []);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "ingest",   label: "File Ingestion",   icon: "📂" },
    { id: "elastic",  label: "Chunks",    icon: "🔍" },
    { id: "postgres", label: "Tables",   icon: "🗃️" },
    { id: "logs",     label: "Logs Viewer",       icon: "📋" },
  ];

  return (
    <div className="max-w-screen-xl mx-auto w-full px-4 py-6 overflow-y-auto flex-1">

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ndap-navy">System Administration</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage datasets, view databases, inspect search indices, and monitor system logs.
        </p>
      </div>

      {/* Status bar */}
      {health && (
        <div className="flex flex-wrap items-center gap-4 bg-white border border-ndap-border rounded-2xl px-5 py-3.5 mb-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm">
            <span className={clsx("w-2 h-2 rounded-full", health.postgres ? "bg-ndap-success" : "bg-ndap-error")} />
            <span className="text-gray-700">PostgreSQL</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className={clsx("w-2 h-2 rounded-full", health.elasticsearch ? "bg-ndap-success" : "bg-ndap-error")} />
            <span className="text-gray-700">Elasticsearch</span>
          </div>
          <div className="ml-auto flex gap-4 text-xs text-gray-500">
            <span><b className="text-ndap-navy">{health.stats.total_docs ?? "–"}</b> docs</span>
            <span><b className="text-ndap-navy">{health.stats.total_chunks ?? "–"}</b> chunks</span>
            <span><b className="text-ndap-navy">{health.stats.total_assets ?? "–"}</b> assets</span>
            <span><b className="text-ndap-navy">{health.stats.total_timeseries ?? "–"}</b> ts pts</span>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-ndap-border mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              "flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors",
              tab === t.id
                ? "border-b-2 border-ndap-navy text-ndap-navy"
                : "text-gray-500 hover:text-ndap-blue hover:bg-ndap-sky rounded-t-lg"
            )}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white border border-ndap-border rounded-2xl p-6 shadow-sm">
        {tab === "ingest"   && <IngestTab />}
        {tab === "elastic"  && <ElasticTab />}
        {tab === "postgres" && <PostgresTab />}
        {tab === "logs"     && <LogsTab />}
      </div>
    </div>
  );
}

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createGraph, getDocuments, getGraphStatus, KgStatus } from "@/lib/api";
import type { Document } from "@/lib/types";

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 20 * 60 * 1000;
const ACTIVE = new Set(["initializing", "processing", "finalizing"]);

const STAGE_TEXT: Record<string, string> = {
  not_started: "Not started",
  initializing: "Initializing…",
  processing: "Extracting entities & relationships…",
  finalizing: "Finalizing graph…",
  completed: "Completed",
  error: "Failed",
};

function formatElapsed(sec: number) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
}

export default function CreateGraph({
  sessionId,
  onCompleted,
  fixedFiles,
  fixedLabel,
}: {
  sessionId: string;
  onCompleted: () => void;
  // Knowledge container mode: the graph is built from exactly these files
  fixedFiles?: string[];
  fixedLabel?: string;
}) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isDense, setIsDense] = useState(false);
  const [status, setStatus] = useState<KgStatus>({ status: "not_started", progress: 0 });
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStarted = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = null;
  }, []);

  const checkStatus = useCallback(async () => {
    try {
      const s = await getGraphStatus(sessionId);
      setStatus(s);
      if (!ACTIVE.has(s.status)) {
        stopPolling();
        if (s.status === "completed") onCompleted();
      } else if (Date.now() - pollStarted.current > POLL_TIMEOUT_MS) {
        stopPolling();
        setTimedOut(true);
      }
      return s;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    }
  }, [sessionId, onCompleted, stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    setTimedOut(false);
    pollStarted.current = Date.now();
    pollTimer.current = setInterval(checkStatus, POLL_INTERVAL_MS);
  }, [checkStatus, stopPolling]);

  const fixedKey = fixedFiles?.join("\n");

  // Documents + current status on mount / session change
  useEffect(() => {
    if (fixedFiles) {
      setDocs(fixedFiles.map(filename => ({ filename, status: "active" })));
      setSelected(new Set(fixedFiles));
    } else {
      getDocuments()
        .then(d => {
          const usable = d.filter(x => x.status !== "failed" && x.status !== "processing");
          setDocs(usable);
          setSelected(new Set(usable.map(x => x.filename)));
        })
        .catch(() => setDocs([]));
    }
  }, [sessionId, fixedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    checkStatus().then(s => { if (s && ACTIVE.has(s.status)) startPolling(); });
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Elapsed-time counter while a build is running
  useEffect(() => {
    if (!ACTIVE.has(status.status) || !status.started_at) return;
    const tick = () => setElapsed(Date.now() / 1000 - (status.started_at ?? 0));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [status.status, status.started_at]);

  const running = ACTIVE.has(status.status);

  async function handleCreate() {
    setError(null);
    try {
      await createGraph(sessionId, [...selected], isDense);
      setStatus({ status: "initializing", progress: 0, started_at: Date.now() / 1000 });
      startPolling();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const toggleDoc = (f: string) => {
    const next = new Set(selected);
    if (next.has(f)) next.delete(f); else next.add(f);
    setSelected(next);
  };

  return (
    <div className="flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-[#e2d9c8]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold text-[#102C57] uppercase tracking-wide">
            {fixedFiles ? `Documents in ${fixedLabel ?? "container"} (${docs.length})` : `Documents (${selected.size}/${docs.length})`}
          </p>
          {!fixedFiles && (
            <div className="flex gap-2 text-[10px] text-[#6b5a3e]">
              <button disabled={running} onClick={() => setSelected(new Set(docs.map(d => d.filename)))} className="hover:underline">All</button>
              <button disabled={running} onClick={() => setSelected(new Set())} className="hover:underline">None</button>
            </div>
          )}
        </div>
        <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1">
          {docs.length === 0 && (
            <p className="text-xs text-[#a09070]">
              {fixedFiles ? "No indexed documents in this container yet" : "No ingested documents"}
            </p>
          )}
          {fixedFiles ? docs.map(d => (
            <p key={d.filename} className="truncate text-xs text-[#1e293b] py-0.5" title={d.filename}>{d.filename}</p>
          )) : docs.map(d => (
            <label key={d.filename} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
              <input
                type="checkbox"
                disabled={running}
                checked={selected.has(d.filename)}
                onChange={() => toggleDoc(d.filename)}
                className="accent-[#102C57]"
              />
              <span className="truncate text-[#1e293b]" title={d.filename}>{d.filename}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 border-b border-[#e2d9c8] space-y-3">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            disabled={running}
            checked={isDense}
            onChange={e => setIsDense(e.target.checked)}
            className="mt-0.5 accent-[#102C57]"
          />
          <span>
            <span className="block text-sm font-medium text-[#1e293b]">Dense graph</span>
            <span className="block text-[11px] text-[#78716c] leading-snug">
              {isDense
                ? "Reads every chunk and extracts explicit + implicit relationships. Slower, richer."
                : "High-level: key entities from the most important sentences only. Faster."}
            </span>
          </span>
        </label>

        <button
          onClick={handleCreate}
          disabled={running || selected.size === 0}
          className="w-full text-sm font-semibold py-2 rounded bg-[#102C57] text-white
                     hover:bg-[#1a3d72] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {running ? "Creating graph…" : status.status === "completed" ? "Rebuild graph" : "Create graph"}
        </button>
        {status.status === "completed" && !running && (
          <p className="text-[11px] text-[#78716c] leading-snug">
            Rebuilding replaces this session&apos;s current graph.
          </p>
        )}
      </div>

      {status.status !== "not_started" && (
        <div className="px-4 py-3 border-b border-[#e2d9c8] text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className={`font-semibold ${status.status === "error" ? "text-[#b91c1c]" : "text-[#102C57]"}`}>
              {STAGE_TEXT[status.status] ?? status.status}
            </span>
            {running && <span className="text-[#78716c] tabular-nums">{formatElapsed(elapsed)}</span>}
          </div>
          {(running || status.status === "completed") && (
            <div className="h-1.5 rounded bg-[#f0ebe0] overflow-hidden">
              <div
                className="h-full bg-[#C9A227] transition-all duration-500"
                style={{ width: `${status.progress ?? 0}%` }}
              />
            </div>
          )}
          {running && status.current_file && (
            <p className="text-[#78716c] truncate" title={status.current_file}>{status.current_file}</p>
          )}
          {status.status === "completed" && (
            <p className="text-[#78716c]">
              {status.nodes} nodes · {status.relationships} relationships
              {status.elapsed_seconds != null && ` · ${formatElapsed(status.elapsed_seconds)}`}
              {status.is_dense != null && ` · ${status.is_dense ? "dense" : "high-level"}`}
            </p>
          )}
          {!!status.failed_windows && (
            <p className="text-[#b45309]">{status.failed_windows} chunk(s) failed extraction and were skipped</p>
          )}
          {status.status === "error" && status.error && (
            <p className="text-[#b91c1c] break-words">{status.error}</p>
          )}
          {timedOut && (
            <div className="text-[#b45309]">
              Still running after 20 minutes.{" "}
              <button onClick={startPolling} className="underline">Keep checking</button>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="px-4 py-2 text-xs text-[#b91c1c] break-words">{error}</p>
      )}
    </div>
  );
}

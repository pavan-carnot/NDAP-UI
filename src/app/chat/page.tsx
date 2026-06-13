"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import clsx from "clsx";
import {
  askQuery,
  getHealth,
  getRecentQueries,
  resetSession,
} from "@/lib/api";
import type { ChatTurn, HealthStatus, RecentQuery, Citation } from "@/lib/types";

/* ── Citation parsing ─────────────────────────────────────────────── */
function parseCitations(answer: string, chunks: ChatTurn["result"]["chunks"]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];

  // New format: [filename.pdf, Page 12]
  const newFmt = /\[([^,\]]+\.(pdf|xlsx|xls|csv))[,\s]+Page[s]?\s+([^\]]+)\]/gi;
  let m: RegExpExecArray | null;
  while ((m = newFmt.exec(answer)) !== null) {
    const key = `${m[1].trim()}::${m[3].trim()}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ source: m[1].trim(), page: m[3].trim(), quote: "" });
    }
  }

  // Old format: [Source: file, Page/Sheet: X, Quote: "..."]
  const oldFmt = /\[Source:\s*([^,\]\n]+),\s*Page\/Sheet:\s*([^,\]\n]+)(?:,\s*Quote:\s*"([^"\n]+)")?\]/g;
  while ((m = oldFmt.exec(answer)) !== null) {
    const key = `${m[1].trim()}::${m[2].trim()}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ source: m[1].trim(), page: m[2].trim(), quote: m[3]?.trim() ?? "" });
    }
  }

  // Fallback to chunk sources
  if (out.length === 0) {
    for (const c of chunks) {
      const key = `${c.source}::${c.page}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ source: c.source, page: String(c.page), quote: "" });
      }
    }
  }
  return out;
}

function stripCitationMarkers(text: string): string {
  return text
    .replace(/\[Source:[^\]]*\]/g, "")
    .replace(/\[[^\]]+\.(pdf|xlsx|xls|csv)[^\]]*\]/gi, "")
    .trim();
}

/* ── Detect generated doc link in answer ─────────────────────────── */
function extractDocLink(answer: string): { url: string; filename: string } | null {
  // Matches markdown: [Download Generated Document (DOCX)](/static/generated_docs/...)
  const mdMatch = answer.match(/\[Download Generated Document[^\]]*\]\((\/static\/generated_docs\/([^\)]+))\)/i);
  if (mdMatch) return { url: mdMatch[1], filename: mdMatch[2] };

  // Fallback: bare URL in answer
  const bare = answer.match(/(\/static\/generated_docs\/([^\s"'\)]+))/);
  if (bare) return { url: bare[1], filename: bare[2] };

  return null;
}

/* ── Status dot ───────────────────────────────────────────────────── */
function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      className={clsx(
        "inline-block w-2 h-2 rounded-full",
        ok ? "bg-ndap-success" : "bg-ndap-error"
      )}
    />
  );
}

/* ── Live trace during loading ────────────────────────────────────── */
const PIPELINE_STEPS = [
  { icon: "🛡️", label: "Safety check",         detail: "Validating query for safety…" },
  { icon: "🧭", label: "Intent classification", detail: "Routing to the right agent node…" },
  { icon: "🔍", label: "Hybrid retrieval",      detail: "Searching datasets (semantic + keyword)…" },
  { icon: "⚙️", label: "Skill execution",       detail: "Running matched skill chain…" },
  { icon: "🗺️", label: "Planning",              detail: "Structuring multi-step retrieval plan…" },
  { icon: "🤖", label: "AI synthesis",          detail: "Generating grounded answer…" },
  { icon: "✅", label: "Validation",            detail: "Checking answer quality…" },
  { icon: "💾", label: "Caching response",      detail: "Saving answer to query cache…" },
];

function LiveTrace({ query }: { query: string }) {
  const [visibleCount, setVisibleCount] = useState(1);

  useEffect(() => {
    setVisibleCount(1);
    const timers = PIPELINE_STEPS.map((_, i) =>
      setTimeout(() => setVisibleCount(i + 2), (i + 1) * 1100)
    );
    return () => timers.forEach(clearTimeout);
  }, [query]);

  const activeIdx = Math.min(visibleCount - 1, PIPELINE_STEPS.length - 1);
  const doneSteps = PIPELINE_STEPS.slice(0, activeIdx);
  const pct = Math.round((activeIdx / PIPELINE_STEPS.length) * 100);

  return (
    <div className="bg-white border border-ndap-border rounded-xl shadow-card anim-in overflow-hidden">
      <div className="px-4 pt-3.5 pb-3 border-b border-ndap-border"
        style={{ background: "linear-gradient(135deg,#EEF4FF 0%,#E3F2FD 100%)" }}>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 spin text-ndap-blue flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" strokeOpacity={0.25}/>
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
            </svg>
            <span className="text-xs font-bold text-ndap-navy uppercase tracking-widest">
              Agent in Progress
            </span>
          </div>
          <span className="text-[11px] font-semibold text-ndap-blue bg-white border border-ndap-border rounded-full px-2.5 py-0.5">
            {activeIdx} / {PIPELINE_STEPS.length}
          </span>
        </div>
        <div className="w-full bg-white/70 rounded-full h-1.5 overflow-hidden border border-ndap-border/40">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: "linear-gradient(90deg,#1565C0,#1E88E5)" }}
          />
        </div>
      </div>

      <div className="px-4 py-3 border-b border-ndap-border/50">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Your Query</p>
        <p className="text-sm text-gray-800 font-medium leading-snug line-clamp-2">{query}</p>
      </div>

      {doneSteps.length > 0 && (
        <div className="px-4 pt-3 pb-2 flex flex-wrap gap-1.5">
          {doneSteps.map((step, i) => (
            <span key={i} className="inline-flex items-center gap-1 bg-green-50 border border-green-200 text-green-700 rounded-full px-2.5 py-1 text-[11px] font-medium anim-in">
              <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              {step.icon} {step.label}
            </span>
          ))}
        </div>
      )}

      <div className="mx-4 my-2 rounded-xl border-2 border-ndap-blue/30 bg-ndap-sky/40 px-4 py-3 anim-in"
        style={{ boxShadow: "0 0 0 3px rgba(21,101,192,0.08)" }}>
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-ndap-blue/10 border-2 border-ndap-blue/30 flex items-center justify-center">
              <span className="text-base leading-none">{PIPELINE_STEPS[activeIdx].icon}</span>
            </div>
            <span className="absolute inset-0 rounded-full border-2 border-ndap-blue/40 animate-ping" style={{ animationDuration: "1.5s" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-ndap-navy">{PIPELINE_STEPS[activeIdx].label}</p>
            <p className="text-[11px] text-ndap-blue mt-0.5">{PIPELINE_STEPS[activeIdx].detail}</p>
          </div>
          <svg className="w-4 h-4 spin text-ndap-blue flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" strokeOpacity={0.2}/>
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      {activeIdx < PIPELINE_STEPS.length - 1 && (
        <div className="px-4 pb-4 pt-1 flex flex-wrap gap-x-4 gap-y-0.5">
          {PIPELINE_STEPS.slice(activeIdx + 1).map((step, i) => (
            <span key={i} className="text-[11px] text-gray-300 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-gray-200 inline-block" />
              {step.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Citation chip ────────────────────────────────────────────────── */
function CitationChip({ cit }: { cit: Citation }) {
  const isPdf = cit.source.toLowerCase().endsWith(".pdf");
  const label = isPdf ? `p.${cit.page}` : `sheet ${cit.page}`;
  return (
    <a
      href={`/static/${encodeURIComponent(cit.source)}${isPdf ? `#page=${cit.page}` : ""}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 bg-ndap-sky border border-ndap-border rounded-full px-3 py-1 text-xs text-ndap-blue font-medium hover:bg-ndap-blue hover:text-white transition-colors duration-150"
    >
      <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
        <path d="M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4l-4-4H4zm5 1v3h3L9 1zM4 8h8v1H4V8zm0 2h8v1H4v-1zm0 2h5v1H4v-1z"/>
      </svg>
      <span className="max-w-[160px] truncate">{cit.source}</span>
      <span className="text-[10px] opacity-70">{label}</span>
    </a>
  );
}

/* ── Document preview modal ───────────────────────────────────────── */
function DocModal({ url, filename, onClose }: { url: string; filename: string; onClose: () => void }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch document (${res.status})`);
        const arrayBuffer = await res.arrayBuffer();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mammoth = await import("mammoth") as any;
        const m = mammoth.default ?? mammoth;
        const result = await m.convertToHtml({ arrayBuffer });
        setHtml(result.value);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load document");
      }
    })();
  }, [url]);

  const handleDownload = async () => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      /* ignore */
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-ndap-border bg-ndap-sky">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-lg">📄</span>
            <span className="text-sm font-semibold text-ndap-navy truncate">{filename}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/>
              </svg>
              Download
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-ndap-border transition-colors text-ndap-navy"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
              </svg>
            </button>
          </div>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {error ? (
            <div className="text-red-600 text-sm">{error}</div>
          ) : html === null ? (
            <div className="flex items-center gap-3 text-ndap-navy text-sm">
              <svg className="w-5 h-5 spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" strokeOpacity={0.25}/>
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
              </svg>
              Loading document…
            </div>
          ) : (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

/* ── Generated document card ──────────────────────────────────────── */
function DocCard({ url, filename }: { url: string; filename: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="border border-amber-200 border-l-4 border-l-amber-500 bg-amber-50 rounded-xl px-4 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center flex-shrink-0 text-lg">
            📄
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-amber-900 truncate">{filename}</div>
            <div className="text-[11px] text-amber-700 mt-0.5">Generated document ready</div>
          </div>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex-shrink-0 flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
          </svg>
          View Document
        </button>
      </div>
      {open && <DocModal url={url} filename={filename} onClose={() => setOpen(false)} />}
    </>
  );
}

/* ── Trace accordion ──────────────────────────────────────────────── */
function TracePanel({ turn }: { turn: ChatTurn }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"steps" | "perf" | "chunks">("steps");
  const { meta, chunks } = turn.result;

  return (
    <div className="mt-2 rounded-lg border border-ndap-border overflow-hidden text-xs">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-ndap-sky hover:bg-blue-100 transition-colors text-left"
      >
        <span className="text-ndap-navy font-semibold tracking-wide uppercase text-[10px]">
          Agent Trace & Diagnostics
        </span>
        <svg
          className={clsx("w-3.5 h-3.5 text-ndap-blue transition-transform", open && "rotate-180")}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
        </svg>
      </button>

      {open && (
        <div className="bg-white">
          <div className="flex border-b border-ndap-border">
            {(["steps", "perf", "chunks"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={clsx(
                  "px-4 py-2 text-[11px] font-semibold uppercase tracking-wide transition-colors",
                  tab === t
                    ? "border-b-2 border-ndap-blue text-ndap-blue"
                    : "text-gray-500 hover:text-ndap-navy"
                )}
              >
                {t === "steps" ? "Steps" : t === "perf" ? "Performance" : "Chunks"}
              </button>
            ))}
          </div>

          <div className="p-4">
            {tab === "steps" && (
              <ol className="space-y-1.5">
                {meta.execution_trace?.length > 0 ? (
                  meta.execution_trace.map((step, i) => {
                    const isNode = step.startsWith("[");
                    const isReason = step.includes("💭");
                    return (
                      <li key={i} className={clsx(
                        "flex gap-2 leading-relaxed",
                        isNode && "font-semibold text-ndap-navy",
                        isReason && "text-amber-700 italic",
                        !isNode && !isReason && "text-gray-600"
                      )}>
                        <span className="text-ndap-blue font-bold min-w-[18px]">{i + 1}.</span>
                        <span>{step}</span>
                      </li>
                    );
                  })
                ) : (
                  <p className="text-gray-400 italic">No trace recorded.</p>
                )}
              </ol>
            )}

            {tab === "perf" && (
              <div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  {[
                    { label: "Time", value: `${meta.time_seconds}s` },
                    { label: "Tokens Out", value: meta.tokens_out?.toLocaleString() ?? "–" },
                  ].map((m) => (
                    <div key={m.label} className="bg-ndap-sky rounded-lg p-2.5 text-center">
                      <div className="text-ndap-navy font-bold text-sm">{m.value}</div>
                      <div className="text-gray-500 text-[10px] mt-0.5">{m.label}</div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className={clsx(
                    "px-2 py-0.5 rounded-full font-semibold",
                    meta.cached ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                  )}>
                    Cache: {meta.cached ? "Hit ✓" : "Miss"}
                  </span>
                </div>
                {meta.calc_log?.map((entry, i) => (
                  <div key={i} className={clsx(
                    "mt-2 rounded-lg p-2.5 border text-[11px]",
                    entry.result.error
                      ? "bg-red-50 border-red-200 text-red-700"
                      : "bg-green-50 border-green-200 text-green-700"
                  )}>
                    <code className="block font-mono mb-1">{entry.code}</code>
                    <span className="font-semibold">
                      {entry.result.error ? `Error: ${entry.result.error}` : `Result: ${entry.result.result}`}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {tab === "chunks" && (
              <div className="space-y-2">
                {chunks.length > 0 ? (
                  chunks.map((c, i) => (
                    <div key={i} className="border border-ndap-border rounded-lg p-3 bg-ndap-sky/40">
                      <div className="font-semibold text-ndap-navy">
                        [{i + 1}] {c.source}
                        {c.figure_id && <span className="text-gray-400 font-normal ml-1">| {c.figure_id}</span>}
                      </div>
                      <div className="text-gray-500 text-[10px] mt-0.5 mb-1.5">
                        Page {c.page} &middot; {c.search_type?.toUpperCase()} &middot; score {c.score?.toFixed(4)}
                      </div>
                      <div className="text-gray-600 leading-relaxed line-clamp-3">
                        {c.text?.slice(0, 240)}…
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 italic">No chunks retrieved.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Message card ─────────────────────────────────────────────────── */
function MessageCard({ turn }: { turn: ChatTurn }) {
  const { answer, chunks, meta } = turn.result;
  const docLink = extractDocLink(answer);
  const citations = parseCitations(answer, chunks);
  const cleanAnswer = stripCitationMarkers(answer);

  return (
    <div className="anim-in space-y-2">
      {/* User bubble */}
      <div className="flex justify-end">
        <div className="max-w-2xl bg-ndap-navy text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-widest text-blue-200 mb-1">You</div>
          <div className="text-sm leading-relaxed">{turn.query}</div>
        </div>
      </div>

      {/* Answer card */}
      {meta.blocked ? (
        <div className="border border-red-300 border-l-4 border-l-red-600 bg-red-50 rounded-xl px-4 py-3">
          <div className="text-red-700 font-bold text-sm mb-1">Access Denied</div>
          <div className="text-red-600 text-sm">{answer}</div>
        </div>
      ) : (
        <div className="bg-white border border-ndap-border rounded-xl shadow-card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-ndap-navy flex items-center justify-center">
                <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm1 11H9v-2h2v2zm0-4H9V7h2v2z"/>
                </svg>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                NDAP Analysis
              </span>
            </div>
            <span className="text-[10px] text-gray-400">
              {turn.timestamp.toLocaleTimeString()}
            </span>
          </div>

          <div className="ndap-prose text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanAnswer}</ReactMarkdown>
          </div>

          {citations.length > 0 && (
            <div className="mt-4 pt-3.5 border-t border-gray-100">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Sources</div>
              <div className="flex flex-wrap gap-2">
                {citations.map((c, i) => <CitationChip key={i} cit={c} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Generated document download card */}
      {docLink && <DocCard url={docLink.url} filename={docLink.filename} />}

      <TracePanel turn={turn} />
    </div>
  );
}

/* ── Empty state ──────────────────────────────────────────────────── */
function EmptyState({ onSample }: { onSample: (q: string) => void }) {
  const samples = [
    { q: "What is the total slum population in India as per the census?",          tag: "RAG" },
    { q: "Show dengue cases trend in Maharashtra from 2015 to 2022",               tag: "RAG" },
    { q: "Compare TB incidence rates across Indian states",                         tag: "RAG" },
    { q: "Draft an email summarizing the dengue situation and requesting action.",  tag: "Skill" },
    { q: "Generate an executive summary report on India's AQI situation.",          tag: "Doc" },
  ];

  const tagColors: Record<string, string> = {
    RAG:   "bg-blue-50 text-blue-600 border-blue-200",
    Skill: "bg-purple-50 text-purple-600 border-purple-200",
    Doc:   "bg-amber-50 text-amber-600 border-amber-200",
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-20 h-20 rounded-2xl bg-ndap-sky border-2 border-ndap-border flex items-center justify-center mb-6 shadow-card">
        <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none">
          <rect width="48" height="48" rx="10" fill="#E3F2FD"/>
          <rect x="8"  y="30" width="7" height="10" rx="1.5" fill="#FF9933"/>
          <rect x="20" y="22" width="7" height="18" rx="1.5" fill="#1565C0"/>
          <rect x="32" y="14" width="7" height="26" rx="1.5" fill="#003087"/>
          <polyline points="8,28 20,20 32,12" stroke="#1565C0" strokeWidth="2" fill="none" strokeLinecap="round"/>
        </svg>
      </div>
      <h2 className="text-ndap-navy font-bold text-xl mb-2">Government Dataset Intelligence</h2>
      <p className="text-gray-500 text-sm mb-1">Ask questions, draft emails, or generate reports from indexed government datasets.</p>
      <p className="text-gray-400 text-xs mb-8">Census · PLFS · NFHS · AQI · TB · Dengue · and more</p>

      <div className="w-full max-w-xl">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Try asking</p>
        <div className="grid gap-2">
          {samples.map(({ q, tag }) => (
            <button
              key={q}
              onClick={() => onSample(q)}
              className="text-left text-sm text-ndap-blue bg-white border border-ndap-border rounded-xl px-4 py-3 hover:bg-ndap-sky hover:border-ndap-blue transition-colors shadow-sm flex items-start justify-between gap-3"
            >
              <span>{q}</span>
              <span className={clsx("text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 mt-0.5", tagColors[tag])}>
                {tag}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────── */
export default function ChatPage() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingQuery, setPendingQuery] = useState("");
  const [input, setInput] = useState("");
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [recentQueries, setRecentQueries] = useState<RecentQuery[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => null);
    getRecentQueries(10).then(setRecentQueries).catch(() => null);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, loading]);

  const submitQuery = useCallback(
    async (q: string) => {
      if (!q.trim() || loading) return;
      setError(null);
      setLoading(true);
      setPendingQuery(q.trim());
      setInput("");

      // Generate session ID on first query and reuse for the conversation
      const sid = sessionId ?? crypto.randomUUID().slice(0, 8);
      if (!sessionId) setSessionId(sid);

      try {
        const result = await askQuery(q.trim(), sid);
        setTurns((prev) => [
          ...prev,
          { id: crypto.randomUUID(), query: q.trim(), result, timestamp: new Date() },
        ]);
        getRecentQueries(10).then(setRecentQueries).catch(() => null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Query failed. Is the backend running?");
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [loading, sessionId]
  );

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitQuery(input);
    }
  };

  const startNew = useCallback(() => {
    if (sessionId) resetSession(sessionId).catch(() => null);
    setTurns([]);
    setSessionId(null);
    setError(null);
    inputRef.current?.focus();
  }, [sessionId]);

  const toggleMic = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    if (isListening) {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      setIsListening(false);
      return;
    }

    const startRec = (existingTranscript: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rec = new ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)();
      rec.lang = "en-IN";
      rec.interimResults = true;
      rec.continuous = true;
      rec.maxAlternatives = 1;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (e: any) => {
        let final = existingTranscript;
        let interim = "";
        for (let i = 0; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            final += e.results[i][0].transcript + " ";
          } else {
            interim += e.results[i][0].transcript;
          }
        }
        setInput((final + interim).trimStart());
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onerror = (ev: any) => {
        if (ev.error === "not-allowed") {
          recognitionRef.current = null;
          setIsListening(false);
        }
      };

      rec.onend = () => {
        if (recognitionRef.current) {
          const carried = (inputRef.current?.value ?? "").trimEnd() + " ";
          const next = startRec(carried.trimStart());
          recognitionRef.current = next;
          next.start();
        }
      };

      return rec;
    };

    const rec = startRec("");
    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
  }, [isListening]);

  return (
    <div className="flex-1 flex max-w-screen-xl mx-auto w-full px-4 py-4 gap-4 overflow-hidden min-h-0">

      {/* ── Left sidebar ─────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-64 xl:w-72 flex-shrink-0 gap-3 overflow-y-auto">

        <button
          onClick={startNew}
          className="w-full flex items-center justify-center gap-2 bg-ndap-navy text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-ndap-navyDark transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/>
          </svg>
          New Analysis
        </button>

        {/* Recent queries */}
        <div className="bg-white border border-ndap-border rounded-xl shadow-sm flex-1 overflow-auto flex flex-col min-h-0">
          <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-ndap-border/60 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-ndap-blue" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
              </svg>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Recent Sessions</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {recentQueries.length > 0 ? (
              <div className="space-y-1">
                {recentQueries.map((rq) => {
                  const ts = rq.cached_at
                    ? new Date(rq.cached_at).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                    : null;
                  return (
                    <button
                      key={rq.hash}
                      onClick={() => submitQuery(rq.text)}
                      className="group w-full text-left rounded-lg px-2.5 py-2 hover:bg-ndap-sky border border-transparent hover:border-ndap-border transition-all duration-150"
                    >
                      <div className="flex items-start gap-2">
                        <svg className="w-3 h-3 mt-0.5 flex-shrink-0 text-gray-300 group-hover:text-ndap-blue transition-colors" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-700 group-hover:text-ndap-navy leading-snug break-words whitespace-normal transition-colors">{rq.text}</p>
                          {ts && <p className="text-[10px] text-gray-400 mt-1">{ts}</p>}
                        </div>
                        <svg className="w-3 h-3 flex-shrink-0 text-gray-200 group-hover:text-ndap-blue opacity-0 group-hover:opacity-100 transition-all mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
                        </svg>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-10 h-10 rounded-full bg-ndap-sky border border-ndap-border flex items-center justify-center mb-2">
                  <svg className="w-5 h-5 text-gray-300" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
                  </svg>
                </div>
                <p className="text-xs text-gray-400">No recent sessions yet.</p>
                <p className="text-[10px] text-gray-300 mt-0.5">Ask your first question above</p>
              </div>
            )}
          </div>
        </div>

        {/* System status */}
        {health && (
          <div className="bg-white border border-ndap-border rounded-xl p-3 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5">System Status</p>
            <div className="space-y-1.5 text-xs text-gray-700">
              <div className="flex items-center gap-2">
                <Dot ok={health.postgres} />
                <span>{health.postgres ? "PostgreSQL Connected" : "PostgreSQL Offline"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Dot ok={health.elasticsearch} />
                <span>{health.elasticsearch ? "Elasticsearch Online" : "Elasticsearch Offline"}</span>
              </div>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-gray-100 grid grid-cols-2 gap-1.5 text-[11px] text-gray-600">
              <div><b className="text-ndap-navy">{health.stats.total_docs ?? "–"}</b> indexed files</div>
              <div><b className="text-ndap-navy">{health.stats.total_chunks ?? "–"}</b> chunks</div>
              <div><b className="text-ndap-navy">{health.stats.total_assets ?? "–"}</b> visual assets</div>
              <div><b className="text-ndap-navy">{health.stats.total_timeseries ?? "–"}</b> timeseries pts</div>
            </div>
          </div>
        )}
      </aside>

      {/* ── Main chat column ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {error && (
          <div className="mb-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-y-auto">
          {turns.length === 0 && !loading ? (
            <EmptyState onSample={submitQuery} />
          ) : (
            <div className="space-y-6 pb-4">
              {turns.map((t) => <MessageCard key={t.id} turn={t} />)}
              {loading && <LiveTrace query={pendingQuery} />}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* ── Input bar ────────────────────────────────────────── */}
        <div className="mt-4 bg-white border border-ndap-border rounded-2xl shadow-card focus-within:border-ndap-blue focus-within:shadow-card-hover transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask a question, request an email draft, or generate a report… (Enter to send)"
            rows={2}
            disabled={loading}
            className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none disabled:opacity-50"
          />
          <div className="flex items-center justify-between px-4 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400">
                {sessionId ? `Session: ${sessionId}` : "New session"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMic}
                disabled={loading}
                title={isListening ? "Stop recording" : "Voice input"}
                className={clsx(
                  "flex items-center justify-center w-9 h-9 rounded-xl border transition-all",
                  isListening
                    ? "bg-red-500 border-red-500 text-white shadow-md"
                    : "border-ndap-border text-gray-400 hover:text-ndap-blue hover:border-ndap-blue hover:bg-ndap-sky",
                  "disabled:opacity-40 disabled:cursor-not-allowed"
                )}
              >
                {isListening ? (
                  <svg viewBox="0 0 24 24" className="w-4 h-4 animate-pulse" fill="currentColor">
                    <rect x="2" y="9" width="2" height="6" rx="1"/>
                    <rect x="6" y="6" width="2" height="12" rx="1"/>
                    <rect x="10" y="3" width="2" height="18" rx="1"/>
                    <rect x="14" y="6" width="2" height="12" rx="1"/>
                    <rect x="18" y="9" width="2" height="6" rx="1"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                )}
              </button>
              <button
                onClick={() => submitQuery(input)}
                disabled={loading || !input.trim()}
                className="flex items-center gap-2 bg-ndap-navy text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-ndap-navyDark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <svg className="w-4 h-4 spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="10" strokeOpacity={0.3}/>
                    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
                  </svg>
                )}
                Analyse
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-[10px] text-gray-400 mt-2">
          Responses are grounded exclusively in indexed government datasets. &nbsp;·&nbsp; NDAP GovData Intelligence POC
        </p>
      </div>
    </div>
  );
}

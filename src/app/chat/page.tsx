"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import clsx from "clsx";
import {
  runQuery,
  getHealth,
  getRecentQueries,
} from "@/lib/api";
import type { ChatTurn, HealthStatus, RecentQuery, Citation } from "@/lib/types";

/* ── Citation parsing ─────────────────────────────────────────────── */
function parseCitations(answer: string, chunks: ChatTurn["result"]["chunks"]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  const pattern = /\[Source:\s*([^,\]\n]+),\s*Page\/Sheet:\s*([^,\]\n]+)(?:,\s*Quote:\s*"([^"\n]+)")?\]/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(answer)) !== null) {
    const key = `${m[1].trim()}::${m[2].trim()}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ source: m[1].trim(), page: m[2].trim(), quote: m[3]?.trim() ?? "" });
    }
  }
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
  return text.replace(/\[Source:[^\]]*\]/g, "").trim();
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
  { icon: "🌐", label: "Language detection",    detail: "Detecting language & translating…" },
  { icon: "🧠", label: "Intent classification", detail: "Identifying query intent & metric…" },
  { icon: "🔍", label: "Hybrid retrieval",      detail: "Searching datasets (semantic + keyword)…" },
  { icon: "📄", label: "Context assembly",      detail: "Ranking & assembling retrieved chunks…" },
  { icon: "🤖", label: "AI analysis",           detail: "Calling AI model for deep analysis…" },
  { icon: "🔢", label: "Calculation check",     detail: "Verifying numbers & cross-checking…" },
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

      {/* ── Header with progress bar ─────────────────────────────── */}
      <div className="px-4 pt-3.5 pb-3 border-b border-ndap-border"
        style={{ background: "linear-gradient(135deg,#EEF4FF 0%,#E3F2FD 100%)" }}>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 spin text-ndap-blue flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" strokeOpacity={0.25}/>
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
            </svg>
            <span className="text-xs font-bold text-ndap-navy uppercase tracking-widest">
              Analysis in Progress
            </span>
          </div>
          <span className="text-[11px] font-semibold text-ndap-blue bg-white border border-ndap-border rounded-full px-2.5 py-0.5">
            {activeIdx} / {PIPELINE_STEPS.length}
          </span>
        </div>
        {/* progress bar */}
        <div className="w-full bg-white/70 rounded-full h-1.5 overflow-hidden border border-ndap-border/40">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: "linear-gradient(90deg,#1565C0,#1E88E5)" }}
          />
        </div>
      </div>

      {/* ── Query ───────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-ndap-border/50">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Your Query</p>
        <p className="text-sm text-gray-800 font-medium leading-snug line-clamp-2">{query}</p>
      </div>

      {/* ── Completed steps as chips ─────────────────────────────── */}
      {doneSteps.length > 0 && (
        <div className="px-4 pt-3 pb-2 flex flex-wrap gap-1.5">
          {doneSteps.map((step, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 bg-green-50 border border-green-200 text-green-700 rounded-full px-2.5 py-1 text-[11px] font-medium anim-in"
            >
              <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              {step.icon} {step.label}
            </span>
          ))}
        </div>
      )}

      {/* ── Active step ─────────────────────────────────────────── */}
      <div className="mx-4 my-2 rounded-xl border-2 border-ndap-blue/30 bg-ndap-sky/40 px-4 py-3 anim-in"
        style={{ boxShadow: "0 0 0 3px rgba(21,101,192,0.08)" }}>
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-ndap-blue/10 border-2 border-ndap-blue/30 flex items-center justify-center">
              <span className="text-base leading-none">{PIPELINE_STEPS[activeIdx].icon}</span>
            </div>
            {/* pulsing ring */}
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

      {/* ── Upcoming steps ──────────────────────────────────────── */}
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
          Trace & Diagnostics
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
          {/* tabs */}
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
                {meta.execution_trace.length > 0 ? (
                  meta.execution_trace
                    // hide "LLM Call: Calling <model>..." step
                    .filter((step) => !step.startsWith("LLM Call: Calling "))
                    .map((step, i) => (
                      <li key={i} className="flex gap-2 text-gray-700 leading-relaxed">
                        <span className="text-ndap-blue font-bold min-w-[18px]">{i + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))
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
                    // { label: "Cost", value: `$${meta.cost_usd.toFixed(5)}` },
                    // { label: "Tokens In", value: meta.tokens_in.toLocaleString() },
                    { label: "Tokens Out", value: meta.tokens_out.toLocaleString() },
                  ].map((m) => (
                    <div key={m.label} className="bg-ndap-sky rounded-lg p-2.5 text-center">
                      <div className="text-ndap-navy font-bold text-sm">{m.value}</div>
                      <div className="text-gray-500 text-[10px] mt-0.5">{m.label}</div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span
                    className={clsx(
                      "px-2 py-0.5 rounded-full font-semibold",
                      meta.cached
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    )}
                  >
                    Cache: {meta.cached ? "Hit ✓" : "Miss"}
                  </span>
                </div>
                {meta.calc_log?.map((entry, i) => (
                  <div
                    key={i}
                    className={clsx(
                      "mt-2 rounded-lg p-2.5 border text-[11px]",
                      entry.result.error
                        ? "bg-red-50 border-red-200 text-red-700"
                        : "bg-green-50 border-green-200 text-green-700"
                    )}
                  >
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
                    <div
                      key={i}
                      className="border border-ndap-border rounded-lg p-3 bg-ndap-sky/40"
                    >
                      <div className="font-semibold text-ndap-navy">
                        [{i + 1}] {c.source}
                        {c.figure_id && <span className="text-gray-400 font-normal ml-1">| {c.figure_id}</span>}
                      </div>
                      <div className="text-gray-500 text-[10px] mt-0.5 mb-1.5">
                        Page {c.page} &middot; {c.search_type.toUpperCase()} &middot; score {c.score.toFixed(4)}
                      </div>
                      <div className="text-gray-600 leading-relaxed line-clamp-3">
                        {c.text.slice(0, 240)}…
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
          {/* label */}
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

          {/* markdown body */}
          <div className="ndap-prose text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanAnswer}</ReactMarkdown>
          </div>

          {/* citations */}
          {citations.length > 0 && (
            <div className="mt-4 pt-3.5 border-t border-gray-100">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                Sources
              </div>
              <div className="flex flex-wrap gap-2">
                {citations.map((c, i) => (
                  <CitationChip key={i} cit={c} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <TracePanel turn={turn} />
    </div>
  );
}

/* ── Empty state ──────────────────────────────────────────────────── */
function EmptyState({ onSample }: { onSample: (q: string) => void }) {
  const samples = [
    "What is the total slum population in India as per the census?",
    "Show dengue cases trend in Maharashtra from 2015 to 2022",
    "Compare TB incidence rates across Indian states",
    "What is the unemployment rate under PLFS 2023?",
    "Rank states by AQI pollution levels",
  ];

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
      <h2 className="text-ndap-navy font-bold text-xl mb-2">
        Government Dataset Intelligence
      </h2>
      <p className="text-gray-500 text-sm mb-1">
        Ask questions about indexed government datasets.
      </p>
      <p className="text-gray-400 text-xs mb-8">
        Census · PLFS · NFHS · AQI · TB · Dengue · and more
      </p>

      <div className="w-full max-w-xl">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
          Try asking
        </p>
        <div className="grid gap-2">
          {samples.map((q) => (
            <button
              key={q}
              onClick={() => onSample(q)}
              className="text-left text-sm text-ndap-blue bg-white border border-ndap-border rounded-xl px-4 py-3 hover:bg-ndap-sky hover:border-ndap-blue transition-colors shadow-sm"
            >
              {q}
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
  const model = "gemini";
  const geminiVariant = "gemini-2.5-flash";
  const [loading, setLoading] = useState(false);
  const [pendingQuery, setPendingQuery] = useState("");
  const [input, setInput] = useState("");
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [recentQueries, setRecentQueries] = useState<RecentQuery[]>([]);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

      try {
        const effectiveModel = model === "gemini" ? geminiVariant : "claude";
        const result = await runQuery(q.trim(), sessionId, effectiveModel);
        setSessionId(result.session_id);
        setTurns((prev) => [
          ...prev,
          { id: crypto.randomUUID(), query: q.trim(), result, timestamp: new Date() },
        ]);
        // refresh recent queries
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

  const startNew = () => {
    setTurns([]);
    setSessionId(null);
    setError(null);
    inputRef.current?.focus();
  };

  return (
    <div className="flex-1 flex max-w-screen-xl mx-auto w-full px-4 py-4 gap-4 overflow-hidden min-h-0">

      {/* ── Left sidebar ─────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-64 xl:w-72 flex-shrink-0 gap-3 overflow-y-auto">

        {/* New session */}
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
          {/* header */}
          <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-ndap-border/60 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-ndap-blue" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
              </svg>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Recent Sessions
              </span>
            </div>
          </div>

          {/* list */}
          <div className="flex-1 overflow-y-auto p-2">
            {recentQueries.length > 0 ? (
              <div className="space-y-1">
                {recentQueries.map((rq) => {
                  const ts = rq.cached_at
                    ? new Date(rq.cached_at).toLocaleString("en-IN", {
                        month: "short", day: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })
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
                          <p className="text-xs text-gray-700 group-hover:text-ndap-navy leading-snug break-words whitespace-normal transition-colors">
                            {rq.text}
                          </p>
                          {ts && (
                            <p className="text-[10px] text-gray-400 mt-1">{ts}</p>
                          )}
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
                <p className="text-xs text-gray-400">No recent Sessions yet.</p>
                <p className="text-[10px] text-gray-300 mt-0.5">Ask your first question above</p>
              </div>
            )}
          </div>
        </div>

        {/* System status */}
        {health && (
          <div className="bg-white border border-ndap-border rounded-xl p-3 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5">
              System Status
            </p>
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

        {/* messages / empty state */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {turns.length === 0 && !loading ? (
            <EmptyState onSample={submitQuery} />
          ) : (
            <div className="space-y-6 pb-4">
              {turns.map((t) => (
                <MessageCard key={t.id} turn={t} />
              ))}
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
            placeholder="Ask a question about government datasets (Shift+Enter for new line)"
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

        <p className="text-center text-[10px] text-gray-400 mt-2">
          Responses are grounded exclusively in indexed government datasets. &nbsp;·&nbsp; NDAP GovData Intelligence POC
        </p>
      </div>
    </div>
  );
}

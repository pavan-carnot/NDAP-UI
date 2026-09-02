"use client";

import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
const PdfPanel = lazy(() => import("@/components/PdfPanel"));
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import clsx from "clsx";
import {
  askQuery,
  getHealth,
  getRecentQueries,
  resetSession,
  approveSpeechPlan,
  reviseSpeechPlan,
  initSpeechWizard,
  checkSpeechHistoricalRef,
  proposeSpeechPlan,
  searchSpeechArchive,
} from "@/lib/api";
import CitationMaps from "@/components/CitationMaps";
import type { ChatTurn, HealthStatus, RecentQuery, Citation } from "@/lib/types";
import { useSidebar } from "@/lib/sidebar-context";
import { useLanguage } from "@/lib/language-context";
import { isAuthenticated } from "@/lib/auth";
import { useRouter } from "next/navigation";

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

/* ── Inline citation processing ───────────────────────────────────── */
interface InlineCit { source: string; page: string; quote: string; }

function buildInlineCitations(
  rawAnswer: string,
  chunks: ChatTurn["result"]["chunks"],
  isEmail = false
): { processedText: string; citations: InlineCit[] } {
  const citations: InlineCit[] = [];
  const keyToIdx = new Map<string, number>();

  function getIdx(source: string, page: string, quote = ""): number {
    const key = `${source}::${page}`;
    if (!keyToIdx.has(key)) {
      keyToIdx.set(key, citations.length);
      citations.push({ source, page, quote });
    }
    return keyToIdx.get(key)!;
  }

  // If it's an email draft, extract references but do not render inline bracket links in the text
  if (isEmail) {
    let result = rawAnswer.replace(
      /\[([^,\]]+\.(pdf|xlsx|xls|csv))[,\s]+Pages?\s+([^\]]+)\]/gi,
      (_, filename, _ext, pageStr) => {
        getIdx(filename.trim(), pageStr.trim());
        return "";
      }
    );

    result = result.replace(
      /\[Source:\s*([^,\]\n]+),\s*Page\/Sheet:\s*([^,\]\n]+)(?:,\s*Quote:\s*"([^"\n]+)")?\]/g,
      (_, filename, pageStr, quote) => {
        getIdx(filename.trim(), pageStr.trim(), quote?.trim() ?? "");
        return "";
      }
    );

    // Also strip any leftover markdown citation link syntax [1](#cite-0) or [1] or [cite-0]
    result = result.replace(/\[\d+\]\(#cite-\d+\)/g, "")
      .replace(/\[\d+\]/g, "")
      .replace(/#cite-\d+/g, "");

    // Fallback: use chunk sources if nothing matched
    if (citations.length === 0) {
      for (const c of chunks) {
        getIdx(c.source, String(c.page));
      }
    }

    return { processedText: result.trim(), citations };
  }

  // New format: [filename.pdf, Page 12]
  let result = rawAnswer.replace(
    /\[([^,\]]+\.(pdf|xlsx|xls|csv))[,\s]+Pages?\s+([^\]]+)\]/gi,
    (_, filename, _ext, pageStr) => {
      const idx = getIdx(filename.trim(), pageStr.trim());
      return `[${idx + 1}](#cite-${idx})`;
    }
  );

  // Old format: [Source: file, Page/Sheet: X, Quote: "..."]
  result = result.replace(
    /\[Source:\s*([^,\]\n]+),\s*Page\/Sheet:\s*([^,\]\n]+)(?:,\s*Quote:\s*"([^"\n]+)")?\]/g,
    (_, filename, pageStr, quote) => {
      const idx = getIdx(filename.trim(), pageStr.trim(), quote?.trim() ?? "");
      return `[${idx + 1}](#cite-${idx})`;
    }
  );

  // Fallback: use chunk sources if nothing matched
  if (citations.length === 0) {
    for (const c of chunks) {
      getIdx(c.source, String(c.page));
    }
  }

  return { processedText: result, citations };
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
  { icon: "🛡️", label: "Safety check", detail: "Validating query for safety…" },
  { icon: "🧭", label: "Intent classification", detail: "Routing to the right agent node…" },
  { icon: "🔍", label: "Hybrid retrieval", detail: "Searching datasets (semantic + keyword)…" },
  { icon: "⚙️", label: "Skill execution", detail: "Running matched skill chain…" },
  { icon: "🗺️", label: "Planning", detail: "Structuring multi-step retrieval plan…" },
  { icon: "🤖", label: "AI synthesis", detail: "Generating grounded answer…" },
  { icon: "✅", label: "Validation", detail: "Checking answer quality…" },
  { icon: "💾", label: "Caching response", detail: "Saving answer to query cache…" },
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
        style={{ background: "linear-gradient(135deg,#F8F5FC 0%,#F0EAF5 100%)" }}>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 spin text-ndap-blue flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" strokeOpacity={0.25} />
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
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
            style={{ width: `${pct}%`, background: "linear-gradient(90deg,#8B1060,#C9A227)" }}
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
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
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
            <circle cx="12" cy="12" r="10" strokeOpacity={0.2} />
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
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

const DOCS_BASE = (process.env.NEXT_PUBLIC_DOCS_BASE_URL ?? "/api/docs").replace(/\/$/, "");

function docUrl(filename: string, page?: string | number) {
  const base = `${DOCS_BASE}/${encodeURIComponent(filename)}`;
  return page ? `${base}#page=${page}` : base;
}

/* ── Citation chip ────────────────────────────────────────────────── */
function CitationChip({ cit, onOpenPdf }: { cit: Citation; onOpenPdf?: () => void }) {
  const isPdf = cit.source.toLowerCase().endsWith(".pdf");
  const label = isPdf ? `p.${cit.page}` : `sheet ${cit.page}`;

  if (isPdf && onOpenPdf) {
    return (
      <button
        onClick={onOpenPdf}
        className="inline-flex items-center gap-1.5 bg-ndap-sky border border-ndap-border rounded-full px-3 py-1 text-xs text-ndap-blue font-medium hover:bg-ndap-blue hover:text-white transition-colors duration-150"
      >
        <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4l-4-4H4zm5 1v3h3L9 1zM4 8h8v1H4V8zm0 2h8v1H4v-1zm0 2h5v1H4v-1z" />
        </svg>
        <span className="max-w-[160px] truncate">{cit.source}</span>
        <span className="text-[10px] opacity-70">{label}</span>
      </button>
    );
  }

  return (
    <a
      href={docUrl(cit.source, isPdf ? cit.page : undefined)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 bg-ndap-sky border border-ndap-border rounded-full px-3 py-1 text-xs text-ndap-blue font-medium hover:bg-ndap-blue hover:text-white transition-colors duration-150"
    >
      <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
        <path d="M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4l-4-4H4zm5 1v3h3L9 1zM4 8h8v1H4V8zm0 2h8v1H4v-1zm0 2h5v1H4v-1z" />
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
            <DownloadDropdown filename={filename} />
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-ndap-border transition-colors text-ndap-navy"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
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
                <circle cx="12" cy="12" r="10" strokeOpacity={0.25} />
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
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

/* ── Download Dropdown component ──────────────────────────────────── */
function DownloadDropdown({ filename }: { filename: string }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const triggerDownload = (format: "docx" | "pdf") => {
    const fileId = filename.replace(/\.(docx|pdf|txt)$/i, "");
    const downloadUrl = `/api/v1/documents/download?file_id=${fileId}&format=${format}`;
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `${fileId}.${format}`;
    a.click();
    setOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors shadow-sm select-none"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
        Download
        <span className="text-[9px] opacity-80">▼</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-40 bg-white border border-amber-200 rounded-xl shadow-lg z-50 p-1">
          <button
            onClick={() => triggerDownload("docx")}
            className="w-full text-left rounded-lg px-3 py-2 hover:bg-amber-50 transition-colors text-xs font-semibold text-amber-900"
          >
            Word Document (.docx)
          </button>
          <button
            onClick={() => triggerDownload("pdf")}
            className="w-full text-left rounded-lg px-3 py-2 hover:bg-amber-50 transition-colors text-xs font-semibold text-amber-900 mt-0.5"
          >
            PDF Document (.pdf)
          </button>
        </div>
      )}
    </div>
  );
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
            <div className="text-[11px] text-amber-700 mt-0.5">Generated report ready</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setOpen(true)}
            className="flex-shrink-0 flex items-center gap-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
            View Document
          </button>
          <DownloadDropdown filename={filename} />
        </div>
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
        className="w-full flex items-center justify-between px-4 py-2.5 bg-ndap-sky hover:bg-purple-50 transition-colors text-left"
      >
        <span className="text-ndap-navy font-semibold tracking-wide uppercase text-[10px]">
          Agent Trace & Diagnostics
        </span>
        <svg
          className={clsx("w-3.5 h-3.5 text-ndap-blue transition-transform", open && "rotate-180")}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
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
                {(meta.execution_trace?.length ?? 0) > 0 ? (
                  (meta.execution_trace ?? []).map((step, i) => {
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

/* ── PDF target type ──────────────────────────────────────────────── */
interface PdfTarget { url: string; page: number; filename: string; }


/* ── Map-request detector ─────────────────────────────────────────── */
const MAP_REQUEST_RE = /\b(show|display|visuali[sz]e|map|plot|render)\b.*\b(map|states?|chart|visual)\b|\bon (a |the )?map\b/i;

/* ── Message card ─────────────────────────────────────────────────── */
function MessageCard({
  turn,
  prevTurn,
  onOpenPdf,
  onSpeechApproved,
  onSpeechRevised,
  onSpeechPlanGenerated
}: {
  turn: ChatTurn;
  prevTurn?: ChatTurn;
  onOpenPdf: (t: PdfTarget) => void;
  onSpeechApproved?: (draftResult: { final_speech: string; plan_id: string }) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSpeechRevised?: (revisedResult: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSpeechPlanGenerated?: (planRes: any) => void;
}) {
  const { answer, chunks, meta } = turn.result;
  const docLink = extractDocLink(answer);

  const isEmail = meta.agent === "draft_email" || answer.startsWith("**Subject:**") || answer.startsWith("Subject:");
  const { processedText, citations } = buildInlineCitations(answer, chunks, isEmail);

  // If current message has no usable citations but is a map request, fall back to previous turn's map context
  const isMapRequest = MAP_REQUEST_RE.test(turn.query);
  const hasNoCitations = citations.length === 0;
  const prevIsEmail = prevTurn?.result?.meta?.agent === "draft_email" || prevTurn?.result?.answer?.startsWith("**Subject:**");
  const fallbackCitations = (isMapRequest && hasNoCitations && prevTurn)
    ? buildInlineCitations(prevTurn.result.answer, prevTurn.result.chunks, prevIsEmail).citations
    : null;
  const fallbackMeta = fallbackCitations ? prevTurn!.result.meta : null;

  const mapCitations = fallbackCitations ?? citations;
  const mapMeta = fallbackMeta ?? meta;

  return (
    <div className="anim-in space-y-2">
      {/* User bubble */}
      <div className="flex justify-end">
        <div className="max-w-2xl bg-ndap-navy text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-widest text-yellow-200 mb-1">You</div>
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
                  <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm1 11H9v-2h2v2zm0-4H9V7h2v2z" />
                </svg>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                IDS Analysis
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400">
                {turn.timestamp.toLocaleTimeString()}
              </span>
            </div>
          </div>

          <div className="ndap-prose text-sm">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children, ...props }) => {
                  if (href?.startsWith("#cite-")) {
                    const idx = parseInt(href.replace("#cite-", ""), 10);
                    const cit = citations[idx];
                    const isRealPdf = cit?.source?.toLowerCase().endsWith(".pdf");
                    return (
                      <button
                        onClick={() => cit && isRealPdf && onOpenPdf({
                          url: `${DOCS_BASE}/${encodeURIComponent(cit.source)}`,
                          page: parseInt(cit.page) || 1,
                          filename: cit.source,
                        })}
                        title={cit ? `${cit.source} · Page ${cit.page}` : ""}
                        className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 text-[10px] font-bold bg-ndap-blue text-white rounded-full px-1.5 mx-0.5 hover:bg-ndap-navy transition-colors align-baseline leading-none ${isRealPdf ? "cursor-pointer" : "cursor-default"}`}
                      >
                        {idx + 1}
                      </button>
                    );
                  }
                  return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
                },
              }}
            >
              {processedText}
            </ReactMarkdown>
          </div>

          {citations.length > 0 && (
            <div className="mt-4 pt-3.5 border-t border-gray-100 anim-in">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Sources</div>
              <div className="flex flex-wrap gap-2">
                {citations.map((c, i) => (
                  <CitationChip
                    key={i}
                    cit={c}
                    onOpenPdf={c.source.toLowerCase().endsWith(".pdf") ? () => onOpenPdf({
                      url: `${DOCS_BASE}/${encodeURIComponent(c.source)}`,
                      page: parseInt(c.page) || 1,
                      filename: c.source
                    }) : undefined}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Wizard Step 1: Parameter Setup Card */}
      {meta.agent === "speech_planning" && meta.step === "PARAM_WIZARD" && (
        <SpeechParamWizardCard
          topic={meta.topic || turn.query}
          wizardData={meta.wizard_data}
          sessionId={turn.result.session_id}
          onHistoricalRefFound={(res) => {
            if (onSpeechRevised) {
              onSpeechRevised({
                answer: `### 📜 Historical Reference Discovery\n\n${res.historical_question}`,
                chunks: [],
                meta: {
                  agent: "speech_planning",
                  step: "HISTORICAL_REF_DISCOVERY",
                  topic: meta.topic || turn.query,
                  intent: res.intent,
                  recommended_speeches: res.recommended_speeches || [],
                  historical_question: res.historical_question,
                }
              });
            }
          }}
        />
      )}

      {/* Wizard Step 2: Historical Reference Discovery Card */}
      {meta.agent === "speech_planning" && meta.step === "HISTORICAL_REF_DISCOVERY" && (
        <SpeechHistoricalRefCard
          topic={meta.topic || turn.query}
          intent={meta.intent}
          historicalData={meta}
          sessionId={turn.result.session_id}
          onPlanGenerated={(res) => {
            if (onSpeechPlanGenerated) {
              onSpeechPlanGenerated(res);
            } else if (onSpeechRevised) {
              const outline = res.outline_plan || {};
              const mdLines = [
                `# 🎙️ Speech Outline: ${outline.proposed_title || 'Speech Plan'}`,
                `**Central Message:** ${outline.central_message || ''}\n`,
                "---",
                "## 1. 🧭 7-Stage Narrative Arc",
                `- **Opening:** ${outline.narrative_arc?.opening || ''}`,
                `- **Context:** ${outline.narrative_arc?.context || ''}`,
                `- **Tension / Problem:** ${outline.narrative_arc?.tension_problem || ''}`,
                `- **Evidence:** ${outline.narrative_arc?.evidence || ''}`,
                `- **Proposal:** ${outline.narrative_arc?.proposal || ''}`,
                `- **Call to Action:** ${outline.narrative_arc?.call_to_action || ''}`,
                `- **Close:** ${outline.narrative_arc?.close || ''}\n`,
                "## 2. ⏱️ Proposed Subtopics & Timing Allocation"
              ];
              (outline.subtopics || []).forEach((st: any) => {
                mdLines.push(`- **Section ${st.section_number}: ${st.section_title}** (\`${st.allocated_time}\`) — *${st.purpose}*`);
              });
              mdLines.push("\n## 3. 📚 Supporting Evidence Mapped");
              (outline.supporting_evidence || []).forEach((ev: any) => {
                mdLines.push(`- **${ev.claim}** (Source: \`${ev.source_doc}\` | DocID: \`${ev.doc_id}\` | Date: \`${ev.date}\`)`);
              });
              mdLines.push("\n---\n📌 **Outline Review**: Please review the proposed speech outline above. Provide optional feedback below and click **[Approve Outline & Draft Speech]** to generate the full speech draft.");

              onSpeechRevised({
                answer: mdLines.join("\n"),
                chunks: (outline.supporting_evidence || []).map((ev: any) => ({
                  source: ev.source_doc, page: "1", score: 0.0, search_type: "speech_retrieval", text: ev.claim
                })),
                meta: {
                  agent: "speech_planning",
                  plan_id: res.plan_id,
                  status: "OUTLINE_PROPOSED",
                  hard_gate_active: true
                }
              });
            }
          }}
        />
      )}

      {/* Stage-1 Speech Outline Approval Gate */}
      {meta.agent === "speech_planning" && meta.plan_id && meta.status !== "DRAFT_GENERATED" && (
        <SpeechApprovalGate
          planId={meta.plan_id}
          onApproved={(res) => onSpeechApproved && onSpeechApproved(res)}
          onRevised={(res) => onSpeechRevised && onSpeechRevised(res)}
        />
      )}

      {/* Stage-2 Speech Draft Download Buttons */}
      {(meta.agent === "speech_planning_draft" || meta.agent === "speech_planning_draft_generated" || meta.status === "DRAFT_GENERATED") && (
        <div className="mt-3.5 p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-blue-900 text-xs font-semibold">
            <span>🎙️ Final Speech Draft Ready</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/api/speech/download?file_id=${meta.plan_id}&format=docx`}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors shadow-sm"
            >
              <span>📥 Download Word (.docx)</span>
            </a>
            <a
              href={`/api/speech/download?file_id=${meta.plan_id}&format=pdf`}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors shadow-sm"
            >
              <span>📥 Download PDF (.pdf)</span>
            </a>
          </div>
        </div>
      )}

      <CitationMaps
        citations={mapCitations}
        intentMetric={mapMeta.intent_metric}
        focusStates={mapMeta.focus_states}
      />

      {/* Generated document download card */}
      {docLink && <DocCard url={docLink.url} filename={docLink.filename} />}

      <TracePanel turn={turn} />
    </div>
  );
}

/* ── Speech Wizard Step 1: Parameter Setup Card (Sequential Stepper) ── */
function SpeechParamWizardCard({
  topic,
  wizardData,
  sessionId,
  onHistoricalRefFound
}: {
  topic: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wizardData: any;
  sessionId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onHistoricalRefFound: (res: any) => void;
}) {
  const [stepIndex, setStepIndex] = useState(0); // 0 = Tone, 1 = Duration, 2 = Audience, 3 = Speaker

  const [selectedTone, setSelectedTone] = useState(wizardData?.tone_options?.[0] || "(Recommended) Visionary & Inspiring");
  const [customTone, setCustomTone] = useState("");

  const [selectedDuration, setSelectedDuration] = useState(wizardData?.duration_options?.[0] || "(Recommended) 10 Minutes (Standard Address)");
  const [customDuration, setCustomDuration] = useState("");

  const [selectedAudience, setSelectedAudience] = useState(wizardData?.audience_options?.[0] || "(Recommended) General Public & Stakeholders");
  const [customAudience, setCustomAudience] = useState("");

  const [selectedSpeaker, setSelectedSpeaker] = useState(wizardData?.speaker_options?.[0] || "(Recommended) Official Government Speaker");
  const [customSpeaker, setCustomSpeaker] = useState("");

  const [customInstructions, setCustomInstructions] = useState("");
  const [loading, setLoading] = useState(false);

  const finalTone = customTone.trim() || selectedTone.replace("(Recommended) ", "").trim();
  const finalDuration = customDuration.trim() || selectedDuration.replace("(Recommended) ", "").trim();
  const finalAudience = customAudience.trim() || selectedAudience.replace("(Recommended) ", "").trim();
  const finalSpeaker = customSpeaker.trim() || selectedSpeaker.replace("(Recommended) ", "").trim();

  const handleNext = async () => {
    if (stepIndex < 3) {
      setStepIndex(stepIndex + 1);
      return;
    }

    setLoading(true);
    try {
      const intent = {
        topic,
        tone: finalTone,
        duration: finalDuration,
        audience: finalAudience,
        speaker: finalSpeaker,
        objective: customInstructions ? `Focus: ${customInstructions}` : "Highlight key milestones and future vision",
      };

      const res = await checkSpeechHistoricalRef(topic, intent, sessionId);
      onHistoricalRefFound(res);
    } catch (e: any) {
      alert(`Error searching historical speeches: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  const stepsInfo = [
    {
      label: "Question 1 of 4: Tone",
      question: `What tone would you like for this speech on "${topic}"?`,
      options: wizardData?.tone_options || [
        "(Recommended) Visionary & Inspiring",
        "Policy & Metric-Driven",
        "Urgent & Action-Oriented",
        "Formal & Milestone Address"
      ],
      selected: selectedTone,
      setSelected: setSelectedTone,
      customVal: customTone,
      setCustomVal: setCustomTone,
      customPlaceholder: "Or write custom tone (e.g. Hopeful, Encouraging)..."
    },
    {
      label: "Question 2 of 4: Target Duration",
      question: "What is the target duration for the speech?",
      options: wizardData?.duration_options || [
        "(Recommended) 10 Minutes (Standard Address)",
        "5 Minutes (Key Briefing)",
        "15 Minutes (Keynote & Vision Speech)"
      ],
      selected: selectedDuration,
      setSelected: setSelectedDuration,
      customVal: customDuration,
      setCustomVal: setCustomDuration,
      customPlaceholder: "Or write custom duration (e.g. 7 Minutes)..."
    },
    {
      label: "Question 3 of 4: Target Audience",
      question: "Who is the primary target audience for this address?",
      options: wizardData?.audience_options || [
        "(Recommended) General Public & Stakeholders",
        "Policy Makers & Senior Leadership",
        "Industry Leaders & Investors"
      ],
      selected: selectedAudience,
      setSelected: setSelectedAudience,
      customVal: customAudience,
      setCustomVal: setCustomAudience,
      customPlaceholder: "Or write custom audience (e.g. Foreign Dignitaries)..."
    },
    {
      label: "Question 4 of 4: Speaker Designation",
      question: "What is the official designation of the speaker?",
      options: wizardData?.speaker_options || [
        "(Recommended) Official Government Speaker",
        "Ministry Spokesperson / Department Head"
      ],
      selected: selectedSpeaker,
      setSelected: setSelectedSpeaker,
      customVal: customSpeaker,
      setCustomVal: setCustomSpeaker,
      customPlaceholder: "Or write custom speaker (e.g. Prime Minister)..."
    }
  ];

  const currentStep = stepsInfo[stepIndex];

  return (
    <div className="mt-3 p-4 bg-purple-50/90 border border-purple-200 rounded-xl space-y-3.5 shadow-sm anim-in text-xs">
      {/* Top Stepper Header */}
      <div className="flex items-center justify-between pb-2 border-b border-purple-200/60">
        <div className="flex items-center gap-2 text-purple-950 font-bold text-xs">
          <span className="text-base">🎙️</span>
          <span>{currentStep.label}</span>
        </div>
        <div className="flex items-center gap-1">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`h-2 rounded-full transition-all ${idx === stepIndex ? "bg-purple-700 w-5" : idx < stepIndex ? "bg-purple-400 w-2" : "bg-purple-200 w-2"
                }`}
            />
          ))}
        </div>
      </div>

      {/* Summary Chips of Previous Selections */}
      {stepIndex > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {stepIndex > 0 && <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md font-medium">Tone: {finalTone}</span>}
          {stepIndex > 1 && <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md font-medium">Duration: {finalDuration}</span>}
          {stepIndex > 2 && <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md font-medium">Audience: {finalAudience}</span>}
        </div>
      )}

      {/* Question Text */}
      <p className="text-xs text-purple-950 font-semibold leading-relaxed">
        {currentStep.question}
      </p>

      {/* Multiple-Choice Options */}
      <div className="space-y-1.5">
        {currentStep.options.map((opt: string) => (
          <button
            key={opt}
            type="button"
            onClick={() => {
              currentStep.setSelected(opt);
              currentStep.setCustomVal("");
            }}
            className={`w-full text-left text-xs px-3.5 py-2.5 rounded-lg border font-medium transition-all flex items-center justify-between ${currentStep.selected === opt && !currentStep.customVal
              ? "bg-purple-700 text-white border-purple-700 shadow-sm"
              : "bg-white text-purple-900 border-purple-200 hover:bg-purple-100/70"
              }`}
          >
            <span>{opt}</span>
            {currentStep.selected === opt && !currentStep.customVal && <span className="font-bold">✓</span>}
          </button>
        ))}
      </div>

      {/* Write-In Custom Field */}
      <div>
        <input
          type="text"
          value={currentStep.customVal}
          onChange={(e) => currentStep.setCustomVal(e.target.value)}
          placeholder={currentStep.customPlaceholder}
          className="w-full text-xs px-3 py-2 bg-white border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
        />
      </div>

      {/* Extra Instructions on Last Step */}
      {stepIndex === 3 && (
        <div>
          <label className="block text-[10px] font-bold text-purple-900 uppercase tracking-wider mb-1">Additional Guidance / Instructions (Optional)</label>
          <input
            type="text"
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            placeholder="e.g. Emphasize solar capacity targets and rural electrification..."
            className="w-full text-xs px-3 py-2 bg-white border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
          />
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="pt-1 flex items-center justify-between">
        {stepIndex > 0 ? (
          <button
            type="button"
            onClick={() => setStepIndex(stepIndex - 1)}
            className="text-xs text-purple-800 font-semibold px-3 py-1.5 hover:bg-purple-100 rounded-lg transition-colors"
          >
            ← Back
          </button>
        ) : <div />}

        <button
          onClick={handleNext}
          disabled={loading}
          className="flex items-center gap-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all shadow-sm disabled:opacity-50"
        >
          {loading ? (
            <span>Searching RAG & Historical Speeches...</span>
          ) : stepIndex < 3 ? (
            <span>Next Question →</span>
          ) : (
            <span>🔍 Search Historical Speeches & Evidence →</span>
          )}
        </button>
      </div>
    </div>
  );
}

/* ── Speech Wizard Step 2: Historical Reference Discovery Card ───── */
function SpeechHistoricalRefCard({
  topic,
  intent,
  historicalData,
  sessionId,
  onPlanGenerated
}: {
  topic: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  intent: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  historicalData: any;
  sessionId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onPlanGenerated: (res: any) => void;
}) {
  const initialRecommended = historicalData?.recommended_speeches || [];
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initialRecommended.length > 0 ? [initialRecommended[0].speech_id || initialRecommended[0].title] : []
  );
  const [customNotes, setCustomNotes] = useState("");
  const [loading, setLoading] = useState(false);

  // Search & Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpeaker, setSelectedSpeaker] = useState("All Speakers");
  const [selectedTheme, setSelectedTheme] = useState("All Themes");
  const [selectedYear, setSelectedYear] = useState("All Years");
  const [archiveList, setArchiveList] = useState<any[]>(initialRecommended);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (initialRecommended.length > 0) {
      setArchiveList(initialRecommended);
      setSelectedIds([initialRecommended[0].speech_id || initialRecommended[0].title]);
    } else {
      setIsSearching(true);
      searchSpeechArchive(topic || "Renewable Energy")
        .then((res) => {
          if (res.speeches && res.speeches.length > 0) {
            setArchiveList(res.speeches);
            setSelectedIds([res.speeches[0].speech_id || res.speeches[0].title]);
          }
        })
        .catch(console.error)
        .finally(() => setIsSearching(false));
    }
  }, [historicalData, topic]);

  const toggleSpeechSelection = (idOrTitle: string) => {
    setSelectedIds((prev) =>
      prev.includes(idOrTitle) ? prev.filter((item) => item !== idOrTitle) : [...prev, idOrTitle]
    );
  };

  const handleSearchArchive = async () => {
    setIsSearching(true);
    try {
      const res = await searchSpeechArchive(
        searchQuery,
        selectedSpeaker === "All Speakers" ? "" : selectedSpeaker,
        selectedTheme === "All Themes" ? "" : selectedTheme,
        selectedYear === "All Years" ? "" : selectedYear
      );
      setArchiveList(res.speeches || []);
    } catch (err) {
      console.error("Archive search failed:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleGeneratePlan = async () => {
    setLoading(true);
    try {
      const allAvailable = [...initialRecommended, ...archiveList];
      const selectedDocs = allAvailable
        .filter((s) => selectedIds.includes(s.speech_id) || selectedIds.includes(s.title))
        .map((s) => `${s.title} (${s.speaker}, ${s.date})`);

      let chosenReference = selectedDocs.join(" | ");
      if (customNotes.trim()) {
        chosenReference = chosenReference ? `${chosenReference} -- Notes: ${customNotes.trim()}` : customNotes.trim();
      }

      const res = await proposeSpeechPlan(intent, chosenReference || null, sessionId);
      onPlanGenerated(res);
    } catch (e: any) {
      alert(`Error proposing speech plan: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 p-4 bg-purple-50/90 border border-purple-200 rounded-xl space-y-3.5 shadow-sm anim-in text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-purple-200/70">
        <div className="flex items-center gap-2 text-purple-950 font-bold text-xs">
          <span className="text-base">📜</span>
          <span>Interactive Speech Wizard · Step 2: Select Historical References</span>
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className="text-[11px] font-semibold text-[#8B1060] hover:text-purple-900 bg-purple-100 px-2.5 py-1 rounded-md transition-colors"
        >
          {showFilters ? "✕ Close Archive Search" : "🔍 Search & Filter Archive (1,000+ Speeches)"}
        </button>
      </div>

      <p className="text-xs text-purple-950 leading-relaxed font-medium">
        {historicalData?.historical_question || `Suggested strategic speech anchors for '${topic}':`}
      </p>

      {/* Expandable Archive Search & Filters Bar */}
      {showFilters && (
        <div className="p-3 bg-white border border-purple-200 rounded-lg space-y-2.5 anim-in">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchArchive()}
              placeholder="Search past speeches by topic, keyword, or venue..."
              className="flex-1 text-xs px-3 py-1.5 bg-gray-50 border border-purple-200 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 text-gray-800"
            />
            <button
              type="button"
              onClick={handleSearchArchive}
              disabled={isSearching}
              className="px-3 py-1.5 bg-[#8B1060] text-white font-bold rounded-md hover:bg-purple-900 transition-colors text-xs"
            >
              {isSearching ? "Searching..." : "Search"}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div>
              <label className="block text-[10px] font-bold text-gray-600 mb-0.5">Speaker</label>
              <select
                value={selectedSpeaker}
                onChange={(e) => setSelectedSpeaker(e.target.value)}
                className="w-full text-xs p-1.5 bg-gray-50 border border-gray-200 rounded-md text-gray-700"
              >
                <option>All Speakers</option>
                <option>Prime Minister of India</option>
                <option>Minister of New & Renewable Energy</option>
                <option>Cabinet Minister of Commerce & Industry</option>
                <option>Union Health Minister</option>
                <option>Union Minister of Jal Shakti</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-600 mb-0.5">Theme</label>
              <select
                value={selectedTheme}
                onChange={(e) => setSelectedTheme(e.target.value)}
                className="w-full text-xs p-1.5 bg-gray-50 border border-gray-200 rounded-md text-gray-700"
              >
                <option>All Themes</option>
                <option>Renewable Energy</option>
                <option>Digital Public Infrastructure</option>
                <option>Make in India</option>
                <option>Jal Jeevan Mission</option>
                <option>Ayushman Bharat</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-600 mb-0.5">Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full text-xs p-1.5 bg-gray-50 border border-gray-200 rounded-md text-gray-700"
              >
                <option>All Years</option>
                <option>2024</option>
                <option>2023</option>
                <option>2022</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Speech Cards List (Multi-Select Checkboxes) */}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {archiveList.map((speech: any) => {
          const key = speech.speech_id || speech.title;
          const isSelected = selectedIds.includes(key);
          return (
            <div
              key={key}
              onClick={() => toggleSpeechSelection(key)}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${isSelected
                ? "bg-white border-[#8B1060] ring-1 ring-[#8B1060]/30 shadow-xs"
                : "bg-white/80 border-purple-200 hover:bg-white text-gray-800"
                }`}
            >
              <div className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSpeechSelection(key)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-0.5 h-4 w-4 rounded text-[#8B1060] focus:ring-[#8B1060] cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-purple-950 text-xs truncate">{speech.title}</span>
                    {speech.matching_rationale && (
                      <span className="shrink-0 text-[10px] font-semibold text-[#8B1060] bg-purple-100 px-2 py-0.5 rounded-full">
                        💡 {speech.matching_rationale}
                      </span>
                    )}
                  </div>
                  <div className="text-purple-900 text-[11px] font-medium mt-0.5">
                    👤 {speech.speaker} &nbsp;·&nbsp; 📍 {speech.occasion} ({speech.date})
                  </div>
                  <div className="text-gray-600 text-[11px] mt-1 line-clamp-2 leading-snug">
                    "{speech.summary || speech.snippet}"
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Layman Custom Notes Input */}
      <div>
        <label className="block text-[10px] font-bold text-purple-900 uppercase tracking-wider mb-1">
          📎 Optional: Add Custom Reference Notes or Instructions
        </label>
        <input
          type="text"
          value={customNotes}
          onChange={(e) => setCustomNotes(e.target.value)}
          placeholder="e.g. Also adopt the visionary tone from the 2024 Independence Day address..."
          className="w-full text-xs px-3 py-2 bg-white border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
        />
      </div>

      {/* Confirm Action Button */}
      <div className="pt-2 flex justify-end">
        <button
          type="button"
          onClick={handleGeneratePlan}
          disabled={loading}
          className="w-full sm:w-auto px-5 py-2.5 bg-[#8B1060] hover:bg-purple-900 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Generating Stage 1 Outline...</span>
            </>
          ) : (
            <span>Confirm References & Propose Speech Plan 🚀</span>
          )}
        </button>
      </div>
    </div>
  );
}

/* ── Stage-1 Speech Outline Approval Gate ────────────────────────── */
function SpeechApprovalGate({
  planId,
  onApproved,
  onRevised
}: {
  planId: string;
  onApproved: (draftResult: { final_speech: string; plan_id: string }) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onRevised: (revisedResult: any) => void;
}) {
  const [feedback, setFeedback] = useState("");
  const [loadingApprove, setLoadingApprove] = useState(false);
  const [loadingRevise, setLoadingRevise] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);

  const handleRevise = async () => {
    if (!feedback.trim()) return;
    setLoadingRevise(true);
    setError(null);
    try {
      const res = await reviseSpeechPlan(planId, feedback);
      setFeedback("");
      onRevised(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revision failed.");
    } finally {
      setLoadingRevise(false);
    }
  };

  const handleApprove = async () => {
    setLoadingApprove(true);
    setError(null);
    try {
      const res = await approveSpeechPlan(planId, feedback);
      setApproved(true);
      onApproved(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed.");
    } finally {
      setLoadingApprove(false);
    }
  };

  if (approved) {
    return (
      <div className="mt-3 p-3.5 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800 font-semibold flex items-center gap-2">
        <span>✅ Speech outline approved! Full speech draft generated below.</span>
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 border border-purple-200 border-l-4 border-l-[#8B1060] bg-purple-50/90 rounded-xl shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-purple-950 font-bold text-xs uppercase tracking-wide">
          <span>⏳ Waiting for User Approval</span>
        </div>
        <span className="text-[10px] text-purple-700 font-mono font-semibold">Plan ID: {planId}</span>
      </div>
      <p className="text-xs text-purple-900 leading-relaxed font-medium">
        Please review the proposed narrative arc, section timing breakdown, and supporting evidence above. You can provide feedback and request revisions, or approve to generate the full speech draft.
      </p>

      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Enter revision feedback (e.g., 'Make tone more inspiring', 'Expand Section 2')..."
        rows={2}
        className="w-full resize-none bg-white border border-purple-200 rounded-lg p-2.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-[#8B1060]"
      />

      {error && <div className="text-xs text-red-600 font-semibold">{error}</div>}

      <div className="flex items-center justify-end gap-2">
        {feedback.trim() && (
          <button
            onClick={handleRevise}
            disabled={loadingRevise || loadingApprove}
            className="flex items-center gap-1.5 bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300 text-xs font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm disabled:opacity-50"
          >
            {loadingRevise ? (
              <span>Regenerating Plan...</span>
            ) : (
              <span>🔄 Request Revisions / Regenerate Plan</span>
            )}
          </button>
        )}
        <button
          onClick={handleApprove}
          disabled={loadingRevise || loadingApprove}
          className="flex items-center gap-1.5 bg-[#8B1060] hover:bg-[#6b0b49] text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-sm disabled:opacity-50"
        >
          {loadingApprove ? (
            <span>Generating Full Speech Draft...</span>
          ) : (
            <span>✓ Approve Outline & Draft Speech</span>
          )}
        </button>
      </div>
    </div>
  );
}
function SpeechIntentModal({
  isOpen,
  onClose,
  onSubmit
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formattedPrompt: string) => void;
}) {
  const [topic, setTopic] = useState("Economic Growth and Rural Digital Infrastructure");
  const [speaker, setSpeaker] = useState("CDS");
  const [audience, setAudience] = useState("Policy Analysts & Industry Leaders");
  const [occasion, setOccasion] = useState("Annual Economic Summit 2026");
  const [duration, setDuration] = useState("10 minutes");
  const [tone, setTone] = useState("Visionary and Evidence-Backed");
  const [requiredMessages, setRequiredMessages] = useState("Highlight GDP 7.2% growth, Jal Jeevan Mission, and UPI transaction volume");
  const [prohibitedTopics, setProhibitedTopics] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = `Topic: ${topic.trim()}
Speaker: ${speaker.trim()}
Audience: ${audience.trim()}
Occasion: ${occasion.trim()}
Duration: ${duration}
Tone: ${tone}
${requiredMessages.trim() ? `Required Messages: ${requiredMessages.trim()}\n` : ""}${prohibitedTopics.trim() ? `Prohibited Topics: ${prohibitedTopics.trim()}` : ""}`;

    onSubmit(prompt.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 anim-in">
      <div className="bg-white border border-ndap-border rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-ndap-navy text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🎙️</span>
            <div>
              <h3 className="font-bold text-base leading-tight">Speech Planner Parameters</h3>
              <p className="text-xs text-blue-200">Configure speech intent to search authorized archives & propose a plan</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-blue-200 hover:text-white transition-colors p-1"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs text-gray-800">
          <div>
            <label className="block font-bold text-gray-700 uppercase tracking-wider text-[10px] mb-1.5">
              Speech Topic / Core Subject *
            </label>
            <input
              type="text"
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Economic Growth and Rural Infrastructure"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-900 focus:outline-none focus:border-ndap-blue focus:bg-white transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider text-[10px] mb-1.5">
                Speaker Persona *
              </label>
              <select
                value={speaker}
                onChange={(e) => setSpeaker(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-900 focus:outline-none focus:border-ndap-blue focus:bg-white transition-all"
              >
                <option value="CDS">CDS</option>
                <option value="CISC">CISC</option>
                <option value="DCIDS (DoT)">DCIDS (DoT)</option>
                <option value="DCIDS (PP + FD)">DCIDS (PP + FD)</option>
                <option value="DCIDS (Ops)">DCIDS (Ops)</option>
                <option value="DGDIA">DGDIA</option>
                <option value="Others">Others</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider text-[10px] mb-1.5">
                Target Audience *
              </label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-900 focus:outline-none focus:border-ndap-blue focus:bg-white transition-all"
              >
                <option value="Policy Analysts & Industry Leaders">Policy Analysts & Industry Leaders</option>
                <option value="General Public & Citizens">General Public & Citizens</option>
                <option value="State Officers & Regional Delegates">State Officers & Delegates</option>
                <option value="International Summit Delegates">International Summit Delegates</option>
                <option value="Parliament / Legislative Assembly">Parliament / Legislative Assembly</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-gray-700 uppercase tracking-wider text-[10px] mb-1.5">
              Occasion / Venue *
            </label>
            <input
              type="text"
              required
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
              placeholder="e.g., Annual Economic Summit 2026"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-900 focus:outline-none focus:border-ndap-blue focus:bg-white transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider text-[10px] mb-1.5">
                Target Duration *
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {["5 mins", "10 mins", "15 mins", "20 mins"].map((d) => (
                  <button
                    type="button"
                    key={d}
                    onClick={() => setDuration(d)}
                    className={clsx(
                      "py-2 text-[11px] font-semibold rounded-lg border text-center transition-all",
                      duration === d
                        ? "bg-ndap-navy text-white border-ndap-navy shadow-sm"
                        : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider text-[10px] mb-1.5">
                Preferred Tone *
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-900 focus:outline-none focus:border-ndap-blue focus:bg-white transition-all"
              >
                <option value="Visionary and Evidence-Backed">Visionary & Evidence-Backed</option>
                <option value="Formal and Policy-Focused">Formal & Policy-Focused</option>
                <option value="Urgent and Action-Oriented">Urgent & Action-Oriented</option>
                <option value="Celebratory and Inspiring">Celebratory & Inspiring</option>
                <option value="Analytical and Metric-Driven">Analytical & Metric-Driven</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-gray-700 uppercase tracking-wider text-[10px] mb-1.5">
              Required Key Messages / Metrics (Optional)
            </label>
            <textarea
              rows={2}
              value={requiredMessages}
              onChange={(e) => setRequiredMessages(e.target.value)}
              placeholder="e.g., Highlight GDP growth, Jal Jeevan Mission, UPI transactions"
              className="w-full resize-none bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-900 focus:outline-none focus:border-ndap-blue focus:bg-white transition-all"
            />
          </div>

          <div>
            <label className="block font-bold text-gray-700 uppercase tracking-wider text-[10px] mb-1.5">
              Prohibited Topics / Off-Limits (Optional)
            </label>
            <input
              type="text"
              value={prohibitedTopics}
              onChange={(e) => setProhibitedTopics(e.target.value)}
              placeholder="e.g., Specific ongoing litigation or unverified estimates"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-900 focus:outline-none focus:border-ndap-blue focus:bg-white transition-all"
            />
          </div>

          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-ndap-navy text-white hover:bg-ndap-navyDark transition-colors shadow-sm flex items-center gap-1.5"
            >
              <span>🚀 Generate Speech Plan</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Empty state ──────────────────────────────────────────────────── */
function EmptyState({ onSample }: { onSample: (q: string) => void }) {
  const samples = [
    "Why are unmanned systems considered cost-effective and useful in modern warfare?",
    "What is Manned-Unmanned Teaming (MUM-T), and what advantages does it provide by combining manned and unmanned systems?",
    "What is the importance of meaningful human control in MUM-T operations, particularly when autonomous systems are involved?",
    "What are some of the possible applications of Artificial Intelligence in the Indian Army beyond the warfighting domain?",
    "What is the purpose of military doctrine, and how does it help in planning and conducting military operations?",
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-20 h-20 rounded-2xl bg-ndap-sky border-2 border-ndap-border flex items-center justify-center mb-6 shadow-card">
        <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none">
          <rect width="48" height="48" rx="10" fill="#F8F5FC" />
          <rect x="8" y="30" width="7" height="10" rx="1.5" fill="#8B1A1A" />
          <rect x="20" y="22" width="7" height="18" rx="1.5" fill="#8B1060" />
          <rect x="32" y="14" width="7" height="26" rx="1.5" fill="#5C0A3E" />
          <polyline points="8,28 20,20 32,12" stroke="#C9A227" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      </div>
      <h2 className="text-gray-900 font-bold text-xl mb-2">IDS Knowledgebase</h2>
      <p className="text-gray-500 text-sm mb-1">Ask questions, draft emails, or generate reports from indexed government datasets.</p>
      <p className="text-gray-400 text-xs mb-8"></p>

      <div className="w-full max-w-xl">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Try asking</p>
        <div className="grid gap-2">
          {samples.map((q) => (
            <button
              key={q}
              onClick={() => onSample(q)}
              className="text-left text-sm text-gray-800 bg-white border border-ndap-border rounded-xl px-4 py-3 hover:bg-ndap-sky hover:border-ndap-blue transition-colors shadow-sm"
            >
              <span>{q}</span>
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
  const [pdfPanel, setPdfPanel] = useState<PdfTarget | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [showSpeechModal, setShowSpeechModal] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { sidebarOpen } = useSidebar();
  const { language } = useLanguage();
  const router = useRouter();
  useEffect(() => {
    if (!isAuthenticated()) router.replace("/login");
  }, [router]);

  useEffect(() => {
    const handleOutsideClick = () => {
      setDropdownOpen(false);
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => null);
    getRecentQueries(10).then(setRecentQueries).catch(() => null);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, loading]);

  const submitQuery = useCallback(
    async (q: string, agentOverride?: string | null) => {
      if (!q.trim() || loading) return;
      setError(null);
      setLoading(true);
      setPendingQuery(q.trim());
      setInput("");

      // Generate session ID on first query and reuse for the conversation
      const sid = sessionId ?? generateId().slice(0, 8);
      if (!sessionId) setSessionId(sid);

      try {
        const result = await askQuery(
          q.trim(),
          sid,
          "fast",
          agentOverride === undefined ? selectedAgent : agentOverride,
          language
        );
        setTurns((prev) => [
          ...prev,
          { id: generateId(), query: q.trim(), result, timestamp: new Date() },
        ]);
        getRecentQueries(10).then(setRecentQueries).catch(() => null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Query failed. Is the backend running?");
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [loading, sessionId, selectedAgent, language]
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

  const startNewAndSubmit = useCallback((q: string) => {
    if (sessionId) resetSession(sessionId).catch(() => null);
    setTurns([]);
    setSessionId(null);
    setError(null);
    submitQuery(q);
  }, [sessionId, submitQuery]);

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
    <div className="flex-1 flex w-full px-2 py-3 gap-3 overflow-hidden min-h-0">

      {/* ── Left sidebar ─────────────────────────────────────────── */}
      <aside className={clsx("flex-col w-56 xl:w-64 flex-shrink-0 gap-3 overflow-y-auto", sidebarOpen ? "hidden lg:flex" : "hidden")}>

        <button
          onClick={startNew}
          className="w-full flex items-center justify-center gap-2 bg-ndap-navy text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-ndap-navyDark transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          New Analysis
        </button>

        {/* Recent queries */}
        <div className="bg-white border border-ndap-border rounded-xl shadow-sm flex-1 overflow-auto flex flex-col min-h-0">
          <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-ndap-border/60 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-ndap-blue" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
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
                      onClick={() => startNewAndSubmit(rq.text)}
                      className="group w-full text-left rounded-lg px-2.5 py-2 hover:bg-ndap-sky border border-transparent hover:border-ndap-border transition-all duration-150"
                    >
                      <div className="flex items-start gap-2">
                        <svg className="w-3 h-3 mt-0.5 flex-shrink-0 text-gray-300 group-hover:text-ndap-blue transition-colors" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-700 group-hover:text-gray-900 leading-snug break-words whitespace-normal transition-colors">{rq.text}</p>
                          {ts && <p className="text-[10px] text-gray-400 mt-1">{ts}</p>}
                        </div>
                        <svg className="w-3 h-3 flex-shrink-0 text-gray-200 group-hover:text-ndap-blue opacity-0 group-hover:opacity-100 transition-all mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
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
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
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
                <span>{health.postgres ? "Structured Data Connected" : "Structured Data Offline"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Dot ok={health.elasticsearch} />
                <span>{health.elasticsearch ? "Unstructured Data Online" : "Unstructured Data Offline"}</span>
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

      {/* ── PDF viewer panel (middle column) ─────────────────────── */}
      {pdfPanel && (
        <div className="hidden lg:flex flex-col w-[360px] xl:w-[400px] flex-shrink-0">
          <Suspense fallback={<div className="flex-1 flex items-center justify-center text-xs text-gray-400">Loading viewer…</div>}>
            <PdfPanel
              url={pdfPanel.url}
              page={pdfPanel.page}
              filename={pdfPanel.filename}
              onClose={() => setPdfPanel(null)}
            />
          </Suspense>
        </div>
      )}

      {/* ── Main chat column ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {error && (
          <div className="mb-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-y-auto">
          {turns.length === 0 && !loading ? (
            <EmptyState onSample={submitQuery} />
          ) : (
            <div className="space-y-6 pb-4">
              {turns.map((t, i) => (
                <MessageCard
                  key={t.id}
                  turn={t}
                  prevTurn={turns[i - 1]}
                  onOpenPdf={setPdfPanel}
                  onSpeechRevised={(revisedRes) => {
                    let newAnswer = revisedRes.answer;
                    let newMeta = revisedRes.meta || {};

                    if (revisedRes.outline_plan) {
                      const outline = revisedRes.outline_plan || {};
                      let md = `# 🎙️ Speech Outline: ${outline.proposed_title || 'Speech Plan'}\n**Central Message:** ${outline.central_message || ''}\n\n---\n## 1. 🧭 7-Stage Narrative Arc\n- **Opening:** ${outline.narrative_arc?.opening || ''}\n- **Context:** ${outline.narrative_arc?.context || ''}\n- **Tension / Problem:** ${outline.narrative_arc?.tension_problem || ''}\n- **Evidence:** ${outline.narrative_arc?.evidence || ''}\n- **Proposal:** ${outline.narrative_arc?.proposal || ''}\n- **Call to Action:** ${outline.narrative_arc?.call_to_action || ''}\n- **Close:** ${outline.narrative_arc?.close || ''}\n\n## 2. ⏱️ Proposed Subtopics & Timing Allocation\n`;
                      for (const st of outline.subtopics || []) {
                        md += `- **Section ${st.section_number}: ${st.section_title}** (\`${st.allocated_time}\`) — *${st.purpose}*\n`;
                      }
                      md += `\n## 3. 📚 Supporting Evidence Mapped\n`;
                      for (const ev of outline.supporting_evidence || []) {
                        md += `- **${ev.claim}** (Source: \`${ev.source_doc}\` | DocID: \`${ev.doc_id}\` | Date: \`${ev.date}\`)\n`;
                      }
                      if (outline.assumptions_and_questions) {
                        md += `\n## ❓ Assumptions & Clarification Questions\n`;
                        for (const q of outline.assumptions_and_questions) {
                          md += `- ${q}\n`;
                        }
                      }
                      md += `\n---\n📌 **Outline Review**: Please review the revised speech outline above. Provide optional feedback below or click **[Approve Outline & Draft Speech]** to generate the full speech draft.`;
                      newAnswer = md;
                      newMeta = {
                        ...t.result.meta,
                        agent: "speech_planning",
                        plan_id: revisedRes.plan_id,
                        status: "OUTLINE_PROPOSED",
                        hard_gate_active: true
                      };
                    }

                    setTurns((prev) => prev.map((turnItem) => turnItem.id === t.id ? {
                      ...turnItem,
                      result: {
                        ...turnItem.result,
                        answer: newAnswer || turnItem.result.answer,
                        meta: {
                          ...turnItem.result.meta,
                          ...newMeta
                        }
                      }
                    } : turnItem));
                  }}
                  onSpeechPlanGenerated={(planRes) => {
                    const outline = planRes.outline_plan || {};
                    let md = `# 🎙️ Speech Outline: ${outline.proposed_title || 'Speech Plan'}\n**Central Message:** ${outline.central_message || ''}\n\n---\n## 1. 🧭 7-Stage Narrative Arc\n- **Opening:** ${outline.narrative_arc?.opening || ''}\n- **Context:** ${outline.narrative_arc?.context || ''}\n- **Tension / Problem:** ${outline.narrative_arc?.tension_problem || ''}\n- **Evidence:** ${outline.narrative_arc?.evidence || ''}\n- **Proposal:** ${outline.narrative_arc?.proposal || ''}\n- **Call to Action:** ${outline.narrative_arc?.call_to_action || ''}\n- **Close:** ${outline.narrative_arc?.close || ''}\n\n## 2. ⏱️ Proposed Subtopics & Timing Allocation\n`;
                    for (const st of outline.subtopics || []) {
                      md += `- **Section ${st.section_number}: ${st.section_title}** (\`${st.allocated_time}\`) — *${st.purpose}*\n`;
                    }
                    md += `\n## 3. 📚 Supporting Evidence Mapped\n`;
                    for (const ev of outline.supporting_evidence || []) {
                      md += `- **${ev.claim}** (Source: \`${ev.source_doc}\` | DocID: \`${ev.doc_id}\` | Date: \`${ev.date}\`)\n`;
                    }
                    if (outline.assumptions_and_questions) {
                      md += `\n## ❓ Assumptions & Clarification Questions\n`;
                      for (const q of outline.assumptions_and_questions) {
                        md += `- ${q}\n`;
                      }
                    }
                    md += `\n---\n📌 **Outline Review**: Please review the proposed speech outline above. Provide optional feedback below or click **[Approve Outline & Draft Speech]** to generate the full speech draft.`;

                    setTurns((prev) => [
                      ...prev,
                      {
                        id: generateId(),
                        query: "Confirmed Historical Reference & Generated Outline",
                        timestamp: new Date(),
                        result: {
                          session_id: sessionId || "",
                          answer: md,
                          chunks: (outline.supporting_evidence || []).map((ev: any) => ({
                            source: ev.source_doc, page: "1", score: 0.0, search_type: "speech_retrieval", text: ev.claim
                          })),
                          context: "",
                          meta: {
                            agent: "speech_planning",
                            plan_id: planRes.plan_id,
                            status: "OUTLINE_PROPOSED",
                            hard_gate_active: true
                          }
                        }
                      }
                    ]);
                  }}
                  onSpeechApproved={(draftRes) => {
                    setTurns((prev) => [
                      ...prev,
                      {
                        id: generateId(),
                        query: "Approved Speech Plan & Generated Draft",
                        result: {
                          session_id: sessionId || "",
                          answer: draftRes.final_speech,
                          chunks: [],
                          context: "",
                          meta: {
                            agent: "speech_planning_draft",
                            plan_id: draftRes.plan_id,
                            execution_trace: ["Stage 2 Speech Draft generated successfully from approved outline."],
                            tokens_in: 600,
                            tokens_out: 1500,
                            cost_usd: 0.002,
                            time_seconds: 2.5,
                            calc_log: [],
                            cached: false,
                            blocked: false
                          }
                        },
                        timestamp: new Date()
                      }
                    ]);
                  }}
                />
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
            placeholder="Ask a question, request an email draft, or generate a report… (Enter to send)"
            rows={2}
            disabled={loading}
            className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none disabled:opacity-50"
          />
          <div className="flex items-center justify-between px-4 pb-3">
            <div className="flex items-center gap-2 relative">
              <button
                type="button"
                onClick={() => setSelectedAgent(selectedAgent === "draft_email" ? null : "draft_email")}
                disabled={loading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all disabled:opacity-40 select-none ${selectedAgent === "draft_email"
                  ? "bg-ndap-sky border-ndap-blue text-ndap-blue shadow-sm"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                title="Emailing Agent"
              >
                <span>✉️</span>
                <span>Emailing Agent</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedAgent(selectedAgent === "generate_document" ? null : "generate_document")}
                disabled={loading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all disabled:opacity-40 select-none ${selectedAgent === "generate_document"
                  ? "bg-ndap-sky border-ndap-blue text-ndap-blue shadow-sm"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                title="Generate Report"
              >
                <span>📄</span>
                <span>Generate Report</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedAgent("speech_planning");
                  setShowSpeechModal(true);
                }}
                disabled={loading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all disabled:opacity-40 select-none ${selectedAgent === "speech_planning"
                  ? "bg-ndap-sky border-ndap-blue text-ndap-blue shadow-sm"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                title="Speech Planner Agent"
              >
                <span>🎙️</span>
                <span>Speech Planner</span>
              </button>

              <span className="text-[11px] text-gray-400">
                {sessionId ? `Session: ${sessionId}` : "New session"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => submitQuery(input)}
                disabled={loading || !input.trim()}
                className="flex items-center gap-2 bg-ndap-navy text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-ndap-navyDark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <svg className="w-4 h-4 spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="10" strokeOpacity={0.3} />
                    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                )}
                Analyse
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-[10px] text-gray-400 mt-2">
          Responses are grounded exclusively in indexed datasets. &nbsp;·&nbsp; IDS Intelligence Platform &nbsp;·&nbsp; Powered by <span className="text-gray-500 font-medium">Carnot Research Pvt Ltd</span>
        </p>
      </div>

      {/* Pre-fed Speech Intent Modal */}
      <SpeechIntentModal
        isOpen={showSpeechModal}
        onClose={() => setShowSpeechModal(false)}
        onSubmit={(formattedPrompt) => {
          setShowSpeechModal(false);
          setSelectedAgent("speech_planning");
          submitQuery(formattedPrompt, "speech_planning");
        }}
      />
    </div>
  );
}

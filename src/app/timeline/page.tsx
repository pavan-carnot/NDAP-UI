"use client";

import React, { lazy, Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import TimelineBars, { bucketEnd, bucketLabel } from "@/components/TimelineBars";
import { getTimeline, libraryFileUrl, TimelineInterval, TimelineResult } from "@/lib/api";

const PdfPanel = lazy(() => import("@/components/PdfPanel"));

const INTERVALS: TimelineInterval[] = ["year", "quarter", "month", "week", "day"];
// Clicking a bar zooms into it at the next finer interval
const FINER: Record<TimelineInterval, TimelineInterval> = {
  year: "month", quarter: "month", month: "day", week: "day", day: "day",
};

type Entity = { key: string; name: string };
type PdfTarget = { url: string; page: number; filename: string };

const inputCls = "w-full text-sm px-2.5 py-1.5 rounded-md border border-[#d1c9b8] bg-white focus:outline-none focus:ring-1 focus:ring-[#C9A227]";
const labelCls = "block text-[10px] font-bold text-[#102C57] uppercase tracking-wide mb-1";

function docHref(source: string): string {
  return libraryFileUrl(source);
}

export default function TimelinePage() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [interval, setGroupBy] = useState<TimelineInterval>("month");
  const [entity, setEntity] = useState<Entity | null>(null);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<TimelineResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdf, setPdf] = useState<PdfTarget | null>(null);
  // Views before each bar click, so Back can step out of a zoom
  const [zoomStack, setZoomStack] = useState<{ start: string; end: string; interval: TimelineInterval }[]>([]);

  // ?entity=<key>&name=<name> (from an entity dossier)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const key = p.get("entity");
    if (key) setEntity({ key, name: p.get("name") || key });
    setReady(true);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getTimeline({
        start: start || undefined, end: end || undefined, q: debouncedQ || undefined,
        entity: entity?.key, interval, size: 100,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [ready, start, end, debouncedQ, entity, interval]);

  useEffect(() => { load(); }, [load]);

  function chooseEntity(e: Entity | null) {
    setEntity(e);
    const url = new URL(window.location.href);
    if (e) { url.searchParams.set("entity", e.key); url.searchParams.set("name", e.name); }
    else { url.searchParams.delete("entity"); url.searchParams.delete("name"); }
    window.history.replaceState(null, "", url);
  }

  function zoomInto(date: string) {
    setZoomStack(s => [...s, { start, end, interval }]);
    setStart(date);
    setEnd(bucketEnd(date, interval));
    setGroupBy(FINER[interval]);
  }

  function zoomBack() {
    const prev = zoomStack[zoomStack.length - 1];
    if (!prev) return;
    setZoomStack(zoomStack.slice(0, -1));
    setStart(prev.start);
    setEnd(prev.end);
    setGroupBy(prev.interval);
  }

  function clearRange() {
    setStart("");
    setEnd("");
    setZoomStack([]);
  }

  // PDFs open in the side viewer at the cited page; other formats can't be shown inline
  function openSource(e: React.MouseEvent, source: string, page: string) {
    if (!source.toLowerCase().endsWith(".pdf")) return;
    e.preventDefault();
    setPdf({ url: docHref(source), page: /^\d+$/.test(page) ? Number(page) : 1, filename: source });
  }

  const hasFilters = !!(start || end || q || entity);

  return (
    <div className="flex h-full overflow-hidden bg-[#f8f4ec]">
      <aside className="w-72 flex-shrink-0 flex flex-col border-r border-[#d6cbb0] bg-white overflow-y-auto">
        <div className="px-4 py-3 bg-[#102C57]">
          <h2 className="text-white font-semibold text-sm tracking-wide">Timeline</h2>
          <p className="text-[#94a3b8] text-xs mt-1 leading-snug">
            Dates written in the documents, e.g. &ldquo;12 January 2024&rdquo;, not when the files were uploaded.
          </p>
        </div>
        <div className="px-4 py-4 space-y-4">
          <div>
            <label className={labelCls} htmlFor="tl-q">Text</label>
            <input id="tl-q" value={q} onChange={e => setQ(e.target.value)} placeholder="e.g. patrol, ambush" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls} htmlFor="tl-start">From</label>
              <input id="tl-start" type="date" value={start} max={end || undefined} onChange={e => setStart(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="tl-end">To</label>
              <input id="tl-end" type="date" value={end} min={start || undefined} onChange={e => setEnd(e.target.value)} className={inputCls} />
            </div>
          </div>
          {(start || end) && (
            <button onClick={clearRange} className="text-[11px] text-[#6b5a3e] hover:underline -mt-2">Clear date range</button>
          )}
          <div>
            <label className={labelCls} htmlFor="tl-int">Group by</label>
            <select id="tl-int" value={interval} onChange={e => setGroupBy(e.target.value as TimelineInterval)} className={inputCls}>
              {INTERVALS.map(i => <option key={i} value={i}>{i[0].toUpperCase() + i.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <p className={labelCls}>Entity</p>
            {entity ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="flex-1 min-w-0 truncate px-2 py-1 rounded-md bg-[#F5EDD5] text-[#102C57] font-medium">{entity.name}</span>
                <button onClick={() => chooseEntity(null)} className="text-xs text-[#6b5a3e] hover:underline">Clear</button>
              </div>
            ) : (
              <p className="text-xs text-[#a09070] leading-snug">Click an entity on a passage, or open one from the entity index.</p>
            )}
            {entity && (
              <Link href={`/graph?container=__corpus__&entity=${encodeURIComponent(entity.key)}`}
                    className="inline-block mt-1.5 text-[11px] text-[#6b5a3e] hover:underline">
                Open in entity graph →
              </Link>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-5 space-y-5">
          {error ? (
            <p className="text-sm text-[#b91c1c]">Couldn&apos;t load the timeline: {error}</p>
          ) : !data ? (
            <p className="text-sm text-[#a09070]">Loading timeline…</p>
          ) : (
            <>
              <section className="bg-white rounded-lg border border-[#e2d9c8] px-5 py-4">
                <div className="flex items-baseline justify-between gap-4 mb-3">
                  <h3 className="text-sm font-semibold text-[#102C57] flex items-center gap-2">
                    {zoomStack.length > 0 && (
                      <button onClick={zoomBack}
                              title="Go back to the previous view"
                              className="text-xs font-medium px-2 py-0.5 rounded-md border border-[#d1c9b8] text-[#102C57] hover:bg-[#F5EDD5]">
                        ← Back
                      </button>
                    )}
                    <span>Dated mentions per {interval}
                    {entity && <span className="font-normal text-[#78716c]"> · {entity.name}</span>}</span>
                  </h3>
                  <p className="text-xs text-[#78716c] tabular-nums">
                    {data.total} passage{data.total === 1 ? "" : "s"}
                    {data.date_min && data.date_max && !start && !end && ` · ${data.date_min} to ${data.date_max}`}
                    {loading && " · updating…"}
                  </p>
                </div>
                {data.buckets.length > 0 ? (
                  <>
                    <TimelineBars buckets={data.buckets} interval={interval} onSelect={zoomInto} />
                    <p className="text-[11px] text-[#a09070] mt-2">Click a bar to zoom into that period.</p>
                    <details className="mt-2">
                      <summary className="text-[11px] text-[#6b5a3e] cursor-pointer">Show as table</summary>
                      <table className="mt-2 text-xs">
                        <thead>
                          <tr className="text-left text-[#78716c]">
                            <th className="pr-6 font-medium">Period</th>
                            <th className="font-medium text-right">Mentions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.buckets.map(b => (
                            <tr key={b.date}>
                              <td className="pr-6">{bucketLabel(b.date, interval)}</td>
                              <td className="text-right tabular-nums">{b.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  </>
                ) : (
                  <p className="text-sm text-[#a09070] py-6 text-center">
                    {hasFilters ? "No dated passages match these filters" : "No dated passages indexed yet"}
                  </p>
                )}
              </section>

              {data.hits.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-[#102C57] mb-2">
                    Passages, earliest first{data.total > data.hits.length && (
                      <span className="font-normal text-[#78716c]"> (first {data.hits.length} of {data.total})</span>
                    )}
                  </h3>
                  <ul className="space-y-2">
                    {data.hits.map((h, i) => (
                      <li key={`${h.source}-${h.page}-${i}`} className="bg-white rounded-lg border border-[#e2d9c8] px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          {h.dates.slice(0, 6).map(d => (
                            <span key={d} className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[#102C57] text-white">{d}</span>
                          ))}
                          <a href={docHref(h.source)} target="_blank" rel="noreferrer" onClick={e => openSource(e, h.source, h.page)}
                             className="text-xs text-[#102C57] hover:underline ml-1 break-all">
                            {h.source}
                          </a>
                          <span className="text-xs text-[#a09070]">p. {h.page}</span>
                        </div>
                        <p className="text-sm text-[#1e293b] leading-relaxed line-clamp-4 whitespace-pre-line">{h.text}</p>
                        {h.entities.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {h.entities.map(e => (
                              <button key={e.key} onClick={() => chooseEntity(e)}
                                      className={`text-[11px] px-2 py-0.5 rounded-full border hover:bg-[#F5EDD5] ${entity?.key === e.key ? "border-[#C9A227] bg-[#F5EDD5]" : "border-[#e2d9c8]"}`}>
                                {e.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </main>

      {pdf && (
        <div className="hidden lg:flex flex-col w-[420px] xl:w-[480px] flex-shrink-0 border-l border-[#d6cbb0]">
          <Suspense fallback={<div className="flex-1 flex items-center justify-center text-xs text-gray-400">Loading viewer…</div>}>
            <PdfPanel url={pdf.url} page={pdf.page} filename={pdf.filename} onClose={() => setPdf(null)} />
          </Suspense>
        </div>
      )}
    </div>
  );
}

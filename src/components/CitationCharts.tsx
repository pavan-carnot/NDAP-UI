"use client";

import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from "recharts";
import { getChartList, getChartData, ChartConfig, ChartDataPoint } from "@/lib/api";

// ── Module-level chart list cache ─────────────────────────────────────────────
let _chartListCache: ChartConfig[] | null = null;
let _chartListPromise: Promise<ChartConfig[]> | null = null;

function getCachedChartList(): Promise<ChartConfig[]> {
  if (_chartListCache) return Promise.resolve(_chartListCache);
  if (!_chartListPromise) {
    _chartListPromise = getChartList().then(list => {
      _chartListCache = list;
      return list;
    });
  }
  return _chartListPromise;
}

// ── Query → chart relevance scorer ───────────────────────────────────────────
// Scores a chart config against the raw user query text.
// Checks metric, title, and description; returns 0 if no meaningful match.
function scoreChartForQuery(config: ChartConfig, query: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/[_\-]/g, " ").trim();
  const q = norm(query);
  const targets = [
    { text: norm(config.metric), weight: 3 },
    { text: norm(config.title), weight: 2 },
    { text: norm(config.description ?? ""), weight: 1 },
  ];

  let best = 0;
  for (const { text, weight } of targets) {
    if (text === q) { best = Math.max(best, 100 * weight); continue; }
    if (text.includes(q) || q.includes(text)) { best = Math.max(best, 50 * weight); continue; }
    const qWords = q.split(/\s+/).filter(w => w.length > 3);
    const tWords = text.split(/\s+/);
    let wordScore = 0;
    for (const qw of qWords) {
      if (tWords.some(tw => tw.includes(qw) || qw.includes(tw))) wordScore += qw.length > 5 ? 3 : 1;
    }
    best = Math.max(best, wordScore * weight);
  }
  return best;
}

const COLORS = ["#1565C0", "#2E7D32", "#C62828", "#6A1B9A", "#E65100", "#00695C"];

// ── Compact chart renderer ────────────────────────────────────────────────────
function CompactChart({ config, data }: { config: ChartConfig; data: ChartDataPoint[] }) {
  if (config.chart_type === "line") {
    const states = [...new Set(data.map(d => d.state).filter(Boolean))] as string[];
    if (states.length > 1) {
      const topStates = states.slice(0, 6);
      const pivotMap: Record<string, Record<string, number | null>> = {};
      data.forEach(d => {
        if (!d.state || !topStates.includes(d.state)) return;
        if (!pivotMap[d.name]) pivotMap[d.name] = {};
        pivotMap[d.name][d.state] = d.value;
      });
      const pivotData = Object.entries(pivotMap).map(([name, vals]) => ({ name, ...vals }));
      return (
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={pivotData} margin={{ top: 4, right: 16, left: 4, bottom: 55 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0F2F1" />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#555" }} angle={-30} textAnchor="end" height={55} />
            <YAxis tick={{ fontSize: 9, fill: "#555" }} width={40} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {topStates.map((s, i) => (
              <Line key={s} type="monotone" dataKey={s} stroke={COLORS[i % COLORS.length]}
                strokeWidth={1.5} dot={false} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );
    }
    return (
      <ResponsiveContainer width="100%" height={210}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 4, bottom: 55 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E0F2F1" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#555" }} angle={-30} textAnchor="end" height={55} />
          <YAxis tick={{ fontSize: 9, fill: "#555" }} width={40} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#1565C0" strokeWidth={2}
            dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Bar types — top 10 horizontal
  const top = [...data].sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 10);
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, top.length * 24)}>
      <BarChart data={top} layout="vertical" margin={{ top: 4, right: 40, left: 130, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E3F2FD" />
        <XAxis type="number" tick={{ fontSize: 9, fill: "#555" }}
          tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "#333" }} width={125} />
        <Tooltip />
        <Bar dataKey="value" fill="#1565C0" radius={[0, 3, 3, 0]} maxBarSize={14} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CitationCharts({
  query,
}: {
  query: string;
}) {
  const [matchedChart, setMatchedChart] = useState<{ config: ChartConfig; data: ChartDataPoint[] } | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [fetchState, setFetchState] = useState<"idle" | "loading" | "done">("idle");

  useEffect(() => {
    if (!query?.trim()) return;
    let cancelled = false;
    setFetchState("loading");
    setMatchedChart(null);

    async function load() {
      try {
        const list = await getCachedChartList();
        // Exclude bar_state types — those are already covered by the map visualization
        const candidates = list.filter(
          c => c.chart_type !== "bar_state" && c.chart_type !== "bar_state_timeaskey"
        );

        // Pick the single best scoring candidate
        let best: ChartConfig | null = null;
        let bestScore = 0;
        for (const c of candidates) {
          const score = scoreChartForQuery(c, query);
          if (score > bestScore) { bestScore = score; best = c; }
        }

        if (!best || bestScore < 3) {
          if (!cancelled) setFetchState("done");
          return;
        }

        // Only fetch that one chart — if it has no data, show nothing
        const res = await getChartData(best.id);
        if (res.data.length > 0 && !cancelled) {
          setMatchedChart({ config: res.config, data: res.data });
        }
        if (!cancelled) setFetchState("done");
      } catch {
        if (!cancelled) setFetchState("done");
      }
    }

    load();
    return () => { cancelled = true; };
  }, [query]);

  if (fetchState !== "done" || !matchedChart) return null;

  return (
    <div className="mt-3 bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm text-sm">
      <button
        onClick={() => setIsOpen(o => !o)}
        className="w-full px-4 py-2 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left font-medium text-gray-700 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <span>View Chart: <span className="font-semibold text-[#003087]">{matchedChart.config.title}</span></span>
        </span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-3">
          {matchedChart.config.description && (
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">{matchedChart.config.description}</p>
          )}
          {matchedChart.config.unit && matchedChart.config.unit !== "various" && (
            <span className="inline-block bg-[#E3F2FD] text-[#1565C0] text-[10px] font-semibold px-2.5 py-0.5 rounded-full mb-3">
              Unit: {matchedChart.config.unit}
            </span>
          )}
          <CompactChart config={matchedChart.config} data={matchedChart.data} />
          <p className="text-[10px] text-gray-400 mt-3 text-right">
            Source: <span className="font-medium">MNRE · {matchedChart.config.metric}</span>
          </p>
        </div>
      )}
    </div>
  );
}

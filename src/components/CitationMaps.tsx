"use client";

import { useState, useEffect } from "react";
import InlineMap from "./InlineMap";
import { getMapMetrics } from "@/lib/api";

interface Citation {
  source: string;
}

function bigramSet(s: string): Set<string> {
  const bg = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) bg.add(s.slice(i, i + 2));
  return bg;
}

function metricSimilarity(metric: string, intent: string): number {
  const m = metric.toLowerCase().replace(/[_\-]/g, " ");
  const i = intent.toLowerCase().replace(/[_\-]/g, " ");

  if (m === i) return 1000;
  if (m.includes(i) || i.includes(m)) return 100;

  // Word-level: score per matching word (weighted by length)
  const intentWords = i.split(/\s+/).filter(w => w.length > 2);
  const metricWords = m.split(/\s+/);
  let wordScore = 0;
  for (const iw of intentWords) {
    if (metricWords.some(mw => mw.includes(iw) || iw.includes(mw))) {
      wordScore += iw.length > 3 ? 2 : 1;
    }
  }
  if (wordScore > 0) return wordScore;

  // Bigram Jaccard as last resort
  const mBg = bigramSet(m);
  const iBg = bigramSet(i);
  const intersection = [...iBg].filter(bg => mBg.has(bg)).length;
  const union = new Set([...mBg, ...iBg]).size;
  const jaccard = union > 0 ? intersection / union : 0;
  return jaccard >= 0.3 ? jaccard : 0;
}

export default function CitationMaps({
  citations,
  focusStates,
  intentMetric,
}: {
  citations: Citation[];
  focusStates?: string[];
  intentMetric?: string;
}) {
  const [metrics, setMetrics] = useState<{ sourceFile: string; metric: string }[]>([]);

  useEffect(() => {
    async function load() {
      const allMetrics = new Set<string>();
      for (const cit of citations) {
        try {
          const mets = await getMapMetrics(cit.source);
          if (mets) {
            for (const m of mets) allMetrics.add(m);
          }
        } catch {
          // document has no map data — skip silently
        }
      }

      const metsArr = Array.from(allMetrics);
      if (metsArr.length === 0) { setMetrics([]); return; }

      if (intentMetric) {
        // Score every metric; only accept best if score > 0
        let bestScore = 0;
        let bestMetric: string | null = null;
        for (const m of metsArr) {
          const score = metricSimilarity(m, intentMetric);
          if (score > bestScore) { bestScore = score; bestMetric = m; }
        }
        // No meaningful match → hide map rather than show random metric
        setMetrics(bestMetric ? [{ sourceFile: "visual_timeseries", metric: bestMetric }] : []);
      } else {
        // No intent provided — show first available metric
        setMetrics([{ sourceFile: "visual_timeseries", metric: metsArr[0] }]);
      }
    }
    if (citations.length > 0) load();
  }, [citations, intentMetric]);

  if (metrics.length === 0) return null;

  return (
    <div className="mt-4 pt-3.5 border-t border-gray-100 flex flex-col gap-2">
      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">
        Available Map Visualizations
      </div>
      {metrics.map(m => (
        <InlineMap
          key={`${m.sourceFile}-${m.metric}`}
          sourceFile={m.sourceFile}
          metric={m.metric}
          focusStates={focusStates}
        />
      ))}
    </div>
  );
}

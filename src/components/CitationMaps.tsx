"use client";

import { useState, useEffect } from "react";
import InlineMap from "./InlineMap";
import { getMapMetrics } from "@/lib/api";

interface Citation {
  source: string;
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

      if (metsArr.length > 0) {
        let bestMatch = metsArr[0];
        if (intentMetric) {
          const intentWords = intentMetric.toLowerCase().split(/[\s_]+/);
          let maxScore = -1;
          for (const m of metsArr) {
            const mLower = m.toLowerCase();
            let score = 0;
            for (const iw of intentWords) {
              if (iw.length > 3 && mLower.includes(iw)) score++;
              else if (mLower.split(/[\s_]+/).includes(iw)) score++;
            }
            if (score > maxScore) {
              maxScore = score;
              bestMatch = m;
            }
          }
        }
        setMetrics([{ sourceFile: "visual_timeseries", metric: bestMatch }]);
      } else {
        setMetrics([]);
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

"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  getEntities,
  getEntityTypeCounts,
  getGraphVisualize,
  getEntityDossier,
  EntityItem,
  EntityDossier,
} from "@/lib/api";

const TYPE_COLORS: Record<string, string> = {
  PERSON: "#6366f1",
  ORG:    "#10b981",
  GPE:    "#f59e0b",
  LOC:    "#14b8a6",
  EVENT:  "#f43f5e",
};

const TYPE_LABELS: Record<string, string> = {
  ALL:    "All",
  PERSON: "Person",
  ORG:    "Organisation",
  GPE:    "Location",
  LOC:    "Place",
  EVENT:  "Event",
};

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide text-white"
      style={{ background: TYPE_COLORS[type] ?? "#64748b" }}
    >
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

export default function GraphPage() {
  const [entities, setEntities] = useState<EntityItem[]>([]);
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
  const [activeType, setActiveType] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loadingEntities, setLoadingEntities] = useState(false);

  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [graphHtml, setGraphHtml] = useState<string>("");
  const [dossier, setDossier] = useState<EntityDossier | null>(null);
  const [loadingGraph, setLoadingGraph] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchEntities = useCallback(async (type: string, q: string) => {
    setLoadingEntities(true);
    try {
      const data = await getEntities({ type: type === "ALL" ? undefined : type, search: q || undefined, limit: 100 });
      setEntities(data);
    } catch {
      setEntities([]);
    } finally {
      setLoadingEntities(false);
    }
  }, []);

  useEffect(() => {
    getEntityTypeCounts().then(setTypeCounts).catch(() => {});
    fetchEntities("ALL", "");
  }, [fetchEntities]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchEntities(activeType, search), 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [activeType, search, fetchEntities]);

  const selectEntity = useCallback(async (name: string) => {
    setSelectedEntity(name);
    setLoadingGraph(true);
    setGraphHtml("");
    setDossier(null);
    try {
      const [html, dos] = await Promise.all([
        getGraphVisualize(name, 2),
        getEntityDossier(name),
      ]);
      setGraphHtml(html);
      setDossier(dos);
    } catch {
      setGraphHtml("");
    } finally {
      setLoadingGraph(false);
    }
  }, []);

  const TABS = ["ALL", "PERSON", "ORG", "GPE", "LOC", "EVENT"];

  return (
    <div className="flex h-full overflow-hidden bg-[#f8f4ec]">

      {/* ── Left panel — Entity browser ─────────────────────────────────── */}
      <aside className="w-72 flex-shrink-0 flex flex-col border-r border-[#d6cbb0] bg-white overflow-hidden">
        <div className="px-4 py-3 bg-[#102C57]">
          <h2 className="text-white font-semibold text-sm tracking-wide">Entity Browser</h2>
          <p className="text-[#94a3b8] text-xs mt-0.5">
            {Object.values(typeCounts).reduce((a, b) => a + b, 0)} entities extracted
          </p>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-[#e2d9c8]">
          <input
            type="text"
            placeholder="Search entities…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-sm px-3 py-1.5 rounded border border-[#d1c9b8]
                       bg-[#faf8f4] focus:outline-none focus:ring-1 focus:ring-[#C9A227]
                       placeholder-[#a09070]"
          />
        </div>

        {/* Type tabs */}
        <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-[#e2d9c8]">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setActiveType(t)}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase transition-colors ${
                activeType === t
                  ? "text-white"
                  : "bg-[#f0ebe0] text-[#6b5a3e] hover:bg-[#e8e0d0]"
              }`}
              style={activeType === t ? { background: t === "ALL" ? "#102C57" : TYPE_COLORS[t] } : {}}
            >
              {TYPE_LABELS[t]}
              {t !== "ALL" && typeCounts[t] ? ` (${typeCounts[t]})` : ""}
            </button>
          ))}
        </div>

        {/* Entity list */}
        <div className="flex-1 overflow-y-auto">
          {loadingEntities ? (
            <div className="flex items-center justify-center h-32 text-[#a09070] text-sm">
              Loading…
            </div>
          ) : entities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-[#a09070] text-sm gap-1">
              <span>No entities found</span>
              {!typeCounts["PERSON"] && (
                <span className="text-xs text-center px-4">
                  Ingest documents to extract entities
                </span>
              )}
            </div>
          ) : (
            entities.map(ent => (
              <button
                key={`${ent.name}-${ent.type}`}
                onClick={() => selectEntity(ent.name)}
                className={`w-full text-left px-3 py-2 border-b border-[#f0ebe0] transition-colors
                            hover:bg-[#F5EDD5] flex items-start gap-2
                            ${selectedEntity === ent.name ? "bg-[#F5EDD5] border-l-2 border-l-[#C9A227]" : ""}`}
              >
                <TypeBadge type={ent.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1e293b] truncate">{ent.name}</p>
                  <p className="text-[10px] text-[#78716c]">
                    {ent.mention_count} mention{ent.mention_count !== 1 ? "s" : ""} · {ent.doc_count} doc{ent.doc_count !== 1 ? "s" : ""}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* ── Right panel — Graph viewer ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedEntity ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-[#a09070]">
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
              <circle cx="14" cy="14" r="8" stroke="#C9A227" strokeWidth="2"/>
              <circle cx="42" cy="14" r="8" stroke="#6366f1" strokeWidth="2"/>
              <circle cx="28" cy="42" r="8" stroke="#10b981" strokeWidth="2"/>
              <line x1="14" y1="14" x2="42" y2="14" stroke="#d1c9b8" strokeWidth="1.5"/>
              <line x1="14" y1="14" x2="28" y2="42" stroke="#d1c9b8" strokeWidth="1.5"/>
              <line x1="42" y1="14" x2="28" y2="42" stroke="#d1c9b8" strokeWidth="1.5"/>
            </svg>
            <p className="text-base font-medium text-[#78716c]">Select an entity to explore its connections</p>
            <p className="text-sm text-[#a09070]">Click any entity in the browser on the left</p>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Header bar */}
            <div className="flex items-center gap-3 px-4 py-2.5 bg-[#102C57] border-b border-[#1e3a6e]">
              <TypeBadge type={dossier?.type ?? ""} />
              <span className="text-white font-semibold">{selectedEntity}</span>
              {dossier && (
                <span className="text-[#94a3b8] text-xs ml-auto">
                  {dossier.mentions} mentions · {dossier.source_files.length} documents
                </span>
              )}
            </div>

            {/* Graph iframe */}
            <div className="flex-1 relative min-h-0">
              {loadingGraph && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0f1729] z-10">
                  <div className="flex gap-2 items-center text-[#94a3b8] text-sm">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10"/>
                    </svg>
                    Building network graph…
                  </div>
                </div>
              )}
              {graphHtml && (
                <iframe
                  srcDoc={graphHtml}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts"
                  title={`Network graph for ${selectedEntity}`}
                />
              )}
            </div>

            {/* Dossier panel */}
            {dossier && (
              <div className="flex-shrink-0 border-t border-[#d6cbb0] bg-white px-4 py-3 max-h-48 overflow-y-auto">
                <p className="text-xs text-[#78716c] mb-2 leading-relaxed">{dossier.summary}</p>
                <div className="flex gap-6">
                  {dossier.connected_entities.length > 0 && (
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-[#102C57] uppercase tracking-wide mb-1">Connected Entities</p>
                      <div className="flex flex-wrap gap-1">
                        {dossier.connected_entities.slice(0, 10).map(c => (
                          <button
                            key={c.name}
                            onClick={() => selectEntity(c.name)}
                            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full
                                       border border-[#e2d9c8] hover:bg-[#F5EDD5] transition-colors"
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ background: TYPE_COLORS[c.type] ?? "#94a3b8" }}
                            />
                            {c.name}
                            <span className="text-[#a09070]">×{c.weight}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {dossier.source_files.length > 0 && (
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-[#102C57] uppercase tracking-wide mb-1">Source Documents</p>
                      <div className="flex flex-col gap-0.5">
                        {dossier.source_files.slice(0, 5).map(f => (
                          <span key={f} className="text-[11px] text-[#6b5a3e] truncate">📄 {f}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

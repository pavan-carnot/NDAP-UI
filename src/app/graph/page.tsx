"use client";

import React, { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import CreateGraph from "@/components/CreateGraph";
import EntityDossier from "@/components/EntityDossier";
import {
  getEntityGraph, getEntityTypes, getGraphData, searchEntities, EntityHit, KgGraphData,
} from "@/lib/api";
import { useContainers, loadActiveContainer } from "@/lib/use-containers";

const GraphComponent = dynamic(() => import("@/components/GraphComponent"), { ssr: false });

const SESSION_KEY = "ndap_kg_session";
const ADHOC = "";   // select value for an ad-hoc session (documents picked by hand)
const CORPUS = "__corpus__";   // the entity index of every library document, built at ingest

function newSessionId() {
  return `kg-${crypto.randomUUID().slice(0, 8)}`;
}

function loadSessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = newSessionId();
    localStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return newSessionId();
  }
}

export default function GraphPage() {
  const { containers, loaded: containersLoaded } = useContainers();
  // Knowledge container whose graph is shown; ADHOC = the older pick-documents session
  const [containerId, setContainerId] = useState<string | null>(null);
  const [adhocId, setAdhocId] = useState<string | null>(null);
  const [data, setData] = useState<KgGraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Entity index: entity the graph is centred on (null = most-mentioned overview)
  const [center, setCenter] = useState<string | null>(null);

  // ?container=<id> (from the sidebar's "Knowledge graph" action) wins over the active container
  useEffect(() => {
    setAdhocId(loadSessionId());
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("container");
    const active = loadActiveContainer();
    setCenter(params.get("entity"));
    setContainerId(fromUrl ?? (active && active !== "general" ? active : ADHOC));
  }, []);

  const isCorpus = containerId === CORPUS;
  const container = containers.find(c => c.session_id === containerId) ?? null;

  // Fall back to the ad-hoc session if the requested container doesn't exist
  useEffect(() => {
    if (containersLoaded && containerId && !isCorpus && !container) setContainerId(ADHOC);
  }, [containersLoaded, containerId, isCorpus, container]);

  const sessionId = containerId === null ? null : containerId || adhocId;
  const waiting = containerId === null || (!!containerId && !isCorpus && !container);

  const loadGraph = useCallback(async () => {
    if (!sessionId || waiting) return;
    setLoading(true);
    setLoadError(null);
    try {
      setData(isCorpus ? await getEntityGraph(center) : await getGraphData(sessionId));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [sessionId, waiting, isCorpus, center]);

  // The graph lives in Neo4j, so load it even if the in-memory build status was lost
  useEffect(() => { setData(null); loadGraph(); }, [loadGraph]);

  function chooseContainer(id: string) {
    setContainerId(id);
    setCenter(null);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("container", id); else url.searchParams.delete("container");
    url.searchParams.delete("entity");
    window.history.replaceState(null, "", url);
  }

  function centerOn(key: string | null) {
    setCenter(key);
    const url = new URL(window.location.href);
    if (key) url.searchParams.set("entity", key); else url.searchParams.delete("entity");
    window.history.replaceState(null, "", url);
  }

  function startNewSession() {
    const id = newSessionId();
    try { localStorage.setItem(SESSION_KEY, id); } catch { /* storage unavailable */ }
    setData(null);
    setAdhocId(id);
  }

  const hasGraph = !!data && data.nodes.length > 0;
  const readyFiles = container?.files.filter(f => f.status === "active").map(f => f.filename);

  return (
    <div className="flex h-full overflow-hidden bg-[#f8f4ec]">
      <aside className="w-72 flex-shrink-0 flex flex-col border-r border-[#d6cbb0] bg-white overflow-y-auto">
        <div className="px-4 py-3 bg-[#102C57]">
          <h2 className="text-white font-semibold text-sm tracking-wide">Knowledge Graph</h2>
          <label className="block mt-2">
            <span className="sr-only">Knowledge container</span>
            <select
              value={containerId ?? ADHOC}
              onChange={e => chooseContainer(e.target.value)}
              className="w-full text-xs rounded bg-white/10 text-white border border-white/20 px-2 py-1.5 focus:outline-none [&>option]:text-gray-900"
            >
              <option value={CORPUS}>All documents (entity index)</option>
              {containers.map(c => (
                <option key={c.session_id} value={c.session_id}>{c.name}</option>
              ))}
              <option value={ADHOC}>Ad-hoc session (pick documents)</option>
            </select>
          </label>
          {containerId === ADHOC && (
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[#94a3b8] text-xs font-mono">{adhocId ?? "…"}</p>
              <button onClick={startNewSession} className="text-[11px] text-[#C9A227] hover:underline">
                New session
              </button>
            </div>
          )}
        </div>
        {container?.is_shared && (
          <p className="px-4 py-3 text-xs text-[#78716c] leading-snug">
            Shared by {container.shared_by}. Only the owner can build this container&apos;s graph.
          </p>
        )}
        {isCorpus && <EntityExplorer center={center} onCenter={centerOn} />}
        {sessionId && !waiting && !isCorpus && !container?.is_shared && (
          <CreateGraph
            key={sessionId}
            sessionId={sessionId}
            onCompleted={loadGraph}
            fixedFiles={container ? readyFiles : undefined}
            fixedLabel={container?.name}
          />
        )}
      </aside>

      <main className="flex-1 min-w-0 min-h-0">
        {(loading && !data) || waiting ? (
          <div className="flex items-center justify-center h-full text-sm text-[#a09070]">Loading graph…</div>
        ) : loadError ? (
          <div className="flex items-center justify-center h-full text-sm text-[#b91c1c] px-8 text-center">
            Couldn&apos;t load the graph: {loadError}
          </div>
        ) : hasGraph ? (
          <GraphComponent
            key={isCorpus ? `corpus-${center ?? ""}` : sessionId ?? ""}
            data={data!}
            initialSelectedId={isCorpus ? center : null}
            entityExtra={isCorpus
              ? node => <EntityDossier entityKey={node.id} centered={node.id === center} onCenter={centerOn} />
              : undefined}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-[#a09070]">
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
              <circle cx="14" cy="14" r="8" stroke="#C9A227" strokeWidth="2"/>
              <circle cx="42" cy="14" r="8" stroke="#6366f1" strokeWidth="2"/>
              <circle cx="28" cy="42" r="8" stroke="#10b981" strokeWidth="2"/>
              <line x1="14" y1="14" x2="42" y2="14" stroke="#d1c9b8" strokeWidth="1.5"/>
              <line x1="14" y1="14" x2="28" y2="42" stroke="#d1c9b8" strokeWidth="1.5"/>
              <line x1="42" y1="14" x2="28" y2="42" stroke="#d1c9b8" strokeWidth="1.5"/>
            </svg>
            <p className="text-base font-medium text-[#78716c]">
              {isCorpus ? "No entities indexed yet" : container ? `No graph for ${container.name} yet` : "No graph for this session yet"}
            </p>
            <p className="text-sm">
              {isCorpus
                ? "Entities are extracted as documents are ingested. For documents ingested earlier, run backfill_entities.py"
                : container?.is_shared
                ? "Its owner hasn't built one yet"
                : container ? "Create a graph from this container's documents on the left" : "Select documents on the left and create a graph"}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Entity index sidebar ─────────────────────────────────────────────────────

function EntityExplorer({ center, onCenter }: { center: string | null; onCenter: (key: string | null) => void }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [types, setTypes] = useState<{ type: string; count: number }[]>([]);
  const [hits, setHits] = useState<EntityHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEntityTypes().then(setTypes).catch(() => setTypes([]));
  }, []);

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      searchEntities(q, type || null, 60)
        .then(h => { if (live) { setHits(h); setError(null); } })
        .catch(e => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [q, type]);

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="px-4 py-3 space-y-2 border-b border-[#e2d9c8]">
        <p className="text-xs text-[#78716c] leading-snug">
          People, units, places, equipment and events found in every library document, linked across documents.
        </p>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search entities…"
          className="w-full text-sm px-3 py-1.5 rounded-md border border-[#d1c9b8] focus:outline-none focus:ring-1 focus:ring-[#C9A227]"
        />
        <select
          value={type}
          onChange={e => setType(e.target.value)}
          className="w-full text-xs px-2 py-1.5 rounded-md border border-[#d1c9b8] bg-white"
        >
          <option value="">All types</option>
          {types.map(t => <option key={t.type} value={t.type}>{t.type} ({t.count})</option>)}
        </select>
        {center && (
          <button onClick={() => onCenter(null)} className="text-[11px] text-[#6b5a3e] hover:underline">
            ← Back to overview (most-mentioned entities)
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {error ? (
          <p className="px-4 py-3 text-xs text-[#b91c1c]">{error}</p>
        ) : hits === null ? (
          <p className="px-4 py-3 text-xs text-[#a09070]">Loading…</p>
        ) : hits.length === 0 ? (
          <p className="px-4 py-3 text-xs text-[#a09070]">No matching entities</p>
        ) : (
          <ul>
            {hits.map(h => (
              <li key={h.key}>
                <button
                  onClick={() => onCenter(h.key)}
                  className={`w-full text-left px-4 py-1.5 text-xs flex items-baseline gap-2 hover:bg-[#F5EDD5] ${h.key === center ? "bg-[#F5EDD5]" : ""}`}
                >
                  <span className="flex-1 min-w-0 truncate text-[#1e293b] font-medium">{h.name}</span>
                  <span className="text-[#a09070] whitespace-nowrap">{h.type}</span>
                  <span className="text-[#a09070] tabular-nums w-10 text-right" title="documents">{h.docs} doc{h.docs === 1 ? "" : "s"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

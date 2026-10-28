"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { KgGraphData, KgNode, KgRelationship } from "@/lib/api";

// ── Entity categories ────────────────────────────────────────────────────────
// LLM labels are free-form (Person, Author, Company, City…), so they're folded into
// a fixed set of categories. Each category owns one colour that never changes with
// filtering; generic concepts and rare types share a recessive grey so specific
// entities stand out. Palette validated (CVD/normal-vision) on the #fbf9f4 surface.

interface Category { key: string; name: string; color: string; match: RegExp }

const CATEGORIES: Category[] = [
  { key: "person",   name: "Person",            color: "#2a78d6", match: /person|people|author|individual|researcher|official|leader/i },
  { key: "org",      name: "Organization",      color: "#eb6834", match: /org|company|institut|ministry|department|agency|university|government|committee|bank/i },
  { key: "place",    name: "Location",          color: "#1baf7a", match: /locat|place|city|state|country|gpe|region|district|village/i },
  { key: "event",    name: "Event",             color: "#eda100", match: /event|conference|meeting|summit/i },
  { key: "date",     name: "Date / Time",       color: "#e87ba4", match: /date|year|time|period|month/i },
  { key: "metric",   name: "Metric",            color: "#008300", match: /metric|statistic|number|value|quantity|measure|percent|amount|indicator/i },
  { key: "document", name: "Document / Source", color: "#6250d6", match: /document|publication|report|paper|book|url|reference|journal|article|figure|table/i },
  { key: "policy",   name: "Scheme / Policy",   color: "#e34948", match: /scheme|policy|program|law|act\b|initiative|mission|regulation/i },
];
const OTHER: Category = { key: "other", name: "Concept / Other", color: "#a8a29e", match: /.*/ };

function categoryOf(label: string): Category {
  return CATEGORIES.find(c => c.match.test(label)) ?? OTHER;
}

const SAME_AS = "SAME_AS";
const EDGE_COLOR = "#cfc8ba";
const EDGE_ACTIVE = "#102C57";
const LIMIT_OPTIONS = [100, 250, 500, 0]; // 0 = all

// ── Simulation types ─────────────────────────────────────────────────────────

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  label: string;
  cat: Category;
  degree: number;
  rank: number;
  radius: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  id: string;
  caption: string;
  curve: number; // signed offset for parallel edges, 0 = straight
}

const primaryLabel = (n: KgNode) => n.labels[0] ?? "Entity";
const endId = (e: string | number | SimNode) => (typeof e === "object" ? e.id : String(e));

function linkPath(l: SimLink, arrow: boolean): string {
  const s = l.source as SimNode, t = l.target as SimNode;
  const sx = s.x ?? 0, sy = s.y ?? 0, tx = t.x ?? 0, ty = t.y ?? 0;
  const dist = Math.hypot(tx - sx, ty - sy) || 1;
  const nx = -(ty - sy) / dist, ny = (tx - sx) / dist;
  const cx = (sx + tx) / 2 + nx * l.curve, cy = (sy + ty) / 2 + ny * l.curve;
  const pull = arrow ? t.radius + 3 : t.radius;
  const el = Math.hypot(tx - cx, ty - cy) || 1;
  const ex = tx - ((tx - cx) / el) * pull, ey = ty - ((ty - cy) / el) * pull;
  return l.curve === 0 ? `M${sx},${sy} L${ex},${ey}` : `M${sx},${sy} Q${cx},${cy} ${ex},${ey}`;
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

// ── Component ────────────────────────────────────────────────────────────────

export default function GraphComponent({ data }: { data: KgGraphData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const labelRef = useRef<(k: number) => void>(() => {});
  const zoomKRef = useRef(1);
  const selectedIdRef = useRef<string | null>(null);
  const setSelectedInDrawingRef = useRef<(id: string | null) => void>(() => {});

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusHops, setFocusHops] = useState(1);
  const [limit, setLimit] = useState(100);
  const [showAliases, setShowAliases] = useState(false);
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── Alias folding: SAME_AS alias nodes become names on their canonical entity ──
  const { aliasOf, aliasesOf } = useMemo(() => {
    const aliasOf = new Map<string, string>();
    const aliasesOf = new Map<string, string[]>();
    const nameById = new Map(data.nodes.map(n => [n.id, n.name]));
    data.relationships.filter(r => r.type === SAME_AS).forEach(r => {
      aliasOf.set(r.from, r.to);
      aliasesOf.set(r.to, [...(aliasesOf.get(r.to) ?? []), nameById.get(r.from) ?? r.from]);
    });
    return { aliasOf, aliasesOf };
  }, [data]);

  const labelCounts = useMemo(() => {
    const m = new Map<string, number>();
    data.nodes.forEach(n => {
      if (!showAliases && aliasOf.has(n.id)) return;
      m.set(primaryLabel(n), (m.get(primaryLabel(n)) ?? 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [data, aliasOf, showAliases]);

  const relCounts = useMemo(() => {
    const m = new Map<string, number>();
    data.relationships.forEach(r => {
      if (r.type === SAME_AS && !showAliases) return;
      m.set(r.type, (m.get(r.type) ?? 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [data, showAliases]);

  const [hiddenLabels, setHiddenLabels] = useState<Set<string>>(new Set());
  const [hiddenRels, setHiddenRels] = useState<Set<string>>(new Set());

  useEffect(() => {
    setHiddenLabels(new Set());
    setHiddenRels(new Set());
    setSelectedId(null);
    setFocusId(null);
  }, [data]);

  // Graph after alias folding + label/relationship filters (before top-N / focus)
  const baseGraph = useMemo(() => {
    const nodes = data.nodes.filter(
      n => (showAliases || !aliasOf.has(n.id)) && !hiddenLabels.has(primaryLabel(n))
    );
    const ids = new Set(nodes.map(n => n.id));
    const seen = new Set<string>();
    const relationships: KgRelationship[] = [];
    data.relationships.forEach(r => {
      if (hiddenRels.has(r.type)) return;
      if (r.type === SAME_AS && !showAliases) return;
      const from = showAliases ? r.from : aliasOf.get(r.from) ?? r.from;
      const to = showAliases ? r.to : aliasOf.get(r.to) ?? r.to;
      const key = `${from}|${r.type}|${to}`;
      if (from === to || !ids.has(from) || !ids.has(to) || seen.has(key)) return;
      seen.add(key);
      relationships.push(from === r.from && to === r.to ? r : { ...r, from, to });
    });
    const degree = new Map<string, number>();
    relationships.forEach(r => {
      degree.set(r.from, (degree.get(r.from) ?? 0) + 1);
      degree.set(r.to, (degree.get(r.to) ?? 0) + 1);
    });
    return { nodes, relationships, degree };
  }, [data, aliasOf, showAliases, hiddenLabels, hiddenRels]);

  // What is actually drawn: a focused neighbourhood, or the top-N most connected entities
  const visible = useMemo(() => {
    let keep: Set<string>;
    if (focusId && baseGraph.nodes.some(n => n.id === focusId)) {
      const adj = new Map<string, string[]>();
      baseGraph.relationships.forEach(r => {
        adj.set(r.from, [...(adj.get(r.from) ?? []), r.to]);
        adj.set(r.to, [...(adj.get(r.to) ?? []), r.from]);
      });
      keep = new Set([focusId]);
      let frontier = [focusId];
      for (let h = 0; h < focusHops; h++) {
        const next: string[] = [];
        frontier.forEach(id => (adj.get(id) ?? []).forEach(o => {
          if (!keep.has(o)) { keep.add(o); next.push(o); }
        }));
        frontier = next;
      }
    } else {
      const sorted = [...baseGraph.nodes].sort(
        (a, b) => (baseGraph.degree.get(b.id) ?? 0) - (baseGraph.degree.get(a.id) ?? 0)
      );
      keep = new Set((limit ? sorted.slice(0, limit) : sorted).map(n => n.id));
    }
    const nodes = baseGraph.nodes.filter(n => keep.has(n.id));
    const relationships = baseGraph.relationships.filter(r => keep.has(r.from) && keep.has(r.to));
    return { nodes, relationships };
  }, [baseGraph, focusId, focusHops, limit]);

  const legend = useMemo(() => {
    const m = new Map<string, { cat: Category; count: number }>();
    visible.nodes.forEach(n => {
      const cat = categoryOf(primaryLabel(n));
      m.set(cat.key, { cat, count: (m.get(cat.key)?.count ?? 0) + 1 });
    });
    return [...CATEGORIES, OTHER].filter(c => m.has(c.key)).map(c => m.get(c.key)!);
  }, [visible]);

  // ── Responsive sizing ──────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0].contentRect;
      if (r.width > 0 && r.height > 0) setSize({ width: r.width, height: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fitToView = useCallback((animate = true) => {
    const svgEl = svgRef.current, zoom = zoomRef.current, nodes = nodesRef.current;
    if (!svgEl || !zoom || nodes.length === 0) return;
    const xs = nodes.map(n => n.x ?? 0), ys = nodes.map(n => n.y ?? 0);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const { width, height } = svgEl.getBoundingClientRect();
    const k = Math.min(2.2, 0.92 / Math.max((x1 - x0 + 80) / width, (y1 - y0 + 80) / height));
    const t = d3.zoomIdentity.translate(width / 2, height / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    const sel = d3.select(svgEl);
    if (animate) sel.transition().duration(450).call(zoom.transform, t);
    else sel.call(zoom.transform, t);
  }, []);

  // ── Build the drawing whenever the visible graph changes ──────────────────
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || size.width === 0) return;
    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();
    if (visible.nodes.length === 0) { nodesRef.current = []; return; }

    const { width, height } = size;
    const degree = new Map<string, number>();
    visible.relationships.forEach(r => {
      degree.set(r.from, (degree.get(r.from) ?? 0) + 1);
      degree.set(r.to, (degree.get(r.to) ?? 0) + 1);
    });
    const byDegree = [...visible.nodes].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0));
    const rank = new Map(byDegree.map((n, i) => [n.id, i]));

    // Keep positions of nodes that stay on screen so filtering doesn't reshuffle everything
    const prev = new Map(nodesRef.current.map(n => [n.id, n]));
    const nodes: SimNode[] = visible.nodes.map(n => {
      const d = degree.get(n.id) ?? 0;
      const old = prev.get(n.id);
      return {
        id: n.id, name: n.name, label: primaryLabel(n), cat: categoryOf(primaryLabel(n)),
        degree: d, rank: rank.get(n.id) ?? 0,
        radius: Math.min(20, 4.5 + Math.sqrt(d) * 2.4),
        x: old?.x, y: old?.y,
      };
    });
    nodesRef.current = nodes;

    const pairGroups = new Map<string, KgRelationship[]>();
    visible.relationships.forEach(r => {
      const key = [r.from, r.to].sort().join("|");
      pairGroups.set(key, [...(pairGroups.get(key) ?? []), r]);
    });
    const links: SimLink[] = [];
    pairGroups.forEach(group => {
      const [a] = [group[0].from, group[0].to].sort();
      group.forEach((r, i) => {
        let curve = group.length === 1 ? 0 : (i - (group.length - 1) / 2) * 22;
        if (r.from !== a) curve = -curve;
        links.push({ id: r.id, source: r.from, target: r.to, caption: r.caption, curve });
      });
    });

    // Lay out off-screen first, then draw once: no jitter, and we can fit immediately
    const n = nodes.length;
    const sim = d3.forceSimulation<SimNode, SimLink>(nodes)
      .force("link", d3.forceLink<SimNode, SimLink>(links).id(d => d.id).distance(n > 300 ? 38 : 55).strength(0.4))
      .force("charge", d3.forceManyBody<SimNode>().strength(n > 300 ? -70 : -160).distanceMax(420))
      .force("collision", d3.forceCollide<SimNode>().radius(d => d.radius + 4))
      .force("x", d3.forceX(width / 2).strength(0.07))
      .force("y", d3.forceY(height / 2).strength(0.07))
      .stop();
    const warm = prev.size ? 120 : 300;
    for (let i = 0; i < warm; i++) sim.tick();

    const defs = svg.append("defs");
    defs.append("marker")
      .attr("id", "kg-arrow").attr("viewBox", "0 -5 10 10")
      .attr("refX", 8).attr("refY", 0).attr("markerWidth", 7).attr("markerHeight", 7)
      .attr("orient", "auto")
      .append("path").attr("d", "M0,-4L9,0L0,4").attr("fill", EDGE_ACTIVE);

    const root = svg.append("g");
    const linkLayer = root.append("g");
    const hitLayer = root.append("g");
    const nodeLayer = root.append("g");
    const textLayer = root.append("g").style("pointer-events", "none");

    const baseOpacity = n > 300 ? 0.45 : 0.7;
    const linkSel = linkLayer.selectAll<SVGPathElement, SimLink>("path")
      .data(links).join("path")
      .attr("fill", "none")
      .attr("stroke", EDGE_COLOR)
      .attr("stroke-width", 1)
      .attr("stroke-opacity", baseOpacity)
      .style("pointer-events", "none");

    // Wide invisible twins so thin edges are easy to hover (relationship name in the tooltip)
    const hitSel = hitLayer.selectAll<SVGPathElement, SimLink>("path")
      .data(links).join("path")
      .attr("fill", "none")
      .attr("stroke", "transparent")
      .attr("stroke-width", 8);

    const nodeSel = nodeLayer.selectAll<SVGCircleElement, SimNode>("circle")
      .data(nodes).join("circle")
      .attr("r", d => d.radius)
      .attr("fill", d => d.cat.color)
      .attr("stroke", "rgba(16,44,87,0.35)")
      .attr("stroke-width", 1)
      .style("cursor", "pointer");

    const textSel = textLayer.selectAll<SVGTextElement, SimNode>("text")
      .data(nodes).join("text")
      .attr("text-anchor", "middle")
      .attr("fill", "#1e293b")
      .attr("paint-order", "stroke").attr("stroke", "#fbf9f4")
      .attr("stroke-linejoin", "round")
      .style("display", "none")
      .text(d => (d.name.length > 30 ? d.name.slice(0, 29) + "…" : d.name));

    let focusNodeId: string | null = null;
    const fontPx = (d: SimNode) => (d.id === focusNodeId ? 13 : d.rank < 10 ? 12 : 11);

    function draw() {
      const k = zoomKRef.current;
      linkSel.each(function (d) {
        d3.select(this).attr("d", linkPath(d, this.getAttribute("marker-end") != null));
      });
      hitSel.attr("d", d => linkPath(d, false));
      nodeSel.attr("cx", d => d.x ?? 0).attr("cy", d => d.y ?? 0);
      // Labels keep a constant on-screen size: divide by the zoom factor
      textSel
        .attr("x", d => d.x ?? 0)
        .attr("y", d => (d.y ?? 0) + d.radius + 12 / k)
        .attr("font-size", d => fontPx(d) / k)
        .attr("stroke-width", 3.5 / k)
        .attr("font-weight", d => (d.id === focusNodeId || d.rank < 10 ? 600 : 500));
    }

    // ── Highlight: one entity + its neighbours (hover or selection) ──────────
    let active: Set<string> | null = null;
    const highlight = (id: string | null) => {
      focusNodeId = id;
      if (!id) {
        active = null;
        nodeSel.attr("opacity", 1).attr("stroke", "rgba(16,44,87,0.35)").attr("stroke-width", 1);
        linkSel.attr("stroke", EDGE_COLOR).attr("stroke-width", 1)
          .attr("stroke-opacity", baseOpacity).attr("marker-end", null);
      } else {
        active = new Set([id]);
        links.forEach(l => {
          const s = endId(l.source), t = endId(l.target);
          if (s === id) active!.add(t);
          if (t === id) active!.add(s);
        });
        const touches = (l: SimLink) => endId(l.source) === id || endId(l.target) === id;
        nodeSel
          .attr("opacity", d => (active!.has(d.id) ? 1 : 0.1))
          .attr("stroke", d => (d.id === id ? EDGE_ACTIVE : "rgba(16,44,87,0.35)"))
          .attr("stroke-width", d => (d.id === id ? 3 : 1));
        linkSel
          .attr("stroke", l => (touches(l) ? EDGE_ACTIVE : EDGE_COLOR))
          .attr("stroke-width", l => (touches(l) ? 1.4 : 1))
          .attr("stroke-opacity", l => (touches(l) ? 0.7 : 0.06))
          .attr("marker-end", l => (touches(l) ? "url(#kg-arrow)" : null));
        linkSel.filter(touches).raise();
        nodeSel.filter(d => d.id === id).raise();
      }
      draw();
      labelRef.current(zoomKRef.current);
    };

    // Labels: candidates in priority order (highlighted entity, its neighbours, then by
    // connections), placed greedily in screen space and skipped if they would overlap.
    const updateLabels = (k: number) => {
      const budget = active ? Infinity : Math.round((n > 300 ? 25 : 40) * k * k);
      const candidates = nodes
        .filter(d => (active ? active.has(d.id) : d.rank < budget))
        .sort((a, b) => (a.id === focusNodeId ? -1 : b.id === focusNodeId ? 1 : a.rank - b.rank));
      const placed: [number, number, number, number][] = [];
      const show = new Set<string>();
      for (const d of candidates) {
        const label = d.name.length > 30 ? 30 : d.name.length;
        const w = label * fontPx(d) * 0.56 + 6, h = fontPx(d) + 4;
        const cx = (d.x ?? 0) * k, top = ((d.y ?? 0) + d.radius) * k + 2;
        const box: [number, number, number, number] = [cx - w / 2, top, cx + w / 2, top + h];
        const clash = placed.some(p => box[0] < p[2] && box[2] > p[0] && box[1] < p[3] && box[3] > p[1]);
        if (clash && d.id !== focusNodeId) continue;
        placed.push(box);
        show.add(d.id);
      }
      textSel.style("display", d => (show.has(d.id) ? null : "none"));
      draw();
    };
    labelRef.current = updateLabels;

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.08, 6])
      .on("zoom", ev => {
        root.attr("transform", ev.transform.toString());
        const k = ev.transform.k;
        if (Math.abs(k - zoomKRef.current) > 0.02) { zoomKRef.current = k; updateLabels(k); }
      });
    svg.call(zoom).on("dblclick.zoom", null);
    zoomRef.current = zoom;

    // Tooltip, positioned inside the canvas so it never overflows
    const tip = tooltipRef.current;
    const showTip = (ev: MouseEvent, html: string) => {
      const box = containerRef.current?.getBoundingClientRect();
      if (!tip || !box) return;
      tip.innerHTML = html;
      tip.style.display = "block";
      let x = ev.clientX - box.left + 14, y = ev.clientY - box.top + 14;
      if (x + tip.offsetWidth > box.width - 8) x = ev.clientX - box.left - tip.offsetWidth - 14;
      if (y + tip.offsetHeight > box.height - 8) y = ev.clientY - box.top - tip.offsetHeight - 14;
      tip.style.left = `${Math.max(8, x)}px`;
      tip.style.top = `${Math.max(8, y)}px`;
    };
    const hideTip = () => { if (tip) tip.style.display = "none"; };

    let selected: string | null = null;
    nodeSel
      .on("mouseenter", (_, d) => { if (!selected) highlight(d.id); })
      .on("mousemove", (ev, d) => showTip(ev,
        `<div style="font-weight:600">${esc(d.name)}</div>` +
        `<div style="opacity:.75;display:flex;align-items:center;gap:6px;margin-top:2px">` +
        `<span style="width:8px;height:8px;border-radius:9999px;background:${d.cat.color};display:inline-block"></span>` +
        `${esc(d.label)} · ${d.degree} connection${d.degree === 1 ? "" : "s"}</div>`))
      .on("mouseleave", () => { hideTip(); if (!selected) highlight(null); })
      .on("click", (ev, d) => { ev.stopPropagation(); setSelectedId(d.id); })
      .on("dblclick", (ev, d) => { ev.stopPropagation(); setFocusId(d.id); setSelectedId(d.id); });

    hitSel
      .on("mousemove", (ev, l) => showTip(ev,
        `<div>${esc((l.source as SimNode).name)}</div>` +
        `<div style="font-weight:600;margin:1px 0">— ${esc(l.caption.replace(/_/g, " ").toLowerCase())} →</div>` +
        `<div>${esc((l.target as SimNode).name)}</div>`))
      .on("mouseleave", hideTip);

    svg.on("click", () => setSelectedId(null));
    setSelectedInDrawingRef.current = id => {
      selected = id;
      highlight(id);
    };

    nodeSel.call(
      d3.drag<SVGCircleElement, SimNode>()
        .on("start", (ev, d) => { if (!ev.active) sim.alphaTarget(0.15).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag", (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
        .on("end", (ev, d) => {
          if (!ev.active) sim.alphaTarget(0);
          d.fx = null; d.fy = null;
          updateLabels(zoomKRef.current);
        })
    );
    sim.on("tick", draw);

    draw();
    zoomKRef.current = 1;
    fitToView(false);
    updateLabels(zoomKRef.current);
    setSelectedInDrawingRef.current(selectedIdRef.current);

    return () => { sim.stop(); };
  }, [visible, size, fitToView]);

  // Keep the drawing's selection in sync without rebuilding it
  useEffect(() => {
    selectedIdRef.current = selectedId;
    setSelectedInDrawingRef.current(selectedId);
  }, [selectedId]);

  function zoomBy(factor: number) {
    if (svgRef.current && zoomRef.current)
      d3.select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, factor);
  }

  function centerOn(id: string) {
    const node = nodesRef.current.find(x => x.id === id);
    const svgEl = svgRef.current;
    if (!node || !svgEl || !zoomRef.current) return;
    const { width, height } = svgEl.getBoundingClientRect();
    d3.select(svgEl).transition().duration(450).call(
      zoomRef.current.transform,
      d3.zoomIdentity.translate(width / 2, height / 2).scale(1.8).translate(-(node.x ?? 0), -(node.y ?? 0))
    );
  }

  // Search jumps to any entity, even one outside the current top-N, by focusing it
  function goTo(id: string) {
    const target = showAliases ? id : aliasOf.get(id) ?? id;
    setSelectedId(target);
    if (nodesRef.current.some(n => n.id === target)) centerOn(target);
    else setFocusId(target);
  }

  const nodeById = useMemo(() => new Map(data.nodes.map(n => [n.id, n])), [data]);
  const selectedNode = selectedId ? nodeById.get(selectedId) ?? null : null;
  const focusNode = focusId ? nodeById.get(focusId) ?? null : null;

  // Relationships of the selected entity (all of them, not just the visible ones), grouped by type
  const selectedRels = useMemo(() => {
    if (!selectedId) return [];
    const groups = new Map<string, { other: string; outgoing: boolean }[]>();
    baseGraph.relationships.forEach(r => {
      if (r.from !== selectedId && r.to !== selectedId) return;
      const outgoing = r.from === selectedId;
      const key = `${outgoing ? "out" : "in"}|${r.caption}`;
      groups.set(key, [...(groups.get(key) ?? []), { other: outgoing ? r.to : r.from, outgoing }]);
    });
    return [...groups.entries()]
      .map(([key, items]) => ({ caption: key.split("|")[1], outgoing: key.startsWith("out"), items }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [selectedId, baseGraph]);

  const searchMatches = search.trim()
    ? data.nodes
        .filter(n => n.name.toLowerCase().includes(search.trim().toLowerCase()))
        .sort((a, b) => (baseGraph.degree.get(b.id) ?? 0) - (baseGraph.degree.get(a.id) ?? 0))
        .slice(0, 8)
    : [];

  const toggle = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    setter(next);
  };

  const totalEntities = baseGraph.nodes.length;

  return (
    <div className="flex h-full min-h-0">
      {/* ── Canvas ─────────────────────────────────────────────────────── */}
      <div ref={containerRef} className="relative flex-1 min-w-0 bg-[#fbf9f4] overflow-hidden">
        <svg ref={svgRef} width={size.width} height={size.height} className="block" />

        {visible.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-[#a09070]">
            No entities match the current filters
          </div>
        )}

        {/* Top toolbar: search + view controls */}
        <div className="absolute top-3 left-3 right-3 flex items-start gap-2 pointer-events-none">
          <div className="w-64 pointer-events-auto">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Find an entity…"
              className="w-full text-sm px-3 py-1.5 rounded-md border border-[#d1c9b8] bg-white shadow-sm
                         focus:outline-none focus:ring-1 focus:ring-[#C9A227] placeholder-[#a09070]"
            />
            {searchMatches.length > 0 && (
              <div className="mt-1 bg-white border border-[#e2d9c8] rounded-md shadow-md max-h-64 overflow-y-auto">
                {searchMatches.map(n => (
                  <button
                    key={n.id}
                    onClick={() => { goTo(n.id); setSearch(""); }}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-[#F5EDD5] flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: categoryOf(primaryLabel(n)).color }} />
                    <span className="truncate flex-1">{n.name}</span>
                    <span className="text-[10px] text-[#a09070]">{primaryLabel(n)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {focusNode ? (
            <div className="pointer-events-auto flex items-center gap-2 bg-[#102C57] text-white text-xs rounded-md pl-3 pr-1 py-1 shadow-sm">
              <span>Neighbourhood of <b className="font-semibold">{focusNode.name}</b></span>
              <select
                value={focusHops}
                onChange={e => setFocusHops(Number(e.target.value))}
                className="bg-[#1a3d72] rounded px-1 py-0.5 text-xs focus:outline-none"
              >
                <option value={1}>1 hop</option>
                <option value={2}>2 hops</option>
              </select>
              <button onClick={() => setFocusId(null)} className="px-2 py-0.5 rounded hover:bg-[#1a3d72]">
                ✕ Show all
              </button>
            </div>
          ) : (
            <div className="pointer-events-auto flex items-center gap-1 bg-white border border-[#d1c9b8] rounded-md p-0.5 shadow-sm text-xs">
              <span className="px-2 text-[#78716c]">Show</span>
              {LIMIT_OPTIONS.filter(l => l === 0 || l < totalEntities || l === limit).map(l => (
                <button
                  key={l}
                  onClick={() => setLimit(l)}
                  className={`px-2 py-1 rounded ${limit === l ? "bg-[#102C57] text-white" : "text-[#1e293b] hover:bg-[#F5EDD5]"}`}
                >
                  {l === 0 ? `All ${totalEntities}` : `Top ${l}`}
                </button>
              ))}
            </div>
          )}

          <label className="pointer-events-auto flex items-center gap-1.5 bg-white border border-[#d1c9b8] rounded-md px-2.5 py-1.5 shadow-sm text-xs cursor-pointer">
            <input type="checkbox" checked={showAliases} onChange={e => setShowAliases(e.target.checked)} className="accent-[#102C57]" />
            Show aliases
          </label>

          <div className="flex-1" />
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="pointer-events-auto text-xs px-2.5 py-1.5 rounded-md bg-[#102C57] text-white shadow-sm"
            >
              Filters
            </button>
          )}
        </div>

        {/* Legend */}
        {legend.length > 0 && (
          <div className="absolute bottom-3 left-3 bg-white/95 border border-[#e2d9c8] rounded-md shadow-sm px-3 py-2 text-[11px]">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {legend.map(({ cat, count }) => (
                <div key={cat.key} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-[#102C57]/30" style={{ background: cat.color }} />
                  <span className="text-[#1e293b]">{cat.name}</span>
                  <span className="text-[#a09070]">{count}</span>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-[#a09070]">Size = connections · Double-click to explore</p>
          </div>
        )}

        {/* Zoom controls + count */}
        <div className="absolute bottom-3 right-3 flex items-end gap-2">
          <span className="text-[11px] text-[#78716c] bg-white/90 px-2 py-1 rounded">
            {visible.nodes.length} of {totalEntities} entities · {visible.relationships.length} links
          </span>
          <div className="flex flex-col gap-1">
            {[
              { label: "+", title: "Zoom in", fn: () => zoomBy(1.4) },
              { label: "−", title: "Zoom out", fn: () => zoomBy(1 / 1.4) },
              { label: "⤢", title: "Fit to view", fn: () => fitToView() },
            ].map(b => (
              <button
                key={b.title}
                title={b.title}
                onClick={b.fn}
                className="w-8 h-8 rounded-md bg-white border border-[#d1c9b8] text-[#102C57] font-semibold shadow-sm hover:bg-[#F5EDD5]"
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div
          ref={tooltipRef}
          className="absolute z-20 hidden pointer-events-none max-w-xs text-xs px-2.5 py-1.5 rounded-md
                     bg-[#102C57] text-white shadow-lg leading-snug"
        />
      </div>

      {/* ── Right sidebar: entity details or filters ───────────────────── */}
      {sidebarOpen && (
        <aside className="w-80 flex-shrink-0 border-l border-[#d6cbb0] bg-white flex flex-col min-h-0">
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#102C57]">
            <h3 className="text-white text-sm font-semibold">{selectedNode ? "Entity" : "Filters"}</h3>
            <button onClick={() => setSidebarOpen(false)} className="text-[#94a3b8] hover:text-white text-sm" title="Hide panel">
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {selectedNode ? (
              <EntityPanel
                node={selectedNode}
                aliases={aliasesOf.get(selectedNode.id) ?? []}
                degree={baseGraph.degree.get(selectedNode.id) ?? 0}
                groups={selectedRels}
                nameOf={id => nodeById.get(id)?.name ?? id}
                colorOf={id => categoryOf(primaryLabel(nodeById.get(id) ?? selectedNode)).color}
                isFocused={focusId === selectedNode.id}
                onFocus={() => setFocusId(selectedNode.id)}
                onSelect={goTo}
                onClose={() => setSelectedId(null)}
              />
            ) : (
              <>
                <FilterGroup
                  title="Entity types"
                  items={labelCounts.map(([l, c]) => ({ key: l, count: c, color: categoryOf(l).color }))}
                  hidden={hiddenLabels}
                  onToggle={k => toggle(hiddenLabels, k, setHiddenLabels)}
                  onAll={on => setHiddenLabels(on ? new Set() : new Set(labelCounts.map(([l]) => l)))}
                />
                <FilterGroup
                  title="Relationship types"
                  items={relCounts.map(([t, c]) => ({ key: t, count: c }))}
                  hidden={hiddenRels}
                  onToggle={k => toggle(hiddenRels, k, setHiddenRels)}
                  onAll={on => setHiddenRels(on ? new Set() : new Set(relCounts.map(([t]) => t)))}
                />
              </>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

// ── Entity details ───────────────────────────────────────────────────────────

const HIDDEN_PROPS = new Set(["entity_name"]);

function EntityPanel({
  node, aliases, degree, groups, nameOf, colorOf, isFocused, onFocus, onSelect, onClose,
}: {
  node: KgNode;
  aliases: string[];
  degree: number;
  groups: { caption: string; outgoing: boolean; items: { other: string }[] }[];
  nameOf: (id: string) => string;
  colorOf: (id: string) => string;
  isFocused: boolean;
  onFocus: () => void;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const cat = categoryOf(primaryLabel(node));
  const props = Object.entries(node.properties).filter(
    ([k, v]) => !HIDDEN_PROPS.has(k) && !(k === "original_name" && v === node.name)
  );
  return (
    <div className="px-4 py-4 space-y-4">
      <div>
        <span
          className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
          style={{ background: `${cat.color}1f`, color: "#1e293b" }}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: cat.color }} />
          {node.labels.join(" · ")}
        </span>
        <h4 className="mt-2 text-lg font-semibold text-[#102C57] leading-snug break-words">{node.name}</h4>
        <p className="text-xs text-[#78716c] mt-0.5">
          {degree} connection{degree === 1 ? "" : "s"}
          {typeof node.properties.frequency === "number" && ` · seen in ${node.properties.frequency} passage(s)`}
        </p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={onFocus}
            disabled={isFocused}
            className="text-xs px-3 py-1.5 rounded-md bg-[#102C57] text-white hover:bg-[#1a3d72] disabled:opacity-50"
          >
            {isFocused ? "Exploring neighbourhood" : "Explore neighbourhood"}
          </button>
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-md border border-[#d1c9b8] text-[#1e293b] hover:bg-[#F5EDD5]">
            Back to filters
          </button>
        </div>
      </div>

      {aliases.length > 0 && (
        <section>
          <p className="text-[10px] font-bold text-[#102C57] uppercase tracking-wide mb-1.5">Also known as</p>
          <div className="flex flex-wrap gap-1">
            {aliases.map(a => (
              <span key={a} className="text-xs px-2 py-0.5 rounded-full bg-[#f5f0e6] text-[#52514e]">{a}</span>
            ))}
          </div>
        </section>
      )}

      {props.length > 0 && (
        <section>
          <p className="text-[10px] font-bold text-[#102C57] uppercase tracking-wide mb-1.5">Details</p>
          <dl className="text-xs space-y-1">
            {props.map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="text-[#78716c] w-24 flex-shrink-0 capitalize">{k.replace(/_/g, " ")}</dt>
                <dd className="text-[#1e293b] break-words min-w-0">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {groups.length > 0 && (
        <section>
          <p className="text-[10px] font-bold text-[#102C57] uppercase tracking-wide mb-1.5">Relationships</p>
          <div className="space-y-2.5">
            {groups.map(g => (
              <div key={`${g.outgoing}-${g.caption}`}>
                <p className="text-[11px] font-mono text-[#52514e] mb-1">
                  {g.outgoing ? `${g.caption.replace(/_/g, " ").toLowerCase()} →` : `← ${g.caption.replace(/_/g, " ").toLowerCase()}`}
                  <span className="text-[#a09070]"> ({g.items.length})</span>
                </p>
                <div className="flex flex-wrap gap-1">
                  {g.items.map(it => (
                    <button
                      key={it.other}
                      onClick={() => onSelect(it.other)}
                      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-[#e2d9c8] hover:bg-[#F5EDD5] max-w-full"
                    >
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: colorOf(it.other) }} />
                      <span className="truncate">{nameOf(it.other)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Filters ──────────────────────────────────────────────────────────────────

function FilterGroup({
  title, items, hidden, onToggle, onAll,
}: {
  title: string;
  items: { key: string; count: number; color?: string }[];
  hidden: Set<string>;
  onToggle: (key: string) => void;
  onAll: (on: boolean) => void;
}) {
  const LIMIT = 10;
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, LIMIT);
  return (
    <div className="px-4 py-3 border-b border-[#e2d9c8]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-[#102C57] uppercase tracking-wide">{title}</p>
        <div className="flex gap-2 text-[10px] text-[#6b5a3e]">
          <button onClick={() => onAll(true)} className="hover:underline">All</button>
          <button onClick={() => onAll(false)} className="hover:underline">None</button>
        </div>
      </div>
      <div className="space-y-0.5">
        {shown.map(it => (
          <label key={it.key} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
            <input
              type="checkbox"
              checked={!hidden.has(it.key)}
              onChange={() => onToggle(it.key)}
              className="accent-[#102C57]"
            />
            {it.color && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-[#102C57]/30" style={{ background: it.color }} />}
            <span className="flex-1 truncate text-[#1e293b]">{it.key.replace(/_/g, " ")}</span>
            <span className="text-[#a09070] tabular-nums">{it.count}</span>
          </label>
        ))}
      </div>
      {items.length > LIMIT && (
        <button onClick={() => setExpanded(v => !v)} className="mt-1.5 text-[11px] text-[#6b5a3e] hover:underline">
          {expanded ? "Show fewer" : `Show all ${items.length}`}
        </button>
      )}
    </div>
  );
}

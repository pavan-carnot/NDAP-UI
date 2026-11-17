"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import type { TimelineInterval } from "@/lib/api";

// Counts of mentioned dates per calendar bucket. One series, so one hue (the app navy),
// no legend; empty buckets between the first and last are filled so the x axis is true time.

const BAR = "#102C57";
const BAR_HOVER = "#C9A227";
const AXIS = "#d6cbb0";
const INK_MUTED = "#78716c";
const MAX_FILLED = 600; // beyond this many buckets, only non-empty ones are drawn
const MAX_BAR = 28;     // px; a handful of periods shouldn't become slabs

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function step(d: Date, interval: TimelineInterval): Date {
  const n = new Date(d);
  if (interval === "year") n.setUTCFullYear(n.getUTCFullYear() + 1);
  else if (interval === "quarter") n.setUTCMonth(n.getUTCMonth() + 3);
  else if (interval === "month") n.setUTCMonth(n.getUTCMonth() + 1);
  else if (interval === "week") n.setUTCDate(n.getUTCDate() + 7);
  else n.setUTCDate(n.getUTCDate() + 1);
  return n;
}

export function bucketLabel(iso: string, interval: TimelineInterval): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (interval === "year") return String(y);
  if (interval === "quarter") return `Q${Math.floor((m - 1) / 3) + 1} ${y}`;
  if (interval === "month") return `${MONTHS[m - 1]} ${y}`;
  const label = `${d} ${MONTHS[m - 1]} ${y}`;
  return interval === "week" ? `Week of ${label}` : label;
}

/** The last day of a bucket, for turning a clicked bar into a date range */
export function bucketEnd(iso: string, interval: TimelineInterval): string {
  const next = step(new Date(`${iso}T00:00:00Z`), interval);
  next.setUTCDate(next.getUTCDate() - 1);
  return next.toISOString().slice(0, 10);
}

/** Buckets with the empty periods between them added; unchanged (gapsHidden) if that's too many */
function fill(buckets: { date: string; count: number }[], interval: TimelineInterval) {
  if (buckets.length < 2) return { series: buckets, gapsHidden: false };
  const byDate = new Map(buckets.map(b => [b.date, b.count]));
  const out: { date: string; count: number }[] = [];
  const last = buckets[buckets.length - 1].date;
  for (let d = new Date(`${buckets[0].date}T00:00:00Z`); ; d = step(d, interval)) {
    const iso = d.toISOString().slice(0, 10);
    if (iso > last) break;
    out.push({ date: iso, count: byDate.get(iso) ?? 0 });
    if (out.length > MAX_FILLED) return { series: buckets, gapsHidden: true };
  }
  return { series: out, gapsHidden: false };
}

export default function TimelineBars({
  buckets, interval, height = 180, compact = false, selected, onSelect,
}: {
  buckets: { date: string; count: number }[];
  interval: TimelineInterval;
  height?: number;
  compact?: boolean;
  selected?: string | null;
  onSelect?: (date: string) => void;
}) {
  const [hover, setHover] = useState<{ i: number; x: number } | null>(null);
  const [W, setW] = useState(600);   // drawn in real pixels so bars and corners keep their shape

  // Callback ref: the chart's wrapper mounts only once there is data
  const observer = useRef<ResizeObserver | null>(null);
  const wrapRef = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (el) {
      observer.current = new ResizeObserver(([e]) => setW(Math.max(e.contentRect.width, 100)));
      observer.current.observe(el);
    }
  }, []);
  const { series, gapsHidden } = useMemo(() => fill(buckets, interval), [buckets, interval]);

  if (series.length === 0) {
    return <p className="text-xs text-[#a09070] py-4">No dated mentions</p>;
  }

  const max = Math.max(...series.map(b => b.count));
  const top = compact ? 4 : 18, bottom = compact ? 16 : 22;
  const plotH = height - top - bottom;
  const slot = W / series.length;
  const gap = Math.min(2, slot * 0.3);  // 2px surface gap between adjacent bars
  const barW = Math.min(Math.max(slot - gap, 1), MAX_BAR);
  const r = Math.min(4, barW / 2);
  const tickEvery = Math.max(1, Math.ceil(series.length / (compact ? 3 : 7)));

  return (
    <div ref={wrapRef} className="relative w-full" onMouseLeave={() => setHover(null)}>
      <svg width={W} height={height} className="block"
           role="img" aria-label={`Dated mentions per ${interval}`}>
        {!compact && (
          <text x={0} y={11} fontSize={11} fill={INK_MUTED} style={{ fontVariantNumeric: "tabular-nums" }}>
            {max} max
          </text>
        )}
        <line x1={0} x2={W} y1={top + plotH + 0.5} y2={top + plotH + 0.5} stroke={AXIS} strokeWidth={1} />
        {series.map((b, i) => {
          if (!b.count) return null;
          const h = Math.max((b.count / max) * plotH, 2);
          const x = i * slot + (slot - barW) / 2, y = top + plotH - h;
          const active = hover?.i === i || selected === b.date;
          // Rounded data-end, square on the baseline
          const d = `M${x},${top + plotH} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${top + plotH} Z`;
          return <path key={b.date} d={d} fill={active ? BAR_HOVER : BAR} />;
        })}
        {/* Hit targets: the full column, wider than the bar */}
        {series.map((b, i) => (
          <rect
            key={`hit-${b.date}`} x={i * slot} y={0} width={slot} height={height} fill="transparent"
            style={{ cursor: onSelect && b.count ? "pointer" : "default" }}
            onMouseEnter={() => setHover({ i, x: (i + 0.5) / series.length })}
            onClick={() => b.count && onSelect?.(b.date)}
          />
        ))}
      </svg>
      <div className="relative h-4 text-[10px] text-[#78716c] select-none" style={{ marginTop: -bottom + 4 }}>
        {series.map((b, i) => (i % tickEvery === 0 || i === series.length - 1) && (
          <span key={b.date} className="absolute -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${((i + 0.5) / series.length) * 100}%`,
                         display: i !== series.length - 1 && series.length - 1 - i < tickEvery / 2 ? "none" : undefined }}>
            {bucketLabel(b.date, interval).replace("Week of ", "")}
          </span>
        ))}
      </div>
      {hover && (
        <div className="absolute z-10 pointer-events-none -translate-x-1/2 -translate-y-full text-xs px-2 py-1 rounded-md bg-[#102C57] text-white shadow whitespace-nowrap"
             style={{ left: `${hover.x * 100}%`, top: top }}>
          <span className="font-semibold">{bucketLabel(series[hover.i].date, interval)}</span>
          {" · "}{series[hover.i].count} mention{series[hover.i].count === 1 ? "" : "s"}
        </div>
      )}
      {gapsHidden && !compact && (
        <p className="text-[10px] text-[#a09070] mt-1">Too long a span to show empty periods; only periods with mentions are drawn.</p>
      )}
    </div>
  );
}


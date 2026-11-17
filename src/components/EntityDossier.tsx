"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { getEntityDossier, EntityDossier as Dossier } from "@/lib/api";
import TimelineBars from "@/components/TimelineBars";

const DOCS_BASE = (process.env.NEXT_PUBLIC_DOCS_BASE_URL ?? "/api/docs").replace(/\/$/, "");

function Heading({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold text-[#102C57] uppercase tracking-wide mb-1.5">{children}</p>;
}

function docHref(filename: string, pages: string[]): string {
  const page = pages.find(p => /^\d+$/.test(p));
  return `${DOCS_BASE}/${encodeURIComponent(filename)}${page && filename.toLowerCase().endsWith(".pdf") ? `#page=${page}` : ""}`;
}

/** Everything the corpus-wide entity index knows about one entity, across all documents. */
export default function EntityDossier({
  entityKey, onCenter, centered,
}: {
  entityKey: string;
  onCenter: (key: string) => void;
  centered: boolean;
}) {
  const [data, setData] = useState<Dossier | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setData(null);
    setError(null);
    getEntityDossier(entityKey)
      .then(d => { if (live) setData(d); })
      .catch(e => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, [entityKey]);

  if (error) return <p className="text-xs text-[#b91c1c]">Couldn&apos;t load the dossier: {error}</p>;
  if (!data) return <p className="text-xs text-[#a09070]">Loading dossier…</p>;

  return (
    <div className="space-y-4 border-t border-[#e2d9c8] pt-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[#52514e]">
          In <span className="font-semibold tabular-nums">{data.doc_count}</span> document{data.doc_count === 1 ? "" : "s"},{" "}
          <span className="font-semibold tabular-nums">{data.mention_count}</span> mention{data.mention_count === 1 ? "" : "s"}
        </p>
        {!centered && (
          <button onClick={() => onCenter(data.key)}
                  className="text-xs px-2.5 py-1 rounded-md border border-[#d1c9b8] hover:bg-[#F5EDD5] whitespace-nowrap">
            Center graph here
          </button>
        )}
      </div>

      <section>
        <Heading>Documents</Heading>
        <ul className="space-y-1">
          {data.documents.map(d => (
            <li key={d.filename} className="text-xs">
              <a href={docHref(d.filename, d.pages)} target="_blank" rel="noreferrer"
                 className="text-[#102C57] hover:underline break-all">{d.filename}</a>
              <span className="text-[#a09070]">
                {d.doc_type ? ` · ${d.doc_type}` : ""} · {d.mentions}× · p. {d.pages.slice(0, 6).join(", ")}{d.pages.length > 6 ? "…" : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {data.related.length > 0 && (
        <section>
          <Heading>Stated relationships</Heading>
          <ul className="space-y-2">
            {data.related.map((r, i) => (
              <li key={i} className="text-xs">
                <p>
                  <span className="font-mono text-[11px] text-[#52514e]">
                    {r.outgoing ? `${r.type.replace(/_/g, " ").toLowerCase()} →` : `← ${r.type.replace(/_/g, " ").toLowerCase()}`}
                  </span>{" "}
                  <button onClick={() => onCenter(r.key)} className="font-medium text-[#102C57] hover:underline">{r.name}</button>
                  <span className="text-[#a09070]"> · {r.entity_type}</span>
                </p>
                {r.evidence && <p className="text-[#78716c] italic mt-0.5 leading-snug">“{r.evidence}”</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.co_occurring.length > 0 && (
        <section>
          <Heading>Often mentioned with</Heading>
          <div className="flex flex-wrap gap-1">
            {data.co_occurring.map(c => (
              <button key={c.key} onClick={() => onCenter(c.key)}
                      title={`${c.type} · together in ${c.passages} passage(s) across ${c.docs} document(s)`}
                      className="text-xs px-2 py-0.5 rounded-full border border-[#e2d9c8] hover:bg-[#F5EDD5]">
                {c.name} <span className="text-[#a09070] tabular-nums">{c.passages}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between">
          <Heading>Dates mentioned alongside</Heading>
          {data.timeline.length > 0 && (
            <Link href={`/timeline?entity=${encodeURIComponent(data.key)}&name=${encodeURIComponent(data.name)}`}
                  className="text-[11px] text-[#6b5a3e] hover:underline mb-1.5">Open in timeline</Link>
          )}
        </div>
        <TimelineBars buckets={data.timeline} interval="month" height={70} compact />
      </section>
    </div>
  );
}

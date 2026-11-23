"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { CustodyRecord, getCustody } from "@/lib/api";
import { Button, Modal } from "./Modal";

const EVENT_LABEL: Record<string, string> = {
  received: "Received",
  duplicate_linked: "Same content uploaded again; linked",
  ingested: "Indexed",
  ingest_failed: "Indexing failed",
  baseline: "First fingerprint taken",
  mismatch: "File changed: fingerprint doesn't match",
  missing: "Original file missing",
  restored: "Original matches its fingerprint again",
  replaced: "Replaced by a new version",
  deleted: "Deleted",
};

const VIA_LABEL: Record<string, string> = {
  container_upload: "Upload into a knowledge container",
  admin_upload: "Admin upload",
  batch_ingest: "Batch ingestion from the datasets folder",
  replace: "Replacement upload",
};

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "–");
const size = (n: number | null) =>
  n == null ? "–" : n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

function eventSummary(event: string, d: Record<string, unknown>): string {
  const parts: string[] = [];
  if (event === "received") {
    if (d.via) parts.push(VIA_LABEL[String(d.via)] ?? String(d.via));
    if (d.original_name) parts.push(`as “${d.original_name}”`);
  }
  if (event === "ingested") {
    if (d.chunks != null) parts.push(`${d.chunks} passages`);
    if (d.entities != null) parts.push(`${d.entities} entities`);
    if (d.relationships != null) parts.push(`${d.relationships} relationships`);
    if (d.doc_type) parts.push(String(d.doc_type));
  }
  if (event === "duplicate_linked" && d.uploaded_as) parts.push(`uploaded as “${d.uploaded_as}”`);
  if (event === "ingest_failed" && d.error) parts.push(String(d.error));
  if (event === "mismatch" && d.stage) parts.push(d.stage === "ingest" ? "between receipt and indexing" : "at a scheduled check");
  if (event === "deleted" && d.reason) parts.push(String(d.reason));
  return parts.join(" · ");
}

function Fingerprint({ sha }: { sha: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex items-center gap-1 min-w-0">
      <code className="font-mono text-[11px] break-all">{sha}</code>
      <button
        onClick={() => navigator.clipboard?.writeText(sha).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
        className="p-0.5 rounded text-gray-400 hover:text-ndap-navy flex-shrink-0" aria-label="Copy fingerprint" title="Copy">
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      </button>
    </span>
  );
}

export default function CustodyModal({ filename, containerId, onClose }: {
  filename: string;
  containerId: string;
  onClose: () => void;
}) {
  const [rec, setRec] = useState<CustodyRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCustody(filename, containerId).then(setRec).catch(e => setError(e instanceof Error ? e.message : String(e)));
  }, [filename, containerId]);

  const integrity = rec?.integrity_status;
  return (
    <Modal title="Source record" onClose={onClose} width="max-w-xl" footer={<Button onClick={onClose}>Close</Button>}>
      <p className="text-sm font-semibold text-gray-900 break-all mb-3">{filename}</p>
      {error ? <p role="alert" className="text-xs text-red-600">{error}</p> : !rec ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : (
        <>
          {integrity && integrity !== "ok" && (
            <p role="alert" className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              {integrity === "mismatch"
                ? "The stored original no longer matches the fingerprint taken when it was received. Answers from it may not reflect the original."
                : "The stored original is missing."}
            </p>
          )}
          <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1.5 text-xs">
            <dt className="text-gray-500">SHA-256</dt>
            <dd>{rec.sha256 ? <Fingerprint sha={rec.sha256} /> : <span className="text-gray-400">Not fingerprinted yet</span>}</dd>
            <dt className="text-gray-500">Size</dt><dd>{size(rec.file_size)}</dd>
            <dt className="text-gray-500">Received</dt><dd>{fmt(rec.received_at)}</dd>
            <dt className="text-gray-500">Received from</dt><dd>{rec.received_by ?? "–"}</dd>
            <dt className="text-gray-500">How</dt><dd>{rec.received_via ? VIA_LABEL[rec.received_via] ?? rec.received_via : "–"}</dd>
            <dt className="text-gray-500">Last verified</dt>
            <dd>
              {fmt(rec.integrity_checked_at)}
              {integrity === "ok" && <span className="ml-1.5 text-emerald-700 font-semibold">matches</span>}
            </dd>
            {rec.approval_status && (<>
              <dt className="text-gray-500">Review</dt>
              <dd>{rec.approval_status === "approved" ? "Approved" : "Not approved"}{rec.approved_by ? ` by ${rec.approved_by}` : ""}</dd>
            </>)}
          </dl>

          <h3 className="mt-4 mb-1.5 text-xs font-semibold text-gray-700">Chain of custody</h3>
          <ol className="relative border-l border-gray-200 ml-1.5 space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {rec.events.map(e => {
              const alarm = e.event === "mismatch" || e.event === "missing" || e.event === "ingest_failed";
              const summary = eventSummary(e.event, e.detail);
              return (
                <li key={e.id} className="ml-3">
                  <span className={`absolute -left-[5px] mt-1 w-2.5 h-2.5 rounded-full ${alarm ? "bg-red-500" : "bg-ndap-navy/60"}`} />
                  <p className={`text-xs font-semibold ${alarm ? "text-red-700" : "text-gray-800"}`}>{EVENT_LABEL[e.event] ?? e.event}</p>
                  <p className="text-[11px] text-gray-500">
                    {fmt(e.created_at)}{e.actor ? ` · ${e.actor}` : ""}{summary ? ` · ${summary}` : ""}
                  </p>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </Modal>
  );
}

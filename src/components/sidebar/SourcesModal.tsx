"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Library, Search, Upload, X } from "lucide-react";
import clsx from "clsx";
import { addSources, createContainer, getDocuments, KnowledgeContainer, SourceUploadResult } from "@/lib/api";
import type { Document } from "@/lib/types";
import { Button, Modal } from "./Modal";
import FileIcon from "./FileIcon";

const ACCEPT = [".pdf", ".docx", ".xlsx", ".xls", ".pptx", ".ppt"];
const MAX_FILE_MB = 50;

function formatSize(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Create a container (container === undefined) or add sources to an existing one
export default function SourcesModal({
  container,
  onClose,
  onDone,
}: {
  container?: KnowledgeContainer;
  onClose: () => void;
  onDone: (container: KnowledgeContainer) => void;
}) {
  const creating = !container;
  const [tab, setTab] = useState<"upload" | "library">("upload");
  const [name, setName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [library, setLibrary] = useState<Document[] | null>(null);
  // Every indexed filename, to spot uploads that would collide with an existing copy
  const [indexed, setIndexed] = useState<Map<string, string>>(new Map());
  const [replace, setReplace] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [useVision, setUseVision] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<SourceUploadResult["details"] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getDocuments()
      .then(docs => {
        setIndexed(new Map(docs.map(d => [d.filename, d.status])));
        setLibrary(docs.filter(d => d.status === "active" && !container?.file_names.includes(d.filename)));
      })
      .catch(() => setLibrary([]));
  }, [container]);

  const filteredLibrary = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (library ?? []).filter(d => !q || d.filename.toLowerCase().includes(q));
  }, [library, query]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list);
    const bad = incoming.filter(f => !ACCEPT.some(ext => f.name.toLowerCase().endsWith(ext)) || f.size > MAX_FILE_MB * 1024 * 1024);
    setError(bad.length ? `Skipped ${bad.map(f => f.name).join(", ")}: only ${ACCEPT.join(" ")} up to ${MAX_FILE_MB} MB` : null);
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...incoming.filter(f => !bad.includes(f) && !names.has(f.name))];
    });
  }

  function togglePick(fn: string) {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(fn)) next.delete(fn); else next.add(fn);
      return next;
    });
  }

  const total = files.length + picked.size;
  const duplicates = files.filter(f => indexed.get(f.name) === "active");
  const stillIndexing = files.filter(f => indexed.get(f.name) === "processing");

  async function submit() {
    if (!total || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = creating
        ? await createContainer(name, files, [...picked], useVision, replace)
        : await addSources(container.session_id, files, [...picked], useVision, replace);
      const bad = res.details.filter(d => d.status === "rejected" || d.status === "not_found");
      onDone(res.container);
      if (bad.length) { setProblems(bad); setBusy(false); } else onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  if (problems) {
    return (
      <Modal title="Some files were not added" onClose={onClose} footer={<Button variant="primary" onClick={onClose}>OK</Button>}>
        <ul className="space-y-1.5 text-xs">
          {problems.map(p => (
            <li key={p.filename}><b>{p.filename}</b>: {p.error ?? "not found in the library"}</li>
          ))}
        </ul>
      </Modal>
    );
  }

  return (
    <Modal
      title={creating ? "New knowledge container" : `Add files to ${container.name}`}
      onClose={onClose}
      width="max-w-xl"
      footer={<>
        <span className="mr-auto self-center text-[11px] text-gray-500">
          {total ? `${total} selected` : "Nothing selected yet"}
        </span>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={submit} disabled={!total || busy}>
          {busy ? "Uploading…" : creating ? "Create container" : "Add to container"}
        </Button>
      </>}
    >
      {creating && (
        <label className="block mb-4">
          <span className="block text-[11px] font-semibold text-gray-600 mb-1">Name</span>
          <input
            value={name}
            maxLength={100}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Northern Command logistics (optional)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ndap-navy"
          />
        </label>
      )}

      <div className="flex border-b border-gray-200 mb-3 text-xs font-semibold">
        {([["upload", Upload, "Upload files", files.length], ["library", Library, "From document library", picked.size]] as const).map(
          ([key, Icon, label, count]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-2 -mb-px border-b-2 transition-colors",
                tab === key ? "border-ndap-navy text-ndap-navy" : "border-transparent text-gray-500 hover:text-gray-800"
              )}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
              {count > 0 && <span className="ml-0.5 rounded-full bg-ndap-navy text-white px-1.5 text-[10px]">{count}</span>}
            </button>
          )
        )}
      </div>

      {tab === "upload" ? (
        <div>
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
            className={clsx(
              "border-2 border-dashed rounded-xl px-4 py-7 text-center cursor-pointer transition-colors",
              dragOver ? "border-ndap-navy bg-ndap-sky" : "border-gray-300 hover:border-ndap-navy/60 hover:bg-gray-50"
            )}
          >
            <Upload className="w-6 h-6 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-700 font-medium">Drop files here or click to browse</p>
            <p className="text-[11px] text-gray-400 mt-1">PDF, Word, Excel, PowerPoint · up to {MAX_FILE_MB} MB each</p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPT.join(",")}
              className="hidden"
              onChange={e => { addFiles(e.target.files); e.target.value = ""; }}
            />
          </div>
          {files.length > 0 && (
            <ul className="mt-3 space-y-1 max-h-40 overflow-y-auto">
              {files.map(f => (
                <li key={f.name} className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-2.5 py-1.5">
                  <FileIcon filename={f.name} />
                  <span className="flex-1 truncate" title={f.name}>{f.name}</span>
                  {indexed.get(f.name) === "active" && (
                    <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-px text-[10px] font-semibold">Already indexed</span>
                  )}
                  {indexed.get(f.name) === "processing" && (
                    <span className="rounded-full bg-gray-200 text-gray-600 px-2 py-px text-[10px] font-semibold">Being indexed</span>
                  )}
                  <span className="text-gray-400">{formatSize(f.size)}</span>
                  <button onClick={() => setFiles(prev => prev.filter(x => x !== f))} className="text-gray-400 hover:text-red-600" aria-label={`Remove ${f.name}`}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {duplicates.length > 0 && (
            <fieldset className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <legend className="sr-only">Files that are already indexed</legend>
              <p className="text-[11px] font-semibold text-amber-900 mb-1.5">
                {duplicates.length === 1
                  ? `“${duplicates[0].name}” is already indexed.`
                  : `${duplicates.length} of these files are already indexed.`}
              </p>
              <label className="flex items-start gap-2 text-[11px] text-gray-700 cursor-pointer">
                <input type="radio" name="dup" checked={!replace} onChange={() => setReplace(false)} className="mt-0.5 accent-[#8B1060]" />
                <span><b>Use the existing indexed copy</b> (no re-indexing)</span>
              </label>
              <label className="flex items-start gap-2 text-[11px] text-gray-700 cursor-pointer mt-1">
                <input type="radio" name="dup" checked={replace} onChange={() => setReplace(true)} className="mt-0.5 accent-[#8B1060]" />
                <span>
                  <b>Replace it with my upload</b>. It is re-indexed, which takes a few minutes, and the new version is used by
                  every container that has this file. Rebuild their knowledge graphs afterwards.
                </span>
              </label>
            </fieldset>
          )}
          {stillIndexing.length > 0 && (
            <p className="mt-2 text-[11px] text-gray-500">
              {stillIndexing.map(f => f.name).join(", ")}: a file with this name is still being indexed, so it will be skipped. Try again in a few minutes.
            </p>
          )}
          <label className="flex items-start gap-2 mt-3 cursor-pointer">
            <input type="checkbox" checked={useVision} onChange={e => setUseVision(e.target.checked)} className="mt-0.5 accent-[#8B1060]" />
            <span className="text-[11px] text-gray-600 leading-snug">
              <b className="text-gray-800">Read charts and images</b> with the vision model. Slower; use it for scanned or chart-heavy files.
            </span>
          </label>
          <p className="text-[11px] text-gray-400 mt-2">
            Files are stored and indexed on this server. Large files can take a few minutes before they can be searched.
          </p>
        </div>
      ) : (
        <div>
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search already-indexed documents"
              className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-ndap-navy"
            />
          </div>
          <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-100">
            {library === null ? (
              <p className="text-xs text-gray-400 p-3">Loading library…</p>
            ) : filteredLibrary.length === 0 ? (
              <p className="text-xs text-gray-400 p-3">
                {library.length === 0 ? "No other indexed documents in the library." : "No documents match."}
              </p>
            ) : filteredLibrary.map(d => (
              <label key={d.filename} className="flex items-center gap-2 px-2.5 py-2 text-xs cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={picked.has(d.filename)} onChange={() => togglePick(d.filename)} className="accent-[#8B1060]" />
                <FileIcon filename={d.filename} />
                <span className="flex-1 truncate" title={d.filename}>{d.filename}</span>
                {d.total_chunks != null && <span className="text-gray-400">{d.total_chunks} chunks</span>}
              </label>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-2">
            Library documents are shared: removing one from this container never deletes it from the library.
          </p>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </Modal>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, UserRound, X } from "lucide-react";
import {
  KnowledgeContainer, listShares, listUsers, shareContainer, ShareEntry, unshareContainer, UserAccount,
} from "@/lib/api";
import { Button, Modal } from "./Modal";

type Access = "viewer" | "editor";

const ACCESS_HELP: Record<Access, string> = {
  viewer: "Read files and the graph, ask questions in their own private chats.",
  editor: "Viewer rights, plus add or remove files and rebuild the graph.",
};

// Admins only: the backend rejects everyone else
export default function ShareModal({
  container, onClose, onChanged,
}: {
  container: KnowledgeContainer;
  onClose: () => void;
  onChanged: () => Promise<unknown> | void;
}) {
  const [users, setUsers] = useState<UserAccount[] | null>(null);
  const [shares, setShares] = useState<ShareEntry[] | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [access, setAccess] = useState<Access>("viewer");
  const [busy, setBusy] = useState<string | null>(null);   // "add", or the username being changed
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listUsers(), listShares(container.session_id)])
      .then(([u, s]) => { setUsers(u); setShares(s); })
      .catch(err => setError(err instanceof Error ? err.message : String(err)));
  }, [container.session_id]);

  const shared = useMemo(() => new Set((shares ?? []).map(s => s.username)), [shares]);
  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (users ?? []).filter(u =>
      u.is_active && u.username !== container.owner && !shared.has(u.username) &&
      (!q || u.username.includes(q) || u.display_name.toLowerCase().includes(q)));
  }, [users, search, shared, container.owner]);

  async function run(key: string, action: () => Promise<ShareEntry[]>) {
    setBusy(key);
    setError(null);
    try {
      setShares(await action());
      await onChanged();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function add(e?: React.FormEvent) {
    e?.preventDefault();
    if (!selected || busy) return;
    if (await run("add", () => shareContainer(container.session_id, selected, access))) {
      setSelected(null);
      setSearch("");
    }
  }

  return (
    <Modal title={`Share “${container.name}”`} onClose={onClose} footer={<Button onClick={onClose}>Done</Button>}>
      <p className="mb-3 text-[11px] text-gray-500">
        Owner: <b className="text-gray-700">{container.owner}</b>. People you add have their own private chats and notes here.
      </p>

      <form onSubmit={add} className="space-y-2">
        <label htmlFor="share-search" className="block text-xs font-semibold text-gray-700">Add a person</label>
        <input
          id="share-search"
          value={search}
          autoComplete="off"
          spellCheck={false}
          placeholder="Search users by name or username"
          onChange={e => { setSearch(e.target.value); setSelected(null); }}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ndap-navy"
        />
        {users === null ? (
          <p className="text-xs text-gray-400">Loading users…</p>
        ) : (
          <ul className="max-h-36 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100" role="listbox" aria-label="Users">
            {candidates.length === 0 ? (
              <li className="px-3 py-2 text-xs text-gray-400">No matching active users without access.</li>
            ) : candidates.slice(0, 50).map(u => (
              <li key={u.username}>
                <button type="button" role="option" aria-selected={selected === u.username}
                  onClick={() => setSelected(u.username)}
                  className={`w-full text-left px-3 py-1.5 text-xs ${selected === u.username ? "bg-ndap-sky text-ndap-navy font-semibold" : "hover:bg-gray-50 text-gray-800"}`}>
                  {u.display_name ? <>{u.display_name} <span className="text-gray-400">{u.username}</span></> : u.username}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2">
          <select value={access} onChange={e => setAccess(e.target.value as Access)} aria-label="Access level"
            className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-ndap-navy">
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <span className="flex-1 text-[11px] text-gray-500 leading-snug">{ACCESS_HELP[access]}</span>
          <Button variant="primary" type="submit" disabled={!selected || !!busy}>
            {busy === "add" ? "Sharing…" : "Share"}
          </Button>
        </div>
      </form>
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}

      <h3 className="mt-4 mb-1.5 text-xs font-semibold text-gray-700">People with access</h3>
      {shares === null ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : shares.length === 0 ? (
        <p className="text-xs text-gray-400">Not shared with anyone yet.</p>
      ) : (
        <ul className="space-y-1 max-h-48 overflow-y-auto">
          {shares.map(s => (
            <li key={s.username} className="flex items-center gap-2 rounded-lg bg-gray-50 pl-2.5 pr-1 py-1">
              <UserRound className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
              <span className="flex-1 truncate text-xs text-gray-800" title={`Shared by ${s.granted_by}`}>
                {s.display_name || s.username}
                {s.is_active === false && <span className="ml-1 text-[10px] text-gray-400">(deactivated)</span>}
              </span>
              <select
                value={s.access}
                disabled={!!busy}
                aria-label={`Access for ${s.username}`}
                onChange={e => run(s.username, () => shareContainer(container.session_id, s.username, e.target.value as Access))}
                className="border border-gray-200 rounded px-1 py-0.5 text-[11px] bg-white"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
              <button
                onClick={() => run(s.username, () => unshareContainer(container.session_id, s.username))}
                disabled={!!busy}
                className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-white disabled:opacity-50"
                aria-label={`Remove access for ${s.username}`}
                title="Remove access (their chats are kept and return if you share again)"
              >
                {busy === s.username ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

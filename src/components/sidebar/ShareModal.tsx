"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, UserRound, X } from "lucide-react";
import { KnowledgeContainer, shareContainer, unshareContainer } from "@/lib/api";
import { Button, Modal } from "./Modal";

export default function ShareModal({
  container, onClose, onChanged,
}: {
  container: KnowledgeContainer;
  onClose: () => void;
  onChanged: () => Promise<unknown> | void;
}) {
  const [username, setUsername] = useState("");
  const [people, setPeople] = useState(container.shared_with);
  const [busy, setBusy] = useState<string | null>(null);   // "add", or the username being removed
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function run(key: string, action: () => Promise<string[]>) {
    setBusy(key);
    setError(null);
    setAdded(null);
    try {
      setPeople(await action());
      await onChanged();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const name = username.trim();
    if (!name || busy) return;
    if (await run("add", () => shareContainer(container.session_id, name))) {
      setAdded(name.toLowerCase());
      setUsername("");
      inputRef.current?.focus();
    }
  }

  return (
    <Modal
      title={`Share “${container.name}”`}
      onClose={onClose}
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <form onSubmit={submit}>
        <label htmlFor="share-username" className="block text-xs font-semibold text-gray-700 mb-1.5">
          Email or username the person logs in with
        </label>
        <div className="flex gap-2">
          <input
            id="share-username"
            ref={inputRef}
            value={username}
            maxLength={255}
            autoComplete="off"
            spellCheck={false}
            placeholder="name@example.com"
            onChange={e => setUsername(e.target.value)}
            className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ndap-navy"
          />
          <Button variant="primary" type="submit" disabled={!username.trim() || !!busy}>
            {busy === "add" ? "Sharing…" : "Share"}
          </Button>
        </div>
      </form>
      <p className="mt-2 text-[11px] text-gray-500 leading-snug">
        They can read its files and graph and ask questions in their own private chats. They can&apos;t change the container.
        Check the spelling: logins aren&apos;t verified, so a typo shares with nobody.
      </p>
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
      {added && !error && <p role="status" className="mt-2 text-xs text-emerald-700">Shared with {added}.</p>}

      <h3 className="mt-4 mb-1.5 text-xs font-semibold text-gray-700">People with access</h3>
      {people.length === 0 ? (
        <p className="text-xs text-gray-400">Not shared with anyone yet.</p>
      ) : (
        <ul className="space-y-1 max-h-48 overflow-y-auto">
          {people.map(person => (
            <li key={person} className="flex items-center gap-2 rounded-lg bg-gray-50 pl-2.5 pr-1 py-1">
              <UserRound className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
              <span className="flex-1 truncate text-xs text-gray-800" title={person}>{person}</span>
              <button
                onClick={() => run(person, () => unshareContainer(container.session_id, person))}
                disabled={!!busy}
                className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-white disabled:opacity-50"
                aria-label={`Remove access for ${person}`}
                title="Remove access"
              >
                {busy === person ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

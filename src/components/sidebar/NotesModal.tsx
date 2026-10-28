"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bookmark } from "lucide-react";
import { listNotes, SavedNote } from "@/lib/api";
import { Button, Modal } from "./Modal";

export default function NotesModal({
  containerId,
  containerName,
  onClose,
  onOpenChat,
}: {
  containerId: string;
  containerName: string;
  onClose: () => void;
  onOpenChat: (chatId: string) => void;
}) {
  const [notes, setNotes] = useState<SavedNote[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listNotes(containerId).then(setNotes).catch(e => setError(e instanceof Error ? e.message : String(e)));
  }, [containerId]);

  return (
    <Modal title={`Saved notes · ${containerName}`} onClose={onClose} width="max-w-2xl">
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : notes === null ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : notes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Bookmark className="w-6 h-6 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No saved notes yet</p>
          <p className="text-xs text-gray-400 mt-1">Use the bookmark on any answer to keep it here.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {notes.map(n => (
            <li key={n.message_id} className="border border-ndap-border rounded-xl p-3.5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-sm font-semibold text-gray-900">{n.query}</p>
                <Button onClick={() => { onOpenChat(n.chat_id); onClose(); }}>Open chat</Button>
              </div>
              <div className="ndap-prose text-xs text-gray-700 max-h-48 overflow-y-auto">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{n.answer}</ReactMarkdown>
              </div>
              <p className="text-[10px] text-gray-400 mt-2">
                {n.chat_name} · {new Date(n.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

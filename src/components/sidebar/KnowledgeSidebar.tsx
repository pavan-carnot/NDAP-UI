"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  AlertCircle, Bookmark, ChevronRight, Eraser, Eye, FilePlus2, Folder, FolderOpen, Library,
  Loader2, MessageSquare, Network, Pencil, Pin, PinOff, Plus, Trash2,
} from "lucide-react";
import {
  ChatSummary, deleteChat, deleteContainer, GENERAL_WORKSPACE, KnowledgeContainer, listChats,
  removeContainerSource, renameChat, renameContainer, togglePinContainer,
} from "@/lib/api";
import ActionMenu from "./ActionMenu";
import FileIcon from "./FileIcon";
import { ConfirmModal, RenameModal } from "./Modal";
import NotesModal from "./NotesModal";
import SourcesModal from "./SourcesModal";

type Tab = "files" | "chats";

type Dialog =
  | { kind: "create" }
  | { kind: "add"; container: KnowledgeContainer }
  | { kind: "renameContainer"; container: KnowledgeContainer }
  | { kind: "deleteContainer"; container: KnowledgeContainer }
  | { kind: "removeFile"; container: KnowledgeContainer; filename: string; origin: string }
  | { kind: "renameChat"; containerId: string; chat: ChatSummary }
  | { kind: "deleteChat"; containerId: string; chat: ChatSummary; clearOnly: boolean }
  | { kind: "notes"; containerId: string; name: string };

export interface KnowledgeSidebarProps {
  containers: KnowledgeContainer[];
  loaded: boolean;
  loadError: string | null;
  reloadContainers: () => Promise<unknown>;
  activeContainerId: string;
  activeChatId: string | null;
  chatsVersion: number;   // bumped by the chat page after each answer
  onSelectContainer: (containerId: string) => void;
  onSelectChat: (containerId: string, chatId: string) => void;
  onNewChat: (containerId: string) => void;
  onChatRemoved: (containerId: string, chatId: string, clearedOnly: boolean) => void;
  onContainerDeleted: (containerId: string) => void;
  onOpenFile: (containerId: string, filename: string) => void;
  footer?: React.ReactNode;
}

const isIndexing = (status: string) => status === "processing" || status === "missing";

export default function KnowledgeSidebar(props: KnowledgeSidebarProps) {
  const {
    containers, loaded, loadError, reloadContainers, activeContainerId, activeChatId, chatsVersion,
    onSelectContainer, onSelectChat, onNewChat, onChatRemoved, onContainerDeleted, onOpenFile, footer,
  } = props;
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set([activeContainerId]));
  const [tabs, setTabs] = useState<Record<string, Tab>>({});
  const [chats, setChats] = useState<Record<string, ChatSummary[] | undefined>>({});
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const loadChats = useCallback(async (containerId: string) => {
    try {
      const list = await listChats(containerId);
      setChats(prev => ({ ...prev, [containerId]: list }));
    } catch {
      setChats(prev => ({ ...prev, [containerId]: [] }));
    }
  }, []);

  // The active container is always open, and its chat list follows new answers
  useEffect(() => {
    setExpanded(prev => (prev.has(activeContainerId) ? prev : new Set(prev).add(activeContainerId)));
  }, [activeContainerId]);

  useEffect(() => { loadChats(activeContainerId); }, [activeContainerId, chatsVersion, loadChats]);

  const tabOf = (c: KnowledgeContainer) => tabs[c.session_id] ?? (c.files.length ? "chats" : "files");

  function toggleExpanded(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    if (chats[id] === undefined) loadChats(id);
  }

  const pinned = containers.filter(c => c.is_pinned);
  const others = containers.filter(c => !c.is_pinned);

  function containerMenu(c: KnowledgeContainer) {
    const ready = c.files.some(f => f.status === "active");
    return [
      { label: "Add files", icon: FilePlus2, onClick: () => setDialog({ kind: "add", container: c }) },
      { label: "Rename", icon: Pencil, onClick: () => setDialog({ kind: "renameContainer", container: c }) },
      {
        label: c.is_pinned ? "Remove from favourites" : "Add to favourites",
        icon: c.is_pinned ? PinOff : Pin,
        onClick: async () => { await togglePinContainer(c.session_id); reloadContainers(); },
      },
      {
        label: "Knowledge graph", icon: Network, disabled: !ready,
        hint: ready ? undefined : "Add at least one indexed file first",
        onClick: () => router.push(`/graph?container=${encodeURIComponent(c.session_id)}`),
      },
      { label: "Saved notes", icon: Bookmark, onClick: () => setDialog({ kind: "notes", containerId: c.session_id, name: c.name }) },
      { label: "Delete container", icon: Trash2, danger: true, onClick: () => setDialog({ kind: "deleteContainer", container: c }) },
    ];
  }

  function chatList(containerId: string) {
    const list = chats[containerId];
    return (
      <div className="pt-1">
        {list === undefined ? (
          <p className="px-2 py-1.5 text-[11px] text-gray-400">Loading…</p>
        ) : list.length === 0 ? (
          <p className="px-2 py-1.5 text-[11px] text-gray-400">No chats yet. Ask a question to start one.</p>
        ) : (
          <ul className="space-y-px max-h-64 overflow-y-auto">
            {list.map(chat => {
              const active = containerId === activeContainerId && chat.chat_id === activeChatId;
              return (
                <li key={chat.chat_id}
                  className={clsx(
                    "group/chat flex items-center gap-1.5 rounded-md pl-2 pr-0.5 py-1 cursor-pointer",
                    active ? "bg-white shadow-sm ring-1 ring-ndap-navy/25" : "hover:bg-white/80"
                  )}
                  onClick={() => onSelectChat(containerId, chat.chat_id)}
                >
                  <MessageSquare className={clsx("w-3 h-3 flex-shrink-0", active ? "text-ndap-navy" : "text-gray-400")} />
                  <span className={clsx("flex-1 truncate text-xs", active ? "text-gray-900 font-semibold" : "text-gray-700")} title={chat.chat_name}>
                    {chat.chat_name}
                  </span>
                  <span className="text-[10px] text-gray-400 tabular-nums">{chat.total_messages || ""}</span>
                  <span className="opacity-0 group-hover/chat:opacity-100 focus-within:opacity-100">
                    <ActionMenu label="Chat actions" items={[
                      { label: "Rename", icon: Pencil, onClick: () => setDialog({ kind: "renameChat", containerId, chat }) },
                      { label: "Clear messages", icon: Eraser, disabled: !chat.total_messages, onClick: () => setDialog({ kind: "deleteChat", containerId, chat, clearOnly: true }) },
                      { label: "Delete chat", icon: Trash2, danger: true, onClick: () => setDialog({ kind: "deleteChat", containerId, chat, clearOnly: false }) },
                    ]} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex gap-1 mt-1.5">
          <button onClick={() => onNewChat(containerId)}
            className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold text-ndap-navy bg-white border border-ndap-border rounded-md py-1 hover:border-ndap-navy/50">
            <Plus className="w-3 h-3" /> New chat
          </button>
          <button
            onClick={() => setDialog({
              kind: "notes", containerId,
              name: containers.find(c => c.session_id === containerId)?.name ?? "All documents",
            })}
            className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold text-gray-600 bg-white border border-ndap-border rounded-md py-1 hover:border-ndap-navy/50">
            <Bookmark className="w-3 h-3" /> Saved notes
          </button>
        </div>
      </div>
    );
  }

  function fileList(c: KnowledgeContainer) {
    return (
      <div className="pt-1">
        {c.files.length === 0 ? (
          <p className="px-2 py-1.5 text-[11px] text-gray-400">No files yet.</p>
        ) : (
          <ul className="space-y-px max-h-64 overflow-y-auto">
            {c.files.map(f => (
              <li key={f.filename} className="group/file flex items-center gap-1.5 rounded-md pl-2 pr-0.5 py-1 hover:bg-white/80">
                <FileIcon filename={f.filename} />
                <button
                  onClick={() => f.status === "active" && onOpenFile(c.session_id, f.filename)}
                  className={clsx("flex-1 truncate text-left text-xs", f.status === "active" ? "text-gray-700 hover:text-ndap-navy" : "text-gray-400 cursor-default")}
                  title={f.status === "failed" ? `${f.filename}: ${f.error_message ?? "ingestion failed"}` : f.filename}
                >
                  {f.filename}
                </button>
                {isIndexing(f.status) && (
                  <span className="flex items-center gap-1 text-[10px] text-amber-700"><Loader2 className="w-3 h-3 animate-spin" />Indexing</span>
                )}
                {f.status === "failed" && <AlertCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" aria-label="Ingestion failed" />}
                <span className="opacity-0 group-hover/file:opacity-100 focus-within:opacity-100">
                  <ActionMenu label="File actions" items={[
                    { label: "Open", icon: Eye, disabled: f.status !== "active", onClick: () => onOpenFile(c.session_id, f.filename) },
                    { label: "Remove from container", icon: Trash2, danger: true, onClick: () => setDialog({ kind: "removeFile", container: c, filename: f.filename, origin: f.origin }) },
                  ]} />
                </span>
              </li>
            ))}
          </ul>
        )}
        <button onClick={() => setDialog({ kind: "add", container: c })}
          className="w-full mt-1.5 flex items-center justify-center gap-1 text-[11px] font-semibold text-ndap-navy bg-white border border-ndap-border rounded-md py-1 hover:border-ndap-navy/50">
          <Plus className="w-3 h-3" /> Add files
        </button>
      </div>
    );
  }

  function folder(c: KnowledgeContainer) {
    const id = c.session_id;
    const isOpen = expanded.has(id);
    const active = id === activeContainerId;
    const indexing = c.files.filter(f => isIndexing(f.status)).length;
    const tab = tabOf(c);
    const chatCount = chats[id]?.length ?? c.chat_count;
    return (
      <div key={id} className={clsx("rounded-lg transition-colors", active ? "bg-ndap-sky ring-1 ring-ndap-navy/20" : isOpen && "bg-gray-50")}>
        <div className="flex items-center gap-1 pl-1 pr-1 py-1.5">
          <button onClick={() => toggleExpanded(id)} className="p-0.5 rounded text-gray-400 hover:text-gray-700" aria-label={isOpen ? "Collapse" : "Expand"}>
            <ChevronRight className={clsx("w-3.5 h-3.5 transition-transform", isOpen && "rotate-90")} />
          </button>
          <button onClick={() => onSelectContainer(id)} className="flex-1 min-w-0 flex items-center gap-1.5 text-left">
            {isOpen ? <FolderOpen className="w-4 h-4 flex-shrink-0 text-[#C9A227]" /> : <Folder className="w-4 h-4 flex-shrink-0 text-[#C9A227]" />}
            <span className={clsx("truncate text-[13px]", active ? "font-semibold text-gray-900" : "text-gray-800")} title={c.name}>{c.name}</span>
          </button>
          {c.is_pinned && <Pin className="w-3 h-3 text-ndap-navy/60 flex-shrink-0" aria-label="Favourite" />}
          {indexing > 0
            ? <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin flex-shrink-0" aria-label={`${indexing} file(s) indexing`} />
            : <span className="text-[10px] text-gray-400 tabular-nums" title={`${c.files.length} files`}>{c.files.length}</span>}
          <ActionMenu label="Container actions" items={containerMenu(c)} />
        </div>
        {isOpen && (
          <div className="pl-6 pr-1.5 pb-2">
            <div className="flex gap-3 border-b border-gray-200 text-[11px] font-semibold">
              {(["files", "chats"] as Tab[]).map(t => (
                <button key={t}
                  onClick={() => { setTabs(prev => ({ ...prev, [id]: t })); if (t === "chats" && chats[id] === undefined) loadChats(id); }}
                  className={clsx("pb-1 -mb-px border-b-2 capitalize", tab === t ? "border-ndap-navy text-ndap-navy" : "border-transparent text-gray-500 hover:text-gray-800")}
                >
                  {t} <span className="font-normal text-gray-400">{t === "files" ? c.files.length : chatCount}</span>
                </button>
              ))}
            </div>
            {tab === "files" ? fileList(c) : chatList(id)}
          </div>
        )}
      </div>
    );
  }

  const generalOpen = expanded.has(GENERAL_WORKSPACE);
  const generalActive = activeContainerId === GENERAL_WORKSPACE;

  return (
    <div className="flex flex-col gap-3 min-h-0 h-full">
      <button
        onClick={() => setDialog({ kind: "create" })}
        className="w-full flex items-center justify-center gap-2 bg-ndap-navy text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-ndap-navyDark transition-colors shadow-sm flex-shrink-0"
      >
        <Plus className="w-4 h-4" /> Knowledge Container
      </button>

      <div className="bg-white border border-ndap-border rounded-xl shadow-sm flex-1 min-h-0 overflow-y-auto p-1.5 space-y-0.5">
        {/* All documents: the whole library, with its own chats */}
        <div className={clsx("rounded-lg", generalActive ? "bg-ndap-sky ring-1 ring-ndap-navy/20" : generalOpen && "bg-gray-50")}>
          <div className="flex items-center gap-1 pl-1 pr-2 py-1.5">
            <button onClick={() => toggleExpanded(GENERAL_WORKSPACE)} className="p-0.5 rounded text-gray-400 hover:text-gray-700" aria-label={generalOpen ? "Collapse" : "Expand"}>
              <ChevronRight className={clsx("w-3.5 h-3.5 transition-transform", generalOpen && "rotate-90")} />
            </button>
            <button onClick={() => onSelectContainer(GENERAL_WORKSPACE)} className="flex-1 min-w-0 flex items-center gap-1.5 text-left">
              <Library className="w-4 h-4 flex-shrink-0 text-ndap-navy" />
              <span className={clsx("truncate text-[13px]", generalActive ? "font-semibold text-gray-900" : "text-gray-800")}>All documents</span>
            </button>
          </div>
          {generalOpen && <div className="pl-6 pr-1.5 pb-2">{chatList(GENERAL_WORKSPACE)}</div>}
        </div>

        {pinned.length > 0 && <SectionLabel>Favourites</SectionLabel>}
        {pinned.map(folder)}

        <SectionLabel>Knowledge containers</SectionLabel>
        {loadError ? (
          <p className="px-3 py-2 text-[11px] text-red-600">Couldn&apos;t load containers: {loadError}</p>
        ) : !loaded ? (
          <p className="px-3 py-2 text-[11px] text-gray-400">Loading…</p>
        ) : containers.length === 0 ? (
          <div className="px-3 py-4 text-center">
            <Folder className="w-6 h-6 mx-auto text-gray-300 mb-1.5" />
            <p className="text-xs text-gray-500">No containers yet</p>
            <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">Group documents into a container to chat, take notes and build a graph over just those files.</p>
          </div>
        ) : others.length === 0 ? (
          <p className="px-3 py-1.5 text-[11px] text-gray-400">All containers are in favourites.</p>
        ) : others.map(folder)}
      </div>

      {footer}

      {dialog?.kind === "create" && (
        <SourcesModal
          onClose={() => setDialog(null)}
          onDone={async c => { await reloadContainers(); onSelectContainer(c.session_id); }}
        />
      )}
      {dialog?.kind === "add" && (
        <SourcesModal
          container={dialog.container}
          onClose={() => setDialog(null)}
          onDone={c => { reloadContainers(); setTabs(prev => ({ ...prev, [c.session_id]: "files" })); setExpanded(prev => new Set(prev).add(c.session_id)); }}
        />
      )}
      {dialog?.kind === "renameContainer" && (
        <RenameModal
          title="Rename container"
          initial={dialog.container.name}
          onClose={() => setDialog(null)}
          onSave={async name => { await renameContainer(dialog.container.session_id, name); await reloadContainers(); }}
        />
      )}
      {dialog?.kind === "deleteContainer" && (() => {
        const c = dialog.container;
        const uploads = c.files.filter(f => f.origin === "upload").length;
        return (
          <ConfirmModal
            title={`Delete “${c.name}”?`}
            confirmLabel="Delete container"
            onClose={() => setDialog(null)}
            onConfirm={async () => { await deleteContainer(c.session_id); await reloadContainers(); onContainerDeleted(c.session_id); }}
            message={<>
              <p>This permanently deletes its {chats[c.session_id]?.length ?? c.chat_count} chat(s), saved notes and knowledge graph.</p>
              {uploads > 0 && <p className="mt-2">The {uploads} file(s) uploaded into this container are deleted from the server unless another container uses them.</p>}
              {c.files.length - uploads > 0 && <p className="mt-2 text-gray-500">Documents added from the library stay in the library.</p>}
            </>}
          />
        );
      })()}
      {dialog?.kind === "removeFile" && (
        <ConfirmModal
          title="Remove file from container?"
          confirmLabel="Remove"
          onClose={() => setDialog(null)}
          onConfirm={async () => { await removeContainerSource(dialog.container.session_id, dialog.filename); await reloadContainers(); }}
          message={<>
            <p><b>{dialog.filename}</b> will no longer be searched in “{dialog.container.name}”.</p>
            <p className="mt-2 text-gray-500">
              {dialog.origin === "upload"
                ? "It was uploaded here, so it is also deleted from the server unless another container uses it."
                : "It stays in the document library."}
              {" "}Entities found only in this file are also removed from the container&apos;s knowledge graph.
            </p>
          </>}
        />
      )}
      {dialog?.kind === "renameChat" && (
        <RenameModal
          title="Rename chat"
          initial={dialog.chat.chat_name}
          onClose={() => setDialog(null)}
          onSave={async name => { await renameChat(dialog.containerId, dialog.chat.chat_id, name); await loadChats(dialog.containerId); }}
        />
      )}
      {dialog?.kind === "deleteChat" && (
        <ConfirmModal
          title={dialog.clearOnly ? "Clear this chat?" : "Delete this chat?"}
          confirmLabel={dialog.clearOnly ? "Clear messages" : "Delete chat"}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await deleteChat(dialog.containerId, dialog.chat.chat_id, dialog.clearOnly);
            await loadChats(dialog.containerId);
            onChatRemoved(dialog.containerId, dialog.chat.chat_id, dialog.clearOnly);
          }}
          message={dialog.clearOnly
            ? <p>All {dialog.chat.total_messages} message(s) in “{dialog.chat.chat_name}”, including saved notes, are removed. The chat stays.</p>
            : <p>“{dialog.chat.chat_name}” and its saved notes are deleted permanently.</p>}
        />
      )}
      {dialog?.kind === "notes" && (
        <NotesModal
          containerId={dialog.containerId}
          containerName={dialog.name}
          onClose={() => setDialog(null)}
          onOpenChat={chatId => onSelectChat(dialog.containerId, chatId)}
        />
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-2.5 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{children}</p>;
}

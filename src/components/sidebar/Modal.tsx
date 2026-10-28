"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import clsx from "clsx";

export function Modal({
  title,
  onClose,
  children,
  footer,
  width = "max-w-md",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div role="dialog" aria-label={title} className={clsx("w-full bg-white rounded-2xl shadow-2xl flex flex-col max-h-[88vh]", width)}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-ndap-border">
          <h2 className="text-sm font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto min-h-0">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-ndap-border flex justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function Button({
  children, onClick, variant = "secondary", disabled, type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        variant === "primary" && "bg-ndap-navy text-white hover:bg-ndap-navyDark",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        variant === "secondary" && "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
      )}
    >
      {children}
    </button>
  );
}

export function RenameModal({
  title, initial, onClose, onSave,
}: {
  title: string;
  initial: string;
  onClose: () => void;
  onSave: (name: string) => Promise<unknown>;
}) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.select(); }, []);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const name = value.trim();
    if (!name || saving) return;
    if (name === initial) { onClose(); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(name);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={() => submit()} disabled={saving || !value.trim()}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </>}
    >
      <form onSubmit={submit}>
        <input
          ref={inputRef}
          value={value}
          maxLength={100}
          onChange={e => setValue(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ndap-navy"
        />
        <div className="flex justify-between mt-1.5 text-[11px]">
          <span className="text-red-600">{error}</span>
          <span className="text-gray-400">{value.length}/100</span>
        </div>
      </form>
    </Modal>
  );
}

export function ConfirmModal({
  title, message, confirmLabel, onClose, onConfirm,
}: {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={confirm} disabled={busy}>{busy ? "Working…" : confirmLabel}</Button>
      </>}
    >
      <div className="text-sm text-gray-700 leading-relaxed">{message}</div>
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </Modal>
  );
}

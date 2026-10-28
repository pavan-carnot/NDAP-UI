"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, type LucideIcon } from "lucide-react";
import clsx from "clsx";

export interface MenuItem {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  hint?: string;
}

const MENU_WIDTH = 196;

// 3-dot menu rendered in a portal, so the scrolling sidebar never clips it
export default function ActionMenu({ items, label }: { items: MenuItem[]; label: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const height = menuRef.current?.offsetHeight ?? items.length * 34 + 8;
    const top = r.bottom + 4 + height > window.innerHeight ? Math.max(8, r.top - height - 4) : r.bottom + 4;
    setPos({ top, left: Math.max(8, Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)) });
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e.type === "keydown" && (e as KeyboardEvent).key !== "Escape") return;
      if (e.type === "mousedown" && (menuRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node))) return;
      setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className={clsx(
          "p-1 rounded-md text-gray-400 hover:text-gray-800 hover:bg-gray-200/70 transition-colors flex-shrink-0",
          open && "bg-gray-200/70 text-gray-800"
        )}
        aria-label={label}
        aria-expanded={open}
        title={label}
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: MENU_WIDTH }}
          className="fixed z-[8000] bg-white border border-ndap-border rounded-xl shadow-xl py-1"
        >
          {items.map(item => (
            <button
              key={item.label}
              role="menuitem"
              disabled={item.disabled}
              title={item.hint}
              onClick={e => { e.stopPropagation(); setOpen(false); item.onClick(); }}
              className={clsx(
                "w-full flex items-center gap-2.5 px-3 py-[7px] text-xs text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                item.danger ? "text-red-600 hover:bg-red-50" : "text-gray-700 hover:bg-ndap-sky"
              )}
            >
              <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

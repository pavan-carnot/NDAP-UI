"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const NAV_LINKS = [
  { href: "/chat",  label: "Chat Assistant" },
  { href: "/admin", label: "Admin & Data" },
];

export default function Header() {
  const path = usePathname();

  return (
    <header className="w-full shadow-header sticky top-0 z-50 flex-shrink-0">

      {/* ── Tier 1: Gov of India strip ─────────────────────────────── */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-screen-xl mx-auto px-4 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Ashoka Pillar emblem placeholder */}
            <div className="w-9 h-9 rounded-full bg-ndap-navy flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-8 h-8" fill="none">
                <circle cx="18" cy="18" r="18" fill="#003087"/>
                <text x="18" y="23" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#FF9933" fontFamily="serif">🦁</text>
              </svg>
            </div>
            <div>
              <div className="text-[11px] text-gray-500 leading-none">
                भारत सरकार &nbsp;|&nbsp; Government of India
              </div>
              <div className="text-xl font-bold text-ndap-navy leading-tight tracking-tight">
                NITI Aayog
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-4 text-[11px] text-gray-500">
            <span>Skip to Main Content</span>
            <span>|</span>
            <span>हिंदी</span>
            <span>|</span>
            <span>Screen Reader</span>
          </div>
        </div>
      </div>

      {/* ── Tier 2: NDAP brand bar ─────────────────────────────────── */}
      <div
        style={{ background: "linear-gradient(135deg, #001F5B 0%, #003087 55%, #1565C0 100%)" }}
        className="relative overflow-hidden"
      >
        {/* decorative circles */}
        <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute right-32 -bottom-8 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />

        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center gap-4">
          {/* Logo icon */}
          <div className="flex-shrink-0 w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/20">
            <svg viewBox="0 0 40 40" className="w-8 h-8" fill="none">
              <rect width="40" height="40" rx="8" fill="transparent"/>
              {/* stylised data bars */}
              <rect x="4"  y="24" width="6" height="12" rx="1" fill="#FF9933"/>
              <rect x="13" y="16" width="6" height="20" rx="1" fill="#fff" opacity=".9"/>
              <rect x="22" y="10" width="6" height="26" rx="1" fill="#fff" opacity=".7"/>
              <rect x="31" y="18" width="6" height="18" rx="1" fill="#fff" opacity=".5"/>
              {/* line chart on top */}
              <polyline points="4,22 13,14 22,8 31,16" stroke="#FF9933" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <div>
            <h1 className="text-white font-bold text-lg sm:text-xl leading-tight tracking-tight">
              National Data and Analytics Platform
            </h1>
            <p className="text-blue-200 text-[11px] sm:text-xs mt-0.5 tracking-wide">
              Data Empowering India &nbsp;·&nbsp; NDAP &nbsp;·&nbsp; राष्ट्रीय डेटा और विश्लेषण मंच
            </p>
          </div>

          {/* right side badge */}
          <div className="ml-auto hidden md:flex items-center gap-2 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5">
            <div className="w-2 h-2 rounded-full bg-ndap-saffron animate-pulse" />
            <span className="text-white text-xs font-medium">GovData Intelligence POC</span>
          </div>
        </div>

        {/* tricolor stripe at bottom */}
        <div className="flex w-full h-[3px]">
          <div className="flex-1 bg-ndap-saffron" />
          <div className="flex-1 bg-white" />
          <div className="flex-1 bg-green-600" />
        </div>
      </div>

      {/* ── Tier 3: Navigation bar ─────────────────────────────────── */}
      <div className="bg-white border-b border-ndap-border">
        <div className="max-w-screen-xl mx-auto px-4 flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const active = path.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "relative px-4 py-3 text-sm font-medium transition-colors duration-150",
                  active
                    ? "text-ndap-navy border-b-2 border-ndap-navy"
                    : "text-gray-600 hover:text-ndap-blue hover:bg-ndap-sky"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import clsx from "clsx";
import { useSidebar } from "@/lib/sidebar-context";
import { useLanguage } from "@/lib/language-context";
import { getAuthUser, logout } from "@/lib/auth";

const NAV_LINKS = [
  { href: "/chat",  label: "Knowledge Agent" },
  { href: "/map",   label: "Spatial Analytics" },
  { href: "/admin", label: "Admin & Data" },
];

const LANGUAGES = [
  { code: "en",  label: "English",            enabled: true },
  { code: "hi",  label: "हिंदी",               enabled: true },
  { code: "as",  label: "অসমীয়া — Assamese",  enabled: false },
  { code: "bn",  label: "বাংলা — Bengali",     enabled: false },
  { code: "brx", label: "बड़ो — Bodo",          enabled: false },
  { code: "doi", label: "डोगरी — Dogri",       enabled: false },
  { code: "gu",  label: "ગુજરાતી — Gujarati", enabled: false },
  { code: "kn",  label: "ಕನ್ನಡ — Kannada",     enabled: false },
  { code: "ks",  label: "کشمیری — Kashmiri",   enabled: false },
  { code: "kok", label: "कोंकणी — Konkani",    enabled: false },
  { code: "mai", label: "मैथिली — Maithili",   enabled: false },
  { code: "ml",  label: "മലയാളം — Malayalam",  enabled: false },
  { code: "mni", label: "মৈতৈলোন্ — Manipuri", enabled: false },
  { code: "mr",  label: "मराठी — Marathi",     enabled: false },
  { code: "ne",  label: "नेपाली — Nepali",     enabled: false },
  { code: "or",  label: "ଓଡ଼ିଆ — Odia",        enabled: false },
  { code: "pa",  label: "ਪੰਜਾਬੀ — Punjabi",    enabled: false },
  { code: "sa",  label: "संस्कृतम् — Sanskrit", enabled: false },
  { code: "sat", label: "ᱥᱟᱱᱛᱟᱲᱤ — Santali",  enabled: false },
  { code: "sd",  label: "سنڌي — Sindhi",       enabled: false },
  { code: "ta",  label: "தமிழ் — Tamil",       enabled: false },
  { code: "te",  label: "తెలుగు — Telugu",     enabled: false },
  { code: "ur",  label: "اردو — Urdu",         enabled: false },
];

type FontSize = "small" | "normal" | "large";
const FONT_SIZE_MAP: Record<FontSize, string> = {
  small:  "13px",
  normal: "16px",
  large:  "18px",
};

export default function Header() {
  const path = usePathname();
  const router = useRouter();
  const [langOpen, setLangOpen] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>("normal");
  const { language, setLanguage } = useLanguage();
  const selectedLang = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];
  const langRef = useRef<HTMLDivElement>(null);
  const { sidebarOpen, setSidebarOpen } = useSidebar();
  const authUser = getAuthUser();

  useEffect(() => {
    if (fontSize === "normal") {
      document.documentElement.style.removeProperty("font-size");
    } else {
      document.documentElement.style.fontSize = FONT_SIZE_MAP[fontSize];
    }
  }, [fontSize]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (path === "/login") return null;

  return (
    <header className="w-full sticky top-0 z-50 flex-shrink-0">

      {/* ── Brand bar ─────────────────────────── */}
      <div className="relative overflow-hidden bg-[#F9F9F9] border-b border-[#E5E5E5] shadow-sm">

        <div className="relative max-w-screen-xl mx-auto px-6 py-3 flex items-center gap-4">

          {/* Logo + name + divider + tagline */}
          <Link href="/chat" className="flex items-center gap-3 flex-shrink-0">
            <Image
              src="/ihfc single.png"
              alt="IHFC"
              width={52}
              height={52}
              className="object-contain"
              priority
            />
            <span className="text-[#1a1a1a] font-bold tracking-tight" style={{ fontSize: "42px", lineHeight: "52px" }}>IHFC</span>
            <div className="w-px h-10 bg-[#1a1a1a]/30 mx-1" />
            <div className="text-[#1a1a1a] leading-snug">
              <div className="text-sm font-semibold">Technology</div>
              <div className="text-sm font-semibold">Innovation Hub</div>
              <div className="text-sm font-semibold">of IIT Delhi</div>
            </div>
          </Link>

          {/* Right controls */}
          <div className="ml-auto flex items-center gap-2">

            {/* Language */}
            <div ref={langRef} className="relative">
              <button
                onClick={() => setLangOpen((o) => !o)}
                className="flex items-center gap-1.5 text-[#1a1a1a] text-[12px] font-medium px-2.5 py-1.5 hover:bg-[#E5E5E5] rounded-lg transition-colors border border-[#E5E5E5]"
              >
                <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <circle cx="10" cy="10" r="8"/>
                  <ellipse cx="10" cy="10" rx="3.5" ry="8"/>
                  <line x1="2" y1="10" x2="18" y2="10"/>
                  <line x1="3.5" y1="6" x2="16.5" y2="6"/>
                  <line x1="3.5" y1="14" x2="16.5" y2="14"/>
                </svg>
                <span>{selectedLang.label.split(" — ")[0]}</span>
                <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {langOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-[#E5E5E5] rounded-xl shadow-xl z-[200] overflow-hidden">
                  <div className="max-h-64 overflow-y-auto py-1">
                    {LANGUAGES.map((lang, i) => (
                      <div
                        key={lang.code}
                        onClick={() => {
                          if (!lang.enabled) return;
                          setLanguage(lang.code);
                          setLangOpen(false);
                        }}
                        className={clsx(
                          "px-4 py-2 text-xs",
                          i === 1 && "border-b border-[#E5E5E5] mb-1",
                          lang.enabled
                            ? clsx(
                                "cursor-pointer transition-colors",
                                selectedLang.code === lang.code
                                  ? "text-[#F47920] font-semibold bg-[#FFF5EE]"
                                  : "text-gray-700 hover:bg-[#F9F9F9]"
                              )
                            : "text-gray-300 cursor-default"
                        )}
                      >
                        {lang.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Font size */}
            <div className="flex items-center border border-[#E5E5E5] rounded-lg overflow-hidden">
              {(["small", "normal", "large"] as FontSize[]).map((size, i) => (
                <button
                  key={size}
                  onClick={() => setFontSize(size)}
                  className={clsx(
                    "w-7 h-7 flex items-center justify-center transition-colors",
                    fontSize === size ? "bg-[#1a1a1a] text-white font-bold" : "text-[#1a1a1a]/60 hover:bg-[#E5E5E5]",
                    i < 2 && "border-r border-[#E5E5E5]"
                  )}
                  style={{ fontSize: size === "large" ? "13px" : size === "normal" ? "11px" : "9px", fontWeight: fontSize === size ? 700 : 500 }}
                  title={size === "large" ? "Large text" : size === "normal" ? "Default text" : "Small text"}
                >
                  A
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-[#E5E5E5] mx-1" />

            {/* User */}
            {authUser && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#F47920] flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-[12px] font-bold uppercase">
                    {authUser[0]}
                  </span>
                </div>
                <span className="text-[13px] font-medium text-[#1a1a1a] capitalize hidden sm:block">
                  {authUser}
                </span>
                <button
                  onClick={() => { logout(); router.replace("/login"); }}
                  className="text-[#1a1a1a]/30 hover:text-red-500 transition-colors ml-1"
                  title="Sign out"
                >
                  <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path d="M13 7l3 3m0 0l-3 3m3-3H8m4-7H5a2 2 0 00-2 2v10a2 2 0 002 2h7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Nav tab bar ── */}
      <div className="bg-[#111111]">
        <div className="max-w-screen-xl mx-auto px-4 flex items-center gap-1">

          {/* Sidebar toggle — only on /chat */}
          {path.startsWith("/chat") && (
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all flex-shrink-0 mr-2"
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
              </svg>
            </button>
          )}

          {NAV_LINKS.map((link) => {
            const active = path.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "relative px-4 py-3 text-sm font-medium transition-colors duration-150",
                  active
                    ? "text-white border-b-2 border-[#F47920]"
                    : "text-white/60 hover:text-white hover:bg-white/10"
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

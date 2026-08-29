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

      {/* ── Brand bar — clean, logo + centered title ── */}
      <div className="bg-[#F5EDD5] border-b border-[#C9B88A]">
        <div className="max-w-screen-xl mx-auto px-4 py-1 flex items-center">

          {/* Left — IDS logo */}
          <Link href="/chat" className="flex-shrink-0 flex items-center justify-center" style={{ width: 48, height: 48 }}>
            <Image
              src="/idslogo-new.png"
              alt="IDS Emblem"
              width={48}
              height={48}
              className="object-contain"
              style={{ transform: "scale(1.5)", transformOrigin: "center" }}
              priority
            />
          </Link>

          {/* Centered title */}
          <div className="flex-1 text-center" style={{ lineHeight: "1.25" }}>
            <div className="text-[#1E1B18] font-bold" style={{ fontSize: "22px", letterSpacing: "0.06em" }}>
              एकीकृत रक्षा स्टाफ
            </div>
            <div className="text-[#1E1B18] font-extrabold uppercase" style={{ fontSize: "20px", letterSpacing: "0.04em" }}>
              Integrated Defence Staff
            </div>
          </div>

          {/* Right — National Emblem */}
          <div className="flex-shrink-0">
            <Image
              src="/national_emblem.png"
              alt="National Emblem of India"
              width={44}
              height={44}
              className="object-contain"
            />
          </div>
        </div>
      </div>

      {/* ── Nav bar — tabs on left, controls on right ── */}
      <div style={{ background: "#8B1060" }}>
        <div className="max-w-screen-xl mx-auto px-4 flex items-center">

          {/* Sidebar toggle — only on /chat */}
          {path.startsWith("/chat") && (
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all flex-shrink-0 mr-1"
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
              </svg>
            </button>
          )}

          {/* Nav links */}
          {NAV_LINKS.map((link) => {
            const active = path.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "relative px-4 py-2 text-sm font-medium transition-colors duration-150 whitespace-nowrap",
                  active
                    ? "text-white border-b-2 border-[#C9A227]"
                    : "text-white/70 hover:text-white hover:bg-white/10"
                )}
              >
                {link.label}
              </Link>
            );
          })}

          {/* Spacer */}
          <div className="flex-1" />

          {/* ── Right controls ── */}

          {/* Language */}
          <div ref={langRef} className="relative">
            <button
              onClick={() => setLangOpen((o) => !o)}
              className="flex items-center gap-1.5 text-white/80 text-[12px] font-medium px-2.5 py-1.5 hover:bg-white/10 rounded-lg transition-colors"
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
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-[#D1D9E6] rounded-xl shadow-xl z-[200] overflow-hidden">
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
                        i === 1 && "border-b border-[#D1D9E6] mb-1",
                        lang.enabled
                          ? clsx(
                              "cursor-pointer transition-colors",
                              selectedLang.code === lang.code
                                ? "text-[#8B1060] font-semibold bg-[#F8F5FC]"
                                : "text-gray-700 hover:bg-[#F8F5FC]"
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

          {/* Divider */}
          <div className="w-px h-4 bg-white/20 mx-1" />

          {/* Font size */}
          <div className="flex items-center rounded-lg overflow-hidden border border-white/20">
            {(["small", "normal", "large"] as FontSize[]).map((size, i) => (
              <button
                key={size}
                onClick={() => setFontSize(size)}
                className={clsx(
                  "w-7 h-7 flex items-center justify-center transition-colors",
                  fontSize === size ? "bg-white text-[#8B1060] font-bold" : "text-white/60 hover:bg-white/10",
                  i < 2 && "border-r border-white/20"
                )}
                style={{ fontSize: size === "large" ? "13px" : size === "normal" ? "11px" : "9px", fontWeight: fontSize === size ? 700 : 500 }}
                title={size === "large" ? "Large text" : size === "normal" ? "Default text" : "Small text"}
              >
                A
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="w-px h-4 bg-white/20 mx-2" />

          {/* User */}
          {authUser && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#C9A227] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-[11px] font-bold uppercase">
                  {authUser[0]}
                </span>
              </div>
              <span className="text-[12px] font-medium text-white/80 hidden sm:block">
                {authUser}
              </span>
              <button
                onClick={() => { logout(); router.replace("/login"); }}
                className="text-white/40 hover:text-red-300 transition-colors ml-1"
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

    </header>
  );
}

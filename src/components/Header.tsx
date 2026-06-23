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
  { code: "en",  label: "English",               enabled: true },
  { code: "hi",  label: "हिंदी",                  enabled: true },
  { code: "as",  label: "অসমীয়া — Assamese",     enabled: false },
  { code: "bn",  label: "বাংলা — Bengali",        enabled: false },
  { code: "brx", label: "बड़ो — Bodo",             enabled: false },
  { code: "doi", label: "डोगरी — Dogri",          enabled: false },
  { code: "gu",  label: "ગુજરાતી — Gujarati",    enabled: false },
  { code: "kn",  label: "ಕನ್ನಡ — Kannada",        enabled: false },
  { code: "ks",  label: "کشمیری — Kashmiri",      enabled: false },
  { code: "kok", label: "कोंकणी — Konkani",       enabled: false },
  { code: "mai", label: "मैथिली — Maithili",      enabled: false },
  { code: "ml",  label: "മലയാളം — Malayalam",     enabled: false },
  { code: "mni", label: "মৈতৈলোন্ — Manipuri",   enabled: false },
  { code: "mr",  label: "मराठी — Marathi",        enabled: false },
  { code: "ne",  label: "नेपाली — Nepali",        enabled: false },
  { code: "or",  label: "ଓଡ଼ିଆ — Odia",           enabled: false },
  { code: "pa",  label: "ਪੰਜਾਬੀ — Punjabi",       enabled: false },
  { code: "sa",  label: "संस्कृतम् — Sanskrit",   enabled: false },
  { code: "sat", label: "ᱥᱟᱱᱛᱟᱲᱤ — Santali",     enabled: false },
  { code: "sd",  label: "سنڌي — Sindhi",          enabled: false },
  { code: "ta",  label: "தமிழ் — Tamil",          enabled: false },
  { code: "te",  label: "తెలుగు — Telugu",        enabled: false },
  { code: "ur",  label: "اردو — Urdu",            enabled: false },
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
    <header className="w-full sticky top-0 z-50 flex-shrink-0 shadow-sm">

      {/* ── Top utility bar ───────────────────────────────────────── */}
      <div className="bg-[#f5f5f5] border-b border-gray-300">
        <div className="max-w-screen-xl mx-auto px-4 py-1 flex items-center justify-between">

          {/* Left: Gov label */}
          <div className="flex items-center gap-2 text-[12px] text-gray-700">
            <span className="font-medium">भारत सरकार</span>
            <span className="text-gray-400">|</span>
            <span className="font-medium tracking-wide">GOVERNMENT OF INDIA</span>
          </div>

          {/* Right: language + font size */}
          <div className="flex items-center gap-2">

            {/* Language dropdown */}
            <div ref={langRef} className="relative">
              <button
                onClick={() => setLangOpen((o) => !o)}
                className="flex items-center gap-1 text-gray-600 text-[12px] font-medium px-2 py-1 hover:bg-gray-200 rounded transition-colors"
              >
                <svg viewBox="0 0 20 20" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <circle cx="10" cy="10" r="8"/>
                  <ellipse cx="10" cy="10" rx="3.5" ry="8"/>
                  <line x1="2" y1="10" x2="18" y2="10"/>
                  <line x1="3.5" y1="6" x2="16.5" y2="6"/>
                  <line x1="3.5" y1="14" x2="16.5" y2="14"/>
                </svg>
                <span>{selectedLang.label.split(" — ")[0]}</span>
                <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {langOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-xl z-[200] overflow-hidden">
                  <div className="max-h-72 overflow-y-auto">
                    {LANGUAGES.map((lang, i) => (
                      <div
                        key={lang.code}
                        onClick={() => {
                          if (!lang.enabled) return;
                          setLanguage(lang.code);
                          setLangOpen(false);
                        }}
                        className={clsx(
                          "w-full text-left px-4 py-2 text-xs text-gray-700",
                          i < 2 && "font-semibold",
                          i === 1 && "border-b border-gray-200",
                          lang.enabled
                            ? clsx(
                                "cursor-pointer transition-colors",
                                selectedLang.code === lang.code
                                  ? "bg-gray-800 text-white"
                                  : "hover:bg-gray-100"
                              )
                            : "cursor-default"
                        )}
                      >
                        {lang.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Font size controls */}
            <div className="flex items-center gap-0.5">
              {(["large", "normal", "small"] as FontSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => setFontSize(size)}
                  className={clsx(
                    "px-2 py-1 text-gray-600 rounded transition-colors hover:bg-gray-200",
                    fontSize === size && "bg-gray-300"
                  )}
                  style={{ fontSize: size === "large" ? "14px" : size === "normal" ? "11px" : "9px", fontWeight: 700 }}
                  title={size === "large" ? "Increase font" : size === "normal" ? "Default font" : "Decrease font"}
                >
                  {size === "large" ? "A+" : size === "normal" ? "A" : "A⁻"}
                </button>
              ))}
            </div>

          </div>
        </div>
      </div>

      {/* ── Main brand bar ────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-screen-xl mx-auto px-6 py-1.5 flex items-center gap-4">

          {/* Ashoka emblem */}
          <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
            <Image
              src="/docs/image.png"
              alt="Government of India Emblem"
              width={28}
              height={28}
              className="object-contain"
              priority
            />
            <span className="text-[9px] text-gray-500 tracking-wide">सत्यमेव जयते</span>
          </div>

          {/* Ministry name */}
          <div className="flex-1 min-w-0">
            <p className="text-gray-500 text-[11px] leading-tight">
              नवीन एवं नवीकरणीय ऊर्जा मंत्रालय
            </p>
            <h1 className="text-gray-900 font-bold text-sm sm:text-base leading-tight tracking-tight">
              MINISTRY OF NEW AND RENEWABLE ENERGY
            </h1>
          </div>

          {/* Azadi Ka Amrit Mahotsav logo */}
          <div className="flex-shrink-0">
            <Image
              src="/docs/image copy.png"
              alt="Azadi Ka Amrit Mahotsav"
              width={90}
              height={72}
              className="object-contain"
              priority
            />
          </div>

        </div>
      </div>

      {/* ── Navigation bar ────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-screen-xl mx-auto px-4 flex items-center gap-1">

          {/* Sidebar toggle — far left, only on /chat */}
          {path.startsWith("/chat") && (
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all flex-shrink-0 mr-2"
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
                    ? "text-gray-900 border-b-2 border-gray-900"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                )}
              >
                {link.label}
              </Link>
            );
          })}

          <div className="ml-auto hidden sm:flex items-center gap-3 py-2">
            {authUser && (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="white">
                      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                    </svg>
                  </div>
                  <div className="leading-tight">
                    <div className="text-xs font-semibold text-gray-800 capitalize">{authUser}</div>
                    <div className="text-[11px] text-gray-500">MNRE</div>
                  </div>
                </div>
                <button
                  onClick={() => { logout(); router.replace("/login"); }}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-500 border border-gray-200 hover:border-red-300 rounded-lg px-2.5 py-1.5 transition-colors"
                  title="Sign out"
                >
                  <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M13 7l3 3m0 0l-3 3m3-3H8m4-7H5a2 2 0 00-2 2v10a2 2 0 002 2h7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Sign out
                </button>
              </>
            )}
          </div>
        </div>
      </div>

    </header>
  );
}

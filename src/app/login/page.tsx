"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { login, isAuthenticated } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) router.replace("/chat");
  }, [router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      const ok = login(username.trim(), password);
      if (ok) {
        router.replace("/chat");
      } else {
        setError("Invalid username or password.");
        setLoading(false);
      }
    }, 400);
  }

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: "linear-gradient(150deg, #5C0A3E 0%, #8B1060 55%, #8B1A1A 100%)" }}
    >
      {/* Subtle pattern overlay */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Main card area */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">

          {/* Card */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.97)",
              boxShadow: "0 25px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.12)",
            }}
          >
            {/* Navy top section */}
            <div className="px-8 py-6 flex flex-col items-center gap-2" style={{ background: "#8B1060" }}>
              <Image
                src="/idslogo-new.png"
                alt="IDS"
                width={72}
                height={72}
                className="object-contain"
                priority
              />
              <div className="text-center mt-1">
                <p className="text-[#C9A227] font-bold tracking-wide" style={{ fontSize: "13px" }}>
                  एकीकृत रक्षा स्टाफ
                </p>
                <p className="text-white font-extrabold tracking-widest uppercase" style={{ fontSize: "14px", letterSpacing: "0.1em" }}>
                  Integrated Defence Staff
                </p>
                <p className="text-white/50 font-medium" style={{ fontSize: "10px", marginTop: "2px" }}>
                  Ministry of Defence, Government of India
                </p>
              </div>
            </div>

            {/* Gold accent bar */}
            <div style={{ height: "3px", background: "linear-gradient(90deg, #8B1A1A, #C9A227, #8B1A1A)" }} />

            <div className="px-8 pt-6 pb-6">
              <p className="text-center text-gray-400 text-xs mb-7 tracking-wide">
                Authorised Personnel Access Only
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#8B1060] mb-1.5 tracking-wide uppercase">
                    Username
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B1060]/40">
                      <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
                        <path d="M10 10a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 1114 0H3z" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      autoComplete="username"
                      placeholder="Enter your username"
                      className="w-full border border-[#D1D9E6] rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none transition"
                      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "#8B1060"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(92,32,96,0.12)"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "#D1D9E6"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)"; }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#8B1060] mb-1.5 tracking-wide uppercase">
                    Password
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B1060]/40">
                      <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      className="w-full border border-[#D1D9E6] rounded-xl pl-9 pr-10 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none transition"
                      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "#8B1060"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(92,32,96,0.12)"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "#D1D9E6"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)"; }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" strokeLinecap="round" strokeLinejoin="round" />
                          <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                    <svg viewBox="0 0 20 20" className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <p className="text-xs text-red-600 font-medium">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full text-white rounded-xl py-3 text-sm font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                  style={{
                    background: "linear-gradient(135deg, #5C0A3E 0%, #8B1060 50%, #8B1A1A 100%)",
                    boxShadow: "0 4px 16px rgba(92,32,96,0.4)",
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 20px rgba(92,32,96,0.55)";
                      (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 16px rgba(92,32,96,0.4)";
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                  }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Signing in…
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Sign In
                      <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
                        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </span>
                  )}
                </button>
              </form>
            </div>

            {/* Footer inside card */}
            <div className="px-8 py-3 text-center" style={{ background: "#fafafa", borderTop: "1px solid #E8EDF5" }}>
              <p className="text-[10px] text-gray-400 tracking-wide flex items-center justify-center gap-1.5">
                <svg viewBox="0 0 16 16" className="w-3 h-3 text-gray-400" fill="currentColor">
                  <path d="M8 1a5 5 0 00-5 5v1H2a1 1 0 00-1 1v6a1 1 0 001 1h12a1 1 0 001-1V8a1 1 0 00-1-1h-1V6a5 5 0 00-5-5zm3 6H5V6a3 3 0 016 0v1z" />
                </svg>
                Secure Access &nbsp;·&nbsp; Integrated Defence Staff
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

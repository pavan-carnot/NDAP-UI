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
      style={{ background: "linear-gradient(150deg, #001845 0%, #002d72 45%, #1a56a0 100%)" }}
    >
      {/* Header */}
      <div className="relative z-10 px-6 py-5 flex items-center gap-4">
        <div
          className="rounded-xl p-1.5"
          style={{ background: "rgba(255,255,255,0.08)", backdropFilter: "blur(8px)" }}
        >
          <Image src="/ndap_logo.png" alt="NDAP Logo" width={110} height={40} className="object-contain" priority />
        </div>
        <div className="w-px h-10" style={{ background: "rgba(255,255,255,0.2)" }} />
        <div>
          <p className="text-white font-bold text-sm leading-tight tracking-wide">
            National Data and Analytics Platform
          </p>
          <p className="text-blue-200 text-[11px] mt-0.5">
            NITI Aayog &nbsp;·&nbsp; Government of India
          </p>
        </div>
      </div>

      {/* Main card area */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">

          {/* Card */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.97)",
              boxShadow: "0 25px 60px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.15)",
            }}
          >
            <div className="px-8 pt-8 pb-6">
<h2 className="text-center font-bold text-2xl mb-1" style={{ color: "#001845" }}>
                Login
              </h2>
              <p className="text-center text-gray-400 text-xs mb-7 tracking-wide">
                Sign in to NDAP Intelligence Platform
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 tracking-wide uppercase">
                    Username
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
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
                      className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 tracking-wide uppercase">
                    Password
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
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
                      className="w-full border border-gray-200 rounded-xl pl-9 pr-10 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
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
                    background: "linear-gradient(135deg, #001845 0%, #003087 50%, #1a56a0 100%)",
                    boxShadow: "0 4px 16px rgba(0,48,135,0.4)",
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 20px rgba(0,48,135,0.55)";
                      (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 16px rgba(0,48,135,0.4)";
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
            <div className="px-8 py-3 text-center" style={{ background: "#fafafa", borderTop: "1px solid #f0f0f0" }}>
              <p className="text-[10px] text-gray-400 tracking-wide flex items-center justify-center gap-1.5">
                <svg viewBox="0 0 16 16" className="w-3 h-3 text-gray-400" fill="currentColor">
                  <path d="M8 1a5 5 0 00-5 5v1H2a1 1 0 00-1 1v6a1 1 0 001 1h12a1 1 0 001-1V8a1 1 0 00-1-1h-1V6a5 5 0 00-5-5zm3 6H5V6a3 3 0 016 0v1z" />
                </svg>
                Secure Access &nbsp;·&nbsp; NDAP &nbsp;·&nbsp; NITI Aayog, Govt. of India
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 px-6 py-4 text-center">
        <p className="text-white/30 text-[10px] tracking-wide">
          © NITI Aayog, Government of India. All rights reserved.
        </p>
      </div>
    </div>
  );
}

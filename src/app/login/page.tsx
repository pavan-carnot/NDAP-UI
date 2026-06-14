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
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(160deg, #001F5B 0%, #003087 55%, #1565C0 100%)" }}>

      {/* Tricolor stripe */}
      <div className="flex w-full h-1">
        <div className="flex-1 bg-ndap-saffron" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-green-600" />
      </div>

      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-4">
        <Image src="/ndap_logo.png" alt="NDAP Logo" width={120} height={44} className="object-contain" priority />
        <div className="w-px h-10 bg-white/20" />
        <div>
          <p className="text-white font-bold text-sm leading-tight">National Data and Analytics Platform</p>
          <p className="text-blue-200 text-[11px] mt-0.5">NITI Aayog &nbsp;·&nbsp; Government of India</p>
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Card top accent */}
          <div className="h-1.5 flex">
            <div className="flex-1 bg-ndap-saffron" />
            <div className="flex-1 bg-white border-t border-gray-200" />
            <div className="flex-1 bg-green-600" />
          </div>

          <div className="px-8 py-8">
            {/* Icon */}
            <div className="flex justify-center mb-5">
              <div className="w-14 h-14 rounded-2xl bg-ndap-sky border-2 border-ndap-border flex items-center justify-center shadow-sm">
                <svg viewBox="0 0 24 24" className="w-7 h-7 text-ndap-navy" fill="currentColor">
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                </svg>
              </div>
            </div>

            <h2 className="text-center text-ndap-navy font-bold text-xl mb-1">Sign In</h2>
            <p className="text-center text-gray-500 text-xs mb-6">Access the NDAP Intelligence Platform</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="Enter username"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ndap-blue focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="Enter password"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ndap-blue focus:border-transparent transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" strokeLinecap="round" strokeLinejoin="round"/>
                        <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <svg viewBox="0 0 20 20" className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                  </svg>
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-ndap-navy text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-ndap-navyDark transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm mt-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Signing in…
                  </span>
                ) : "Sign In"}
              </button>
            </form>
          </div>

          <div className="px-8 pb-6 text-center">
            <p className="text-[11px] text-gray-400">
              Secure access &nbsp;·&nbsp; NDAP &nbsp;·&nbsp; NITI Aayog
            </p>
          </div>
        </div>
      </div>

      {/* Footer stripe */}
      <div className="flex w-full h-1">
        <div className="flex-1 bg-ndap-saffron" />
        <div className="flex-1 bg-white/30" />
        <div className="flex-1 bg-green-600" />
      </div>
    </div>
  );
}

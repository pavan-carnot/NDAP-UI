"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Login failed");
        return;
      }

      const { apiKey } = await res.json() as { apiKey: string };
      localStorage.setItem("ndap_api_key", apiKey);
      router.replace("/chat");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4" style={{ background: "var(--ndap-bg)" }}>
      <div className="w-full max-w-sm">

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">

          {/* Card header band */}
          <div
            className="px-8 py-6 text-center"
            style={{ background: "linear-gradient(135deg, #001F5B 0%, #003087 60%, #1565C0 100%)" }}
          >
            <Image
              src="/ndap_logo.png"
              alt="NDAP Logo"
              width={120}
              height={45}
              className="object-contain mx-auto mb-3"
              priority
            />
            <p className="text-blue-200 text-xs tracking-wide">
              Sign in to access the Knowledge Agent
            </p>
            {/* Tricolor stripe */}
            <div className="flex w-full h-[3px] mt-4 -mx-0 rounded-full overflow-hidden">
              <div className="flex-1 bg-ndap-saffron" />
              <div className="flex-1 bg-white" />
              <div className="flex-1 bg-green-600" />
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 py-7 space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
                autoComplete="username"
                className="w-full px-4 py-2.5 rounded-lg border border-ndap-border text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ndap-blue focus:border-ndap-blue transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                autoComplete="current-password"
                className="w-full px-4 py-2.5 rounded-lg border border-ndap-border text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ndap-blue focus:border-ndap-blue transition"
              />
            </div>

            {error && (
              <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ background: "linear-gradient(90deg, #003087, #1565C0)" }}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-4">
          National Data and Analytics Platform &nbsp;·&nbsp; NITI Aayog
        </p>
      </div>
    </div>
  );
}

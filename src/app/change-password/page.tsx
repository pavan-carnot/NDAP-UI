"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changePassword } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";

const MIN_LEN = 10;

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, refresh, signOut } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (next.length < MIN_LEN) return setError(`Use at least ${MIN_LEN} characters.`);
    if (next !== repeat) return setError("The new passwords don't match.");
    setBusy(true);
    try {
      await changePassword(current, next);
      await refresh();
      router.replace("/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  const field = "w-full border border-[#D1D9E6] rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-[#8B1060]";

  return (
    <div className="min-h-full flex-1 flex items-center justify-center px-4 py-10"
         style={{ background: "linear-gradient(150deg, #5C0A3E 0%, #8B1060 55%, #8B1A1A 100%)" }}>
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl space-y-4">
        <div>
          <h1 className="text-lg font-bold text-[#8B1060]">Change your password</h1>
          <p className="mt-1 text-xs text-gray-500">
            {user?.must_change_password
              ? "Your password was set by an admin. Choose your own before you continue."
              : "Choose a new password. Your other sessions will be signed out."}
          </p>
        </div>
        <label className="block text-xs font-semibold text-gray-700">
          Current password
          <input type="password" autoComplete="current-password" required value={current}
                 onChange={e => setCurrent(e.target.value)} className={`${field} mt-1`} />
        </label>
        <label className="block text-xs font-semibold text-gray-700">
          New password <span className="font-normal text-gray-400">(at least {MIN_LEN} characters)</span>
          <input type="password" autoComplete="new-password" required value={next}
                 onChange={e => setNext(e.target.value)} className={`${field} mt-1`} />
        </label>
        <label className="block text-xs font-semibold text-gray-700">
          Repeat new password
          <input type="password" autoComplete="new-password" required value={repeat}
                 onChange={e => setRepeat(e.target.value)} className={`${field} mt-1`} />
        </label>
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        <button type="submit" disabled={busy}
                className="w-full rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #5C0A3E 0%, #8B1060 50%, #8B1A1A 100%)" }}>
          {busy ? "Saving…" : "Change password"}
        </button>
        <button type="button" onClick={signOut} className="w-full text-xs text-gray-500 hover:text-gray-700">
          Sign out
        </button>
      </form>
    </div>
  );
}

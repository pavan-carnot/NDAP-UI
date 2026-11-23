"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import {
  AuditEntry, AuditFilters, AuditResult, auditExportUrl, ChainCheck, verifyAuditChain, createUser, getIntegrity, IntegrityReport, runIntegrityCheck, KnowledgeContainer, listAllContainers, listAudit, listUsers, resetUserPassword,
  updateUser, UserAccount,
} from "@/lib/api";
import ShareModal from "@/components/sidebar/ShareModal";
import { Button, Modal } from "@/components/sidebar/Modal";

const MIN_PASSWORD = 10;
const PERMISSIONS = [
  { id: "reviewer", label: "Reviewer", help: "Mark sources approved or not approved" },
  { id: "auditor", label: "Auditor", help: "Read the audit log and access report" },
] as const;

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "–");
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

function Header({ title, sub, children }: { title: string; sub: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-0">
        <h2 className="text-ndap-navy font-bold text-lg">{title}</h2>
        <p className="text-gray-500 text-sm mt-0.5">{sub}</p>
      </div>
      {children}
    </div>
  );
}

function Pill({ children, tone = "gray" }: { children: React.ReactNode; tone?: "gray" | "navy" | "green" | "red" | "amber" }) {
  const tones = {
    gray: "bg-gray-100 text-gray-600", navy: "bg-ndap-navy/10 text-ndap-navy", green: "bg-green-100 text-green-700",
    red: "bg-red-100 text-red-700", amber: "bg-amber-100 text-amber-800",
  };
  return <span className={clsx("text-[10px] px-2 py-0.5 rounded-full font-semibold", tones[tone])}>{children}</span>;
}

const field = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ndap-navy";

/* ── Users ─────────────────────────────────────────────────────────── */

type UserDialog = { kind: "create" } | { kind: "edit"; user: UserAccount } | { kind: "reset"; user: UserAccount };

export function UsersTab({ me }: { me: string }) {
  const [users, setUsers] = useState<UserAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<UserDialog | null>(null);

  const reload = useCallback(() => listUsers().then(setUsers).catch(e => setError(errText(e))), []);
  useEffect(() => { reload(); }, [reload]);

  async function toggleActive(u: UserAccount) {
    setError(null);
    try { await updateUser(u.username, { is_active: !u.is_active }); await reload(); }
    catch (e) { setError(errText(e)); }
  }

  return (
    <div>
      <Header title="Users" sub="Accounts are local to this server. Users are deactivated, never deleted, so their history stays.">
        <Button variant="primary" onClick={() => setDialog({ kind: "create" })}>New user</Button>
      </Header>
      {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}
      {!users ? <p className="text-sm text-gray-400">Loading…</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b">
                <th className="py-2 pr-3">User</th><th className="pr-3">Role</th><th className="pr-3">Permissions</th>
                <th className="pr-3">Status</th><th className="pr-3">Last login</th><th />
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.username} className={clsx("border-b last:border-0", !u.is_active && "text-gray-400")}>
                  <td className="py-2 pr-3">
                    <div className="font-medium">{u.display_name || u.username}</div>
                    {u.display_name && <div className="text-xs text-gray-400">{u.username}</div>}
                  </td>
                  <td className="pr-3"><Pill tone={u.role === "admin" ? "navy" : "gray"}>{u.role === "admin" ? "Admin" : "User"}</Pill></td>
                  <td className="pr-3 space-x-1">{u.permissions.length ? u.permissions.map(p => <Pill key={p}>{p}</Pill>) : "–"}</td>
                  <td className="pr-3 space-x-1">
                    <Pill tone={u.is_active ? "green" : "red"}>{u.is_active ? "Active" : "Deactivated"}</Pill>
                    {u.must_change_password && u.is_active && <Pill tone="amber">Temp password</Pill>}
                    {u.locked_until && new Date(u.locked_until) > new Date() && <Pill tone="red">Locked</Pill>}
                  </td>
                  <td className="pr-3 text-xs">{fmt(u.last_login_at)}</td>
                  <td className="py-2 text-right whitespace-nowrap space-x-1">
                    <Button onClick={() => setDialog({ kind: "edit", user: u })}>Edit</Button>
                    <Button onClick={() => setDialog({ kind: "reset", user: u })}>Reset password</Button>
                    {u.username !== me && (
                      <Button variant={u.is_active ? "danger" : "secondary"} onClick={() => toggleActive(u)}>
                        {u.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {dialog?.kind === "create" && <UserForm onClose={() => setDialog(null)} onSaved={reload} />}
      {dialog?.kind === "edit" && <UserForm user={dialog.user} onClose={() => setDialog(null)} onSaved={reload} />}
      {dialog?.kind === "reset" && <ResetPassword user={dialog.user} onClose={() => setDialog(null)} onSaved={reload} />}
    </div>
  );
}

function UserForm({ user, onClose, onSaved }: { user?: UserAccount; onClose: () => void; onSaved: () => unknown }) {
  const [username, setUsername] = useState(user?.username ?? "");
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [role, setRole] = useState<"admin" | "user">(user?.role ?? "user");
  const [perms, setPerms] = useState<string[]>(user?.permissions ?? []);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!user && password.length < MIN_PASSWORD) return setError(`Temporary password: at least ${MIN_PASSWORD} characters`);
    setBusy(true);
    try {
      if (user) await updateUser(user.username, { display_name: displayName, role, permissions: perms as UserAccount["permissions"] });
      else await createUser({ username, password, display_name: displayName, role, permissions: perms });
      await onSaved();
      onClose();
    } catch (e) {
      setError(errText(e));
      setBusy(false);
    }
  }

  return (
    <Modal title={user ? `Edit ${user.username}` : "New user"} onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={busy || (!user && !username.trim())}>{busy ? "Saving…" : "Save"}</Button></>}>
      <div className="space-y-3">
        {!user && (
          <label className="block text-xs font-semibold text-gray-700">Username (usually an email)
            <input value={username} onChange={e => setUsername(e.target.value)} autoComplete="off" spellCheck={false} className={`${field} mt-1`} />
          </label>
        )}
        <label className="block text-xs font-semibold text-gray-700">Display name
          <input value={displayName} onChange={e => setDisplayName(e.target.value)} className={`${field} mt-1`} />
        </label>
        <label className="block text-xs font-semibold text-gray-700">Role
          <select value={role} onChange={e => setRole(e.target.value as "admin" | "user")} className={`${field} mt-1`}>
            <option value="user">User: own containers and those shared with them</option>
            <option value="admin">Admin: everything, including users and sharing</option>
          </select>
        </label>
        <fieldset>
          <legend className="text-xs font-semibold text-gray-700 mb-1">Extra permissions</legend>
          {PERMISSIONS.map(p => (
            <label key={p.id} className="flex items-start gap-2 text-xs text-gray-700 mb-1">
              <input type="checkbox" className="mt-0.5 accent-[#8B1060]" checked={perms.includes(p.id)}
                onChange={e => setPerms(prev => e.target.checked ? [...prev, p.id] : prev.filter(x => x !== p.id))} />
              <span><b>{p.label}</b>: {p.help}</span>
            </label>
          ))}
        </fieldset>
        {!user && (
          <label className="block text-xs font-semibold text-gray-700">Temporary password
            <input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className={`${field} mt-1`} />
            <span className="block font-normal text-[11px] text-gray-500 mt-1">They choose their own at first sign-in. Give it to them in person.</span>
          </label>
        )}
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}

function ResetPassword({ user, onClose, onSaved }: { user: UserAccount; onClose: () => void; onSaved: () => unknown }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (password.length < MIN_PASSWORD) return setError(`At least ${MIN_PASSWORD} characters`);
    setBusy(true);
    try { await resetUserPassword(user.username, password); await onSaved(); onClose(); }
    catch (e) { setError(errText(e)); setBusy(false); }
  }

  return (
    <Modal title={`Reset password for ${user.username}`} onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Set temporary password"}</Button></>}>
      <p className="text-xs text-gray-600 mb-3">Their current sessions end now, and they must choose a new password at next sign-in.</p>
      <input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)}
        aria-label="Temporary password" className={field} />
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
    </Modal>
  );
}

/* ── Containers / access report ────────────────────────────────────── */

export function ContainersTab({ canShare }: { canShare: boolean }) {
  const [containers, setContainers] = useState<KnowledgeContainer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState<KnowledgeContainer | null>(null);
  const [filter, setFilter] = useState("");

  const reload = useCallback(() => listAllContainers().then(setContainers).catch(e => setError(errText(e))), []);
  useEffect(() => { reload(); }, [reload]);

  const q = filter.trim().toLowerCase();
  const shown = (containers ?? []).filter(c => !q || c.name.toLowerCase().includes(q) || c.owner.includes(q)
    || c.shared_with.some(s => s.username.includes(q)));

  return (
    <div>
      <Header title="Containers and access" sub="Every knowledge container, its owner, and who else can open it.">
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter by name or user"
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-56" />
      </Header>
      {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}
      {!containers ? <p className="text-sm text-gray-400">Loading…</p> : shown.length === 0 ? (
        <p className="text-sm text-gray-400">No containers.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b">
                <th className="py-2 pr-3">Container</th><th className="pr-3">Owner</th><th className="pr-3">Files</th>
                <th className="pr-3">Shared with</th><th />
              </tr>
            </thead>
            <tbody>
              {shown.map(c => (
                <tr key={c.session_id} className="border-b last:border-0 align-top">
                  <td className="py-2 pr-3 font-medium">{c.name}<div className="text-[10px] text-gray-400 font-mono">{c.session_id}</div></td>
                  <td className="py-2 pr-3">{c.owner}</td>
                  <td className="py-2 pr-3 tabular-nums">{c.files.length}</td>
                  <td className="py-2 pr-3 text-xs">
                    {c.shared_with.length === 0 ? "–" : c.shared_with.map(s => (
                      <div key={s.username}>{s.username} <Pill tone={s.access === "editor" ? "navy" : "gray"}>{s.access}</Pill></div>
                    ))}
                  </td>
                  <td className="py-2 text-right">{canShare && <Button onClick={() => setSharing(c)}>Share</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {sharing && <ShareModal container={sharing} onClose={() => setSharing(null)} onChanged={reload} />}
    </div>
  );
}

/* ── Audit log ─────────────────────────────────────────────────────── */

const PAGE = 50;
const ACTIONS = [
  ["", "All actions"], ["auth.", "Sign-ins and passwords"], ["user.", "User changes"], ["share.", "Sharing"],
  ["container.", "Containers"], ["file.", "Files (added, removed, viewed)"], ["query", "Questions and answers"],
  ["export.", "Exports and downloads"], ["admin.", "Admin tools"], ["library.", "Library changes"],
  ["document.approval", "Source approvals"], ["integrity.", "Integrity alarms"], ["graph.", "Graphs"], ["report.", "Reports"],
] as const;

const RESULTS: [AuditResult | "", string][] = [
  ["", "Any result"], ["success", "Succeeded"], ["denied", "Denied"], ["not_found", "Not found / no access"],
  ["rejected", "Rejected"], ["error", "Errors"],
];
const RESULT_TONE: Record<string, "green" | "red" | "amber" | "gray"> = {
  success: "green", denied: "red", not_found: "amber", rejected: "amber", error: "red",
};

function ChainStatus({ check }: { check: ChainCheck | null }) {
  if (!check) return null;
  return check.ok ? (
    <p className="text-xs text-emerald-700">Log intact: {check.entries} entries, hash chain verified.</p>
  ) : (
    <p role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
      Audit log tampering detected at entry {check.first_bad_seq ?? "?"}: {check.problem}. Compare with an exported copy or backup.
    </p>
  );
}

export function AuditTab() {
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [result, setResult] = useState<AuditResult | "">("");
  const [role, setRole] = useState<"" | "admin" | "user">("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<{ total: number; entries: AuditEntry[] } | null>(null);
  const [chain, setChain] = useState<ChainCheck | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filters: AuditFilters = {
    actor: actor.trim() || undefined, action: action || undefined, result: result || undefined,
    role: role || undefined, since: since || undefined, until: until || undefined,
  };
  const key = JSON.stringify(filters);

  useEffect(() => {
    setError(null);
    listAudit({ ...JSON.parse(key), limit: PAGE, offset }).then(setData).catch(e => setError(errText(e)));
  }, [key, offset]);

  useEffect(() => { verifyAuditChain().then(setChain).catch(() => null); }, []);

  const reset = <T,>(set: (v: T) => void) => (v: T) => { setOffset(0); set(v); };
  const sel = "border border-gray-300 rounded-lg px-2 py-1.5";

  return (
    <div>
      <Header title="Audit log" sub="Every change, document view, export, question and answer, and every refused or failed request. Append-only and hash-chained.">
        <a href={auditExportUrl(filters)} download
           className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-ndap-navy text-ndap-navy hover:bg-ndap-sky">
          Export CSV
        </a>
      </Header>
      <div className="mb-3"><ChainStatus check={chain} /></div>
      <div className="flex flex-wrap gap-2 mb-4 text-sm">
        <input value={actor} onChange={e => reset(setActor)(e.target.value)} placeholder="User" className="border border-gray-300 rounded-lg px-3 py-1.5 w-52" />
        <select value={action} onChange={e => reset(setAction)(e.target.value)} className={sel} aria-label="Action">
          {ACTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={result} onChange={e => reset(setResult)(e.target.value as AuditResult | "")} className={sel} aria-label="Result">
          {RESULTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={role} onChange={e => reset(setRole)(e.target.value as "" | "admin" | "user")} className={sel} aria-label="Role">
          <option value="">Any role</option><option value="admin">Admins</option><option value="user">Users</option>
        </select>
        <label className="flex items-center gap-1 text-xs text-gray-600">From
          <input type="date" value={since} onChange={e => reset(setSince)(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1" />
        </label>
        <label className="flex items-center gap-1 text-xs text-gray-600">Before
          <input type="date" value={until} onChange={e => reset(setUntil)(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1" />
        </label>
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}
      {!data ? <p className="text-sm text-gray-400">Loading…</p> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b">
                  <th className="py-2 pr-3">#</th><th className="pr-3">When</th><th className="pr-3">User</th><th className="pr-3">Role</th>
                  <th className="pr-3">Action</th><th className="pr-3">Item</th><th className="pr-3">Result</th><th>From</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map(e => (
                  <Fragment key={e.id}>
                    <tr onClick={() => setOpen(o => (o === e.id ? null : e.id))}
                        className="border-b last:border-0 align-top cursor-pointer hover:bg-gray-50" aria-expanded={open === e.id}>
                      <td className="py-1.5 pr-3 tabular-nums text-gray-400">{e.seq ?? ""}</td>
                      <td className="py-1.5 pr-3 whitespace-nowrap">{fmt(e.created_at)}</td>
                      <td className="py-1.5 pr-3">{e.actor ?? "–"}</td>
                      <td className="py-1.5 pr-3">{e.role ?? "–"}</td>
                      <td className="py-1.5 pr-3"><Pill tone={e.action.includes("failed") || e.action.startsWith("integrity.") ? "red" : "gray"}>{e.action}</Pill></td>
                      <td className="py-1.5 pr-3 font-mono text-[10px] break-all">{e.target_id ?? "–"}</td>
                      <td className="py-1.5 pr-3">{e.result ? <Pill tone={RESULT_TONE[e.result] ?? "gray"}>{e.result}{e.status_code ? ` ${e.status_code}` : ""}</Pill> : "–"}</td>
                      <td className="py-1.5 font-mono text-[10px] text-gray-500">{e.ip ?? "–"}</td>
                    </tr>
                    {open === e.id && (
                      <tr className="border-b bg-gray-50">
                        <td />
                        <td colSpan={7} className="py-2 pr-3 text-[11px] text-gray-700 space-y-1">
                          {e.method && <p><b>Request:</b> {e.method} {e.route}{e.duration_ms != null ? ` · ${e.duration_ms} ms` : ""}</p>}
                          {Object.keys(e.detail).length > 0 && (
                            <pre className="whitespace-pre-wrap break-all font-mono text-[10px] bg-white border rounded p-2">{JSON.stringify(e.detail, null, 2)}</pre>
                          )}
                          {e.entry_hash && <p className="font-mono text-[10px] text-gray-400 break-all">Entry hash {e.entry_hash}</p>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
            <span className="mr-auto">{data.total === 0 ? "No entries" : `${offset + 1}–${Math.min(offset + PAGE, data.total)} of ${data.total}`}</span>
            <Button onClick={() => setOffset(o => Math.max(0, o - PAGE))} disabled={offset === 0}>Newer</Button>
            <Button onClick={() => setOffset(o => o + PAGE)} disabled={offset + PAGE >= data.total}>Older</Button>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Integrity (fingerprints and custody chain) ────────────────────── */

export function IntegrityTab({ canRun }: { canRun: boolean }) {
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  const reload = useCallback(() => getIntegrity().then(setReport).catch(e => setError(errText(e))), []);
  useEffect(() => { reload(); }, [reload]);

  async function runNow() {
    setError(null);
    try {
      await runIntegrityCheck();
      setStarted(true);
      setTimeout(() => { reload(); setStarted(false); }, 5000);
    } catch (e) { setError(errText(e)); }
  }

  const c = report?.counts ?? {};
  const last = report?.last_run;
  return (
    <div>
      <Header title="Integrity" sub="Every stored original is fingerprinted (SHA-256) when received and re-checked on a schedule. The custody log is hash-chained, so an edited or deleted entry shows up here.">
        {canRun && <Button variant="primary" onClick={runNow} disabled={started}>{started ? "Checking…" : "Check now"}</Button>}
      </Header>
      {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}
      {!report ? <p className="text-sm text-gray-400">Loading…</p> : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {([["ok", "Match fingerprint", "green"], ["mismatch", "Changed", "red"], ["missing", "Missing", "red"],
               ["unverified", "Not yet checked", "gray"]] as const).map(([k, label, tone]) => (
              <div key={k} className="rounded-xl border border-ndap-border px-4 py-3">
                <p className={clsx("text-2xl font-bold tabular-nums", tone === "red" && (c[k] ?? 0) > 0 ? "text-red-600" : "text-ndap-navy")}>{c[k] ?? 0}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            ))}
            <div className="rounded-xl border border-ndap-border px-4 py-3">
              <p className={clsx("text-sm font-bold", report.chain.ok ? "text-emerald-700" : "text-red-600")}>
                {report.chain.ok ? "Intact" : "Broken"}
              </p>
              <p className="text-xs text-gray-500">Custody chain · {report.chain.entries} entries</p>
              <p className={clsx("mt-1 text-sm font-bold", report.audit_chain.ok ? "text-emerald-700" : "text-red-600")}>
                {report.audit_chain.ok ? "Intact" : "Broken"}
              </p>
              <p className="text-xs text-gray-500">Audit log · {report.audit_chain.entries} entries</p>
            </div>
          </div>
          {!report.audit_chain.ok && (
            <p role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              Audit log entry {report.audit_chain.first_bad_seq}: {report.audit_chain.problem}.
            </p>
          )}
          {!report.chain.ok && (
            <p role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              Custody log entry {report.chain.first_bad_id}: {report.chain.problem}. Compare with the off-host backup.
            </p>
          )}
          <p className="text-xs text-gray-500">
            Last scheduled check: {last ? `${fmt(last.at)} (${last.actor ?? ""} · ${last.checked} files)` : "not run yet"}
          </p>

          <section>
            <h3 className="text-sm font-semibold text-ndap-navy mb-2">Files needing attention</h3>
            {report.problems.length === 0 ? <p className="text-sm text-gray-400">None.</p> : (
              <table className="w-full text-xs">
                <thead><tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b">
                  <th className="py-2 pr-3">File</th><th className="pr-3">Status</th><th className="pr-3">Fingerprint</th><th>Last checked</th>
                </tr></thead>
                <tbody>
                  {report.problems.map(p => (
                    <tr key={p.filename} className="border-b last:border-0">
                      <td className="py-1.5 pr-3 break-all">{p.filename}</td>
                      <td className="pr-3"><Pill tone={p.integrity_status === "mismatch" || p.integrity_status === "missing" ? "red" : "gray"}>
                        {p.integrity_status ?? "unverified"}</Pill></td>
                      <td className="pr-3 font-mono text-[10px]">{p.sha256 ? `${p.sha256.slice(0, 16)}…` : "–"}</td>
                      <td>{fmt(p.integrity_checked_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-ndap-navy mb-2">Same content under different names</h3>
            {report.duplicates.length === 0 ? <p className="text-sm text-gray-400">None.</p> : (
              <ul className="space-y-1 text-xs">
                {report.duplicates.map(d => (
                  <li key={d.sha256}><span className="font-mono text-[10px] text-gray-400">{d.sha256.slice(0, 12)}…</span> {d.filenames.join(", ")}</li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

"use client";

import { FormEvent, useState } from "react";

type ApiResult = { temporaryPassword?: string; error?: string };

async function request(path: string, options: RequestInit): Promise<ApiResult> {
  try {
    const response = await fetch(path, { ...options, headers: { "content-type": "application/json" } });
    const payload = await response.json().catch(() => undefined) as ApiResult | undefined;
    if (!response.ok) return { error: payload?.error ?? `Request failed (${response.status}).` };
    return payload ?? {};
  } catch {
    return { error: "Unable to complete the request." };
  }
}

export function AdminUserForm() {
  const [temporaryPassword, setTemporaryPassword] = useState<string>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string>();

  async function execute(path: string, options: RequestInit, successMessage?: string) {
    setLoading(true);
    setError(undefined);
    setNotice(undefined);
    setTemporaryPassword(undefined);
    const result = await request(path, options);
    setLoading(false);
    if (result.error) setError(result.error);
    else if (result.temporaryPassword) setTemporaryPassword(result.temporaryPassword);
    else if (successMessage) setNotice(successMessage);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    await execute("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({ firstName: fields.get("firstName"), lastName: fields.get("lastName"), email: fields.get("email"), role: fields.get("role"), ...(fields.get("temporaryPassword") ? { temporaryPassword: fields.get("temporaryPassword") } : {}) }),
    });
  }

  const userId = () => (document.querySelector<HTMLInputElement>("#admin-user-id")?.value ?? "").trim();
  const runForUser = async (path: (id: string) => string, options: RequestInit, successMessage?: string) => {
    const id = userId();
    if (!id) return setError("User ID is required.");
    await execute(path(encodeURIComponent(id)), options, successMessage);
  };

  return <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
    <form className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6" onSubmit={submit}>
      <h2 className="text-lg font-medium">Create or add identity</h2>
      <label className="flex flex-col gap-1 text-sm">First name<input className="rounded border border-zinc-700 bg-zinc-950 p-2" name="firstName" required /></label>
      <label className="flex flex-col gap-1 text-sm">Last name<input className="rounded border border-zinc-700 bg-zinc-950 p-2" name="lastName" required /></label>
      <label className="flex flex-col gap-1 text-sm">Email<input className="rounded border border-zinc-700 bg-zinc-950 p-2" name="email" type="email" required /></label>
      <label className="flex flex-col gap-1 text-sm">Temporary password (optional)<input className="rounded border border-zinc-700 bg-zinc-950 p-2" name="temporaryPassword" type="password" /></label>
      <label className="flex flex-col gap-1 text-sm">Role<select className="rounded border border-zinc-700 bg-zinc-950 p-2" name="role" defaultValue="operator"><option value="operator">Operator</option><option value="admin">Administrator</option></select></label>
      <button className="rounded bg-emerald-500 px-4 py-2 font-medium text-zinc-950 disabled:opacity-60" disabled={loading} type="submit">{loading ? "Saving..." : "Create user"}</button>
    </form>
    <section className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-lg font-medium">Manage membership</h2>
      <label className="flex flex-col gap-1 text-sm">User ID<input className="rounded border border-zinc-700 bg-zinc-950 p-2" id="admin-user-id" /></label>
      <div className="grid grid-cols-2 gap-3">
        <button className="rounded bg-zinc-700 px-3 py-2 disabled:opacity-60" disabled={loading} onClick={() => runForUser((id) => `/api/admin/users/${id}/reset`, { method: "POST" })} type="button">Reset password</button>
        <button className="rounded bg-zinc-700 px-3 py-2 disabled:opacity-60" disabled={loading} onClick={() => runForUser((id) => `/api/admin/users/${id}/membership`, { method: "DELETE" })} type="button">Deactivate membership</button>
        <button className="rounded bg-zinc-700 px-3 py-2 disabled:opacity-60" disabled={loading} onClick={() => runForUser((id) => `/api/admin/users/${id}/membership`, { method: "PATCH", body: JSON.stringify({ status: "active", role: document.querySelector<HTMLSelectElement>("#admin-role")?.value }) }, "Membership reactivated.")} type="button">Reactivate membership</button>
        <button className="rounded bg-zinc-700 px-3 py-2 disabled:opacity-60" disabled={loading} onClick={() => runForUser((id) => `/api/admin/users/${id}/membership`, { method: "PATCH", body: JSON.stringify({ role: document.querySelector<HTMLSelectElement>("#admin-role")?.value }) })} type="button">Change role</button>
      </div>
      <label className="flex flex-col gap-1 text-sm">Role<select className="rounded border border-zinc-700 bg-zinc-950 p-2" defaultValue="operator" id="admin-role"><option value="operator">Operator</option><option value="admin">Administrator</option></select></label>
    </section>
    {temporaryPassword ? <section className="rounded bg-amber-100 p-3 font-mono text-amber-950"><output>{temporaryPassword}</output><button className="ml-3 underline" onClick={() => setTemporaryPassword(undefined)} type="button">Dismiss temporary password</button></section> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
  </div>;
}

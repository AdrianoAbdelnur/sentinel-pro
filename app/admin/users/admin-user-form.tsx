"use client";

import { FormEvent, useState } from "react";

type ApiResult = { temporaryPassword?: string; error?: string };

async function request(path: string, options: RequestInit): Promise<ApiResult> {
  try {
    const response = await fetch(path, { ...options, headers: { "content-type": "application/json" } });
    const payload = await response.json().catch(() => undefined) as ApiResult | undefined;
    if (!response.ok) return { error: payload?.error ?? `La solicitud falló (${response.status}).` };
    return payload ?? {};
  } catch {
    return { error: "No pudimos completar la solicitud." };
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
    if (!id) return setError("El ID de usuario es obligatorio.");
    await execute(path(encodeURIComponent(id)), options, successMessage);
  };

  return <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
    <form className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6" onSubmit={submit}>
      <h2 className="text-lg font-medium">Crear o agregar identidad</h2>
      <label className="flex flex-col gap-1 text-sm">Nombre<input className="rounded border border-zinc-700 bg-zinc-950 p-2" name="firstName" required /></label>
      <label className="flex flex-col gap-1 text-sm">Apellido<input className="rounded border border-zinc-700 bg-zinc-950 p-2" name="lastName" required /></label>
      <label className="flex flex-col gap-1 text-sm">Correo electrónico<input className="rounded border border-zinc-700 bg-zinc-950 p-2" name="email" type="email" required /></label>
      <label className="flex flex-col gap-1 text-sm">Contraseña temporal (opcional)<input className="rounded border border-zinc-700 bg-zinc-950 p-2" name="temporaryPassword" type="password" /></label>
      <label className="flex flex-col gap-1 text-sm">Rol<select className="rounded border border-zinc-700 bg-zinc-950 p-2" name="role" defaultValue="operator"><option value="operator">Operador</option><option value="admin">Administrador</option></select></label>
      <button className="rounded bg-emerald-500 px-4 py-2 font-medium text-zinc-950 disabled:opacity-60" disabled={loading} type="submit">{loading ? "Guardando..." : "Crear usuario"}</button>
    </form>
    <section className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-lg font-medium">Gestionar membresía</h2>
      <label className="flex flex-col gap-1 text-sm">ID de usuario<input className="rounded border border-zinc-700 bg-zinc-950 p-2" id="admin-user-id" /></label>
      <div className="grid grid-cols-2 gap-3">
        <button className="rounded bg-zinc-700 px-3 py-2 disabled:opacity-60" disabled={loading} onClick={() => runForUser((id) => `/api/admin/users/${id}/reset`, { method: "POST" })} type="button">Restablecer contraseña</button>
        <button className="rounded bg-zinc-700 px-3 py-2 disabled:opacity-60" disabled={loading} onClick={() => runForUser((id) => `/api/admin/users/${id}/membership`, { method: "DELETE" })} type="button">Desactivar membresía</button>
        <button className="rounded bg-zinc-700 px-3 py-2 disabled:opacity-60" disabled={loading} onClick={() => runForUser((id) => `/api/admin/users/${id}/membership`, { method: "PATCH", body: JSON.stringify({ status: "active", role: document.querySelector<HTMLSelectElement>("#admin-role")?.value }) }, "Membresía reactivada.")} type="button">Reactivar membresía</button>
        <button className="rounded bg-zinc-700 px-3 py-2 disabled:opacity-60" disabled={loading} onClick={() => runForUser((id) => `/api/admin/users/${id}/membership`, { method: "PATCH", body: JSON.stringify({ role: document.querySelector<HTMLSelectElement>("#admin-role")?.value }) })} type="button">Cambiar rol</button>
      </div>
      <label className="flex flex-col gap-1 text-sm">Rol<select className="rounded border border-zinc-700 bg-zinc-950 p-2" defaultValue="operator" id="admin-role"><option value="operator">Operador</option><option value="admin">Administrador</option></select></label>
    </section>
    {temporaryPassword ? <section className="rounded bg-amber-100 p-3 font-mono text-amber-950"><output>{temporaryPassword}</output><button className="ml-3 underline" onClick={() => setTemporaryPassword(undefined)} type="button">Ocultar contraseña temporal</button></section> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
  </div>;
}

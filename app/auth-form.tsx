"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AuthFormProps = { endpoint: string; fields: "login" | "password" | "organization"; submitLabel: string };

export default function AuthForm({ endpoint, fields, submitLabel }: AuthFormProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  async function submit(formData: FormData) {
    setError("");
    const payload = Object.fromEntries(formData);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result: unknown = await response.json().catch(() => undefined);
      const error = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string" ? result.error : "No pudimos continuar. Intentá nuevamente.";
      if (!response.ok) return setError(error);
      const next = typeof result === "object" && result !== null && "next" in result && typeof result.next === "string" ? result.next : undefined;
      if (!next) return setError("No pudimos continuar. Intentá nuevamente.");
      router.push(next);
    } catch {
      setError("No pudimos continuar. Intentá nuevamente.");
    }
  }
  return <form action={submit} className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-100">
    {fields === "login" && <label className="flex flex-col gap-1 text-sm">Correo electrónico<input name="email" type="email" className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2" required /></label>}
    {fields !== "organization" && <label className="flex flex-col gap-1 text-sm">{fields === "password" ? "Nueva contraseña" : "Contraseña"}<input name="password" type="password" className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2" required /></label>}
    {fields === "organization" && <label className="flex flex-col gap-1 text-sm">ID de organización<input name="organizationId" className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2" required /></label>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    <button type="submit" className="rounded bg-emerald-500 px-4 py-2 font-medium text-zinc-950">{submitLabel}</button>
  </form>;
}

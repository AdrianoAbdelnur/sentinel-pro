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
    const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) return setError(result.error ?? "Unable to continue.");
    router.push(result.next);
  }
  return <form action={submit} className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-100">
    {fields === "login" && <label className="flex flex-col gap-1 text-sm">Email<input name="email" type="email" className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2" required /></label>}
    {fields !== "organization" && <label className="flex flex-col gap-1 text-sm">{fields === "password" ? "New password" : "Password"}<input name="password" type="password" className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2" required /></label>}
    {fields === "organization" && <label className="flex flex-col gap-1 text-sm">Organization ID<input name="organizationId" className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2" required /></label>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    <button type="submit" className="rounded bg-emerald-500 px-4 py-2 font-medium text-zinc-950">{submitLabel}</button>
  </form>;
}

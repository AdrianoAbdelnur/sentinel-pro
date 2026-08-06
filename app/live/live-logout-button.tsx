"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LiveLogoutButton() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function logout() {
    setError("");
    setIsPending(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error();
      router.replace("/login");
    } catch {
      setError("No pudimos cerrar la sesión. Intentá nuevamente.");
      setIsPending(false);
    }
  }

  return <div className="ml-auto flex items-center gap-3"><button className="rounded border border-slate-700 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-200 transition hover:border-teal-400 hover:text-teal-300 disabled:cursor-not-allowed disabled:opacity-60" disabled={isPending} onClick={logout} type="button">{isPending ? "Cerrando sesión..." : "Cerrar sesión"}</button>{error ? <p className="text-xs text-red-300" role="alert">{error}</p> : null}</div>;
}

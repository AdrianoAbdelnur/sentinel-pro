import { AdminUserForm } from "./admin-user-form";
import { requirePageAuthorization } from "@/app/require-page-authorization";

export default async function AdminUsersPage() {
  await requirePageAuthorization("admin");

  return <main className="min-h-screen bg-zinc-950 p-6 text-zinc-50"><h1 className="mx-auto mb-6 w-full max-w-lg text-2xl font-semibold">Usuarios</h1><AdminUserForm /></main>;
}

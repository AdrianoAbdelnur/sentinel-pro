import { CatalogAdminScreen } from "./catalog-admin-screen";
import { requirePageAuthorization } from "@/app/require-page-authorization";

export default async function CatalogAdminPage() {
  await requirePageAuthorization("admin");

  return <main className="min-h-screen bg-zinc-950 p-6 text-zinc-50"><h1 className="mx-auto mb-6 w-full max-w-2xl text-2xl font-semibold">Catálogo</h1><CatalogAdminScreen /></main>;
}

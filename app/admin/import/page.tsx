import { ProviderImportScreen } from "./provider-import-screen";
import { requirePageAuthorization } from "@/app/require-page-authorization";

export default async function ProviderImportPage() {
  await requirePageAuthorization("admin");
  return <main className="min-h-screen bg-zinc-950 p-6 text-zinc-50"><div className="mx-auto w-full max-w-2xl"><h1 className="mb-2 text-2xl font-semibold">Importar plataformas</h1><p className="mb-6 text-sm text-zinc-400">Traé empresas, flotas y vehículos a Sentinel.</p><ProviderImportScreen /></div></main>;
}

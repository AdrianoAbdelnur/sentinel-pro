import { requirePageAuthorization } from "@/app/require-page-authorization";
import { PendingReviewsPanel } from "@/app/admin/catalog/pending-reviews-panel";

export default async function CatalogReviewPage() {
  await requirePageAuthorization("admin");

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-50">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
        <h1 className="text-2xl font-semibold">Revisiones pendientes</h1>
        <p className="mb-4 text-sm text-zinc-400">Resolvé los vehículos y flotas que no pudieron vincularse automáticamente.</p>
        <PendingReviewsPanel autoLoad />
      </div>
    </main>
  );
}

import { ConnectionSyncPanel } from "./connection-sync-panel";
import { PendingReviewsPanel } from "./pending-reviews-panel";

export function CatalogAdminScreen() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-lg font-medium">Sincronización de conexión</h2>
        <ConnectionSyncPanel />
      </section>
      <section className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-lg font-medium">Revisiones pendientes</h2>
        <PendingReviewsPanel />
      </section>
    </div>
  );
}

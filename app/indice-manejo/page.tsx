import { requirePageAuthorization } from "@/app/require-page-authorization";

import { DrivingIndexScreen } from "./driving-index-screen";

export default async function DrivingIndexPage() {
  await requirePageAuthorization("operator");

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-50">
      <div className="mx-auto w-full max-w-4xl">
        <h1 className="mb-2 text-2xl font-semibold">Índice de manejo</h1>
        <p className="mb-6 text-sm text-zinc-400">
          Subí la planilla de viajes y cargá los kilómetros del período para armar el reporte.
        </p>
        <DrivingIndexScreen />
      </div>
    </main>
  );
}

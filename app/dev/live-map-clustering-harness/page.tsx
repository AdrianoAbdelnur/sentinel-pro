import { notFound } from "next/navigation";

import { LiveMapClusteringHarness } from "@/components/live/live-map-clustering-harness";

export default function LiveMapClusteringHarnessPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <LiveMapClusteringHarness />;
}

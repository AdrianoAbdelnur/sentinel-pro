import { useState } from "react";

import type { LiveStatusFilter } from "@/application/live";

// Search, status and provider are one concern -- narrowing the visible roster --
// so they share a hook. Selection, expansion and the active bottom-panel tab are
// separate concerns and stay in live-screen.tsx.

export type LiveSidebarFilters = {
  searchTerm: string;
  status: LiveStatusFilter;
  provider?: string;
};

export type UseLiveSidebarFiltersResult = LiveSidebarFilters & {
  setSearchTerm: (term: string) => void;
  // Scalar: this replaces the current status, it never adds to a set.
  setStatus: (status: LiveStatusFilter) => void;
  setProvider: (provider: string | undefined) => void;
};

export function useLiveSidebarFilters(): UseLiveSidebarFiltersResult {
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState<LiveStatusFilter>("all");
  const [provider, setProvider] = useState<string | undefined>(undefined);

  return {
    searchTerm,
    status,
    provider,
    setSearchTerm,
    setStatus,
    setProvider,
  };
}

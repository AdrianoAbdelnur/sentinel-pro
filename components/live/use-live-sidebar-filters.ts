import { useState } from "react";

import type { LiveStatusFilter } from "@/application/live";

export type LiveSidebarFilters = {
  searchTerm: string;
  status: LiveStatusFilter;
  provider?: string;
};

export type UseLiveSidebarFiltersResult = LiveSidebarFilters & {
  setSearchTerm: (term: string) => void;
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

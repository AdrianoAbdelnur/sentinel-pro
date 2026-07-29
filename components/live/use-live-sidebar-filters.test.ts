import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useLiveSidebarFilters } from "./use-live-sidebar-filters";

describe("useLiveSidebarFilters", () => {
  it("starts with no narrowing applied", () => {
    const { result } = renderHook(() => useLiveSidebarFilters());

    expect(result.current.searchTerm).toBe("");
    expect(result.current.status).toBe("all");
    expect(result.current.provider).toBeUndefined();
  });

  it("updates the search term", () => {
    const { result } = renderHook(() => useLiveSidebarFilters());

    act(() => result.current.setSearchTerm("unit 101"));

    expect(result.current.searchTerm).toBe("unit 101");
  });

  it("replaces the active status filter on every call (scalar, not a set)", () => {
    const { result } = renderHook(() => useLiveSidebarFilters());

    act(() => result.current.setStatus("en-route"));
    expect(result.current.status).toBe("en-route");

    act(() => result.current.setStatus("stopped"));
    expect(result.current.status).toBe("stopped");
  });

  it("returns the status filter to all", () => {
    const { result } = renderHook(() => useLiveSidebarFilters());

    act(() => result.current.setStatus("offline"));
    act(() => result.current.setStatus("all"));

    expect(result.current.status).toBe("all");
  });

  it("sets and clears the provider filter", () => {
    const { result } = renderHook(() => useLiveSidebarFilters());

    act(() => result.current.setProvider("howen"));
    expect(result.current.provider).toBe("howen");

    act(() => result.current.setProvider(undefined));
    expect(result.current.provider).toBeUndefined();
  });

  it("keeps the three narrowing concerns independent of each other", () => {
    const { result } = renderHook(() => useLiveSidebarFilters());

    act(() => {
      result.current.setSearchTerm("unit 101");
      result.current.setStatus("en-route");
      result.current.setProvider("howen");
    });

    expect(result.current.searchTerm).toBe("unit 101");
    expect(result.current.status).toBe("en-route");
    expect(result.current.provider).toBe("howen");
  });
});

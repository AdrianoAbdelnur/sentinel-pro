import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import {
  ALL_PROVIDERS_LABEL,
  ALL_PROVIDERS_VALUE,
  LiveProviderFilter,
} from "./live-provider-filter";

describe("LiveProviderFilter", () => {
  it("renders an option for every available provider plus an all-providers option", () => {
    render(
      <LiveProviderFilter
        provider={undefined}
        availableProviders={["howen", "praxsys"]}
        onProviderChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("option", { name: ALL_PROVIDERS_LABEL }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "HOWEN" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "PRAXSYS" })).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("selects the all-providers option when no provider is active", () => {
    render(
      <LiveProviderFilter
        provider={undefined}
        availableProviders={["howen"]}
        onProviderChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox")).toHaveDisplayValue(
      ALL_PROVIDERS_LABEL,
    );
  });

  it("selects the active provider", () => {
    render(
      <LiveProviderFilter
        provider="howen"
        availableProviders={["howen", "praxsys"]}
        onProviderChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox")).toHaveDisplayValue("HOWEN");
  });

  it("reports undefined when the operator picks the all-providers option", () => {
    const onProviderChange = vi.fn();
    render(
      <LiveProviderFilter
        provider="howen"
        availableProviders={["howen"]}
        onProviderChange={onProviderChange}
      />,
    );

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: ALL_PROVIDERS_VALUE },
    });

    expect(onProviderChange).toHaveBeenCalledWith(undefined);
  });

  it("reports the selected provider verbatim, not uppercased", () => {
    const onProviderChange = vi.fn();
    render(
      <LiveProviderFilter
        provider={undefined}
        availableProviders={["howen", "praxsys"]}
        onProviderChange={onProviderChange}
      />,
    );

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "praxsys" },
    });

    expect(onProviderChange).toHaveBeenCalledWith("praxsys");
  });

  it("never renders an undefined option for a vehicle with no provider", () => {
    render(
      <LiveProviderFilter
        provider={undefined}
        availableProviders={["howen"]}
        onProviderChange={vi.fn()}
      />,
    );

    for (const option of screen.getAllByRole("option")) {
      expect(option.textContent?.trim().length).toBeGreaterThan(0);
    }
  });
});

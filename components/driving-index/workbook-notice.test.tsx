import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WorkbookNotice } from "./workbook-notice";

describe("WorkbookNotice", () => {
  it("renders an aria-live polite status region for each known failure code", () => {
    const codes = ["unreadable-file", "missing-plate-column", "no-usable-rows"] as const;

    for (const code of codes) {
      const { unmount } = render(<WorkbookNotice code={code} />);
      const region = screen.getByRole("status");
      expect(region).toHaveAttribute("aria-live", "polite");
      unmount();
    }
  });

  it("shows distinct, readable Spanish copy for an unreadable file", () => {
    render(<WorkbookNotice code="unreadable-file" />);

    expect(screen.getByText(/no se pudo leer el archivo/i)).toBeInTheDocument();
  });

  it("shows distinct, readable Spanish copy for a missing Dominio column", () => {
    render(<WorkbookNotice code="missing-plate-column" />);

    expect(screen.getByText(/columna.*dominio/i)).toBeInTheDocument();
  });

  it("shows distinct, readable Spanish copy for zero usable rows", () => {
    render(<WorkbookNotice code="no-usable-rows" />);

    expect(screen.getByText(/no se encontraron vehículos/i)).toBeInTheDocument();
  });

  it("renders three distinct messages across the three failure codes", () => {
    const renderNotice = (code: "unreadable-file" | "missing-plate-column" | "no-usable-rows") => {
      const { unmount } = render(<WorkbookNotice code={code} />);
      const text = screen.getByRole("status").textContent;
      unmount();
      return text;
    };

    const unreadable = renderNotice("unreadable-file");
    const missingColumn = renderNotice("missing-plate-column");
    const noRows = renderNotice("no-usable-rows");

    expect(new Set([unreadable, missingColumn, noRows]).size).toBe(3);
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LiveSourceWarnings } from "./live-source-warnings";

describe("LiveSourceWarnings", () => {
  it("renders a generic operator warning for a failed source", () => {
    render(
      <LiveSourceWarnings
        warnings={[
          {
            code: "source-unavailable",
            sourceId: "howen",
            sourceLabel: "HOWEN",
          },
        ]}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "No se pudo obtener la información de HOWEN.",
    );
    expect(screen.queryByText(/10023|token|JSESSIONID/i)).not.toBeInTheDocument();
  });

  it("renders every unavailable source without provider-specific behavior", () => {
    render(
      <LiveSourceWarnings
        warnings={[
          {
            code: "source-unavailable",
            sourceId: "howen",
            sourceLabel: "HOWEN",
          },
          {
            code: "source-unavailable",
            sourceId: "praxsys",
            sourceLabel: "PRAXSYS",
          },
        ]}
      />,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText(/HOWEN/)).toBeInTheDocument();
    expect(screen.getByText(/PRAXSYS/)).toBeInTheDocument();
  });

  it("renders no status region when every source is available", () => {
    const { container } = render(<LiveSourceWarnings warnings={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});

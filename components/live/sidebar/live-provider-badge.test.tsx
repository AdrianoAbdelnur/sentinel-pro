import { render, screen } from "@testing-library/react";

import { LiveProviderBadge } from "./live-provider-badge";

describe("LiveProviderBadge", () => {
  it("renders the provider verbatim (case preserved in the DOM; CSS applies the uppercase look)", () => {
    render(<LiveProviderBadge provider="howen" />);

    expect(screen.getByText("howen")).toBeInTheDocument();
  });

  it("renders nothing for a vehicle with no device/provider", () => {
    const { container } = render(<LiveProviderBadge provider={undefined} />);

    expect(container).toBeEmptyDOMElement();
  });
});

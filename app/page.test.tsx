import { render, screen } from "@testing-library/react";

import Home from "./page";

describe("Home page", () => {
  it("shows the project foundation message", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        name: /greenfield foundation ready for gentle ai, sdd, and tdd/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/openspec initialized for sdd-driven changes/i),
    ).toBeInTheDocument();
  });
});

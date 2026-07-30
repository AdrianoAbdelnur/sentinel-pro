import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { vi } from "vitest";

import { LiveMapClusteringHarness } from "./live-map-clustering-harness";

const animationFrames: FrameRequestCallback[] = [];

beforeEach(() => {
  animationFrames.length = 0;
  window.history.replaceState({}, "", "/");
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => {
    now += 1;
    return now;
  });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    animationFrames.push(callback);
    return animationFrames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("LiveMapClusteringHarness", () => {
  it("reports the deterministic workload before an animation frame", async () => {
    render(<LiveMapClusteringHarness />);

    expect(screen.getByTestId("harness-point-count")).toHaveTextContent("621");
    await waitForBenchmark();
    expect(screen.getByTestId("harness-long-tasks")).toHaveTextContent("0");
    expect(screen.getByTestId("harness-heartbeat")).toHaveTextContent("0");
  });

  it("keeps heartbeat and click feedback responsive on animation frames", async () => {
    render(<LiveMapClusteringHarness />);
    await waitForBenchmark();

    fireEvent.click(screen.getByRole("button", { name: "Test control" }));
    expect(screen.getByTestId("harness-click-count")).toHaveTextContent("1");

    act(() => {
      animationFrames.shift()?.(16);
    });

    expect(screen.getByTestId("harness-heartbeat")).toHaveTextContent("1");
    expect(screen.getByTestId("harness-click-feedback")).toHaveTextContent(
      "next frame",
    );
    expect(screen.getByTestId("harness-gate-status")).toHaveTextContent(
      "WAITING",
    );
  });

  it("exercises cluster expansion, maximum-zoom fan, collapse, and resize", async () => {
    render(<LiveMapClusteringHarness />);
    await waitForBenchmark();

    fireEvent.click(screen.getByRole("button", { name: "Test control" }));
    act(() => {
      animationFrames.shift()?.(16);
    });
    fireEvent.click(screen.getByRole("button", { name: "Expand cluster" }));
    expect(screen.getByTestId("harness-mode")).toHaveTextContent("expanded");

    fireEvent.click(screen.getByRole("button", { name: "Fan overlaps" }));
    expect(screen.getByTestId("harness-mode")).toHaveTextContent("fan");
    expect(screen.getAllByTestId("harness-fan-member")).toHaveLength(9);

    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
    expect(screen.getByTestId("harness-mode")).toHaveTextContent("collapsed");

    fireEvent.click(screen.getByRole("button", { name: "Resize surface" }));
    expect(screen.getByTestId("harness-resize-count")).toHaveTextContent("1");
    expect(screen.getByTestId("harness-gate-status")).toHaveTextContent("PASS");
  });

  it("runs every real control handler across frames only when autorun is requested", async () => {
    window.history.replaceState({}, "", "/?autorun=1");
    render(<LiveMapClusteringHarness />);
    await waitForBenchmark();

    runAnimationFrames(14);

    expect(screen.getByTestId("harness-click-count")).toHaveTextContent("1");
    expect(screen.getByTestId("harness-resize-count")).toHaveTextContent("1");
    expect(screen.getByTestId("harness-mode")).toHaveTextContent("collapsed");
    expect(screen.getByTestId("harness-exercised-checks")).toHaveTextContent(
      "5/5",
    );
    expect(screen.getByTestId("harness-gate-status")).toHaveTextContent("PASS");
  });

  it("leaves the manual harness untouched without the autorun query", async () => {
    render(<LiveMapClusteringHarness />);
    await waitForBenchmark();

    runAnimationFrames(14);

    expect(screen.getByTestId("harness-click-count")).toHaveTextContent("0");
    expect(screen.getByTestId("harness-resize-count")).toHaveTextContent("0");
    expect(screen.getByTestId("harness-mode")).toHaveTextContent("collapsed");
    expect(screen.getByTestId("harness-exercised-checks")).toHaveTextContent(
      "0/5",
    );
    expect(screen.getByTestId("harness-gate-status")).toHaveTextContent(
      "WAITING",
    );
  });
});

function runNextAnimationFrame() {
  act(() => {
    animationFrames.shift()?.(16);
  });
}

function runAnimationFrames(count: number) {
  for (let frame = 0; frame < count; frame += 1) {
    runNextAnimationFrame();
  }
}

async function waitForBenchmark() {
  await waitFor(() => {
    expect(screen.getByTestId("harness-build-time")).toHaveTextContent("ms");
    expect(screen.getByTestId("harness-query-p95")).toHaveTextContent("ms");
  });
}

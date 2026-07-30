"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react";

import {
  buildLiveMapClusterIndex,
  getLiveMapClusterExpansionZoom,
  getLiveMapClusterLeaves,
  queryLiveMapClusters,
  type LiveMapBounds,
  type LiveMapClusterEntry,
} from "./live-map-clustering";
import {
  buildLiveMapClusteringHarnessPoints,
  LIVE_MAP_HARNESS_POINT_COUNT,
} from "./live-map-clustering-harness-data";
import { buildDeterministicOverlapLayout } from "./live-map-overlap-layout";

const WORLD_BOUNDS: LiveMapBounds = [-74, -55, -50, -21];
const OVERLAP_BOUNDS: LiveMapBounds = [-65.424, -24.783, -65.422, -24.781];
const QUERY_RUN_COUNT = 120;
const MAX_ZOOM = 18;
const BUILD_LIMIT_MS = 50;
const QUERY_P95_LIMIT_MS = 16;

type HarnessMode = "collapsed" | "expanded" | "fan";
type HarnessAction =
  | "collapse"
  | "control"
  | "expand"
  | "fan"
  | "resize";

type HarnessBenchmark = {
  readonly buildMs: number;
  readonly queryP95Ms: number;
  readonly clusteringLongTasks: number;
};

export function LiveMapClusteringHarness() {
  const points = useMemo(() => buildLiveMapClusteringHarnessPoints(), []);
  const index = useMemo(() => buildLiveMapClusterIndex(points), [points]);
  const [benchmark, setBenchmark] = useState<HarnessBenchmark | null>(null);
  const [mode, setMode] = useState<HarnessMode>("collapsed");
  const [zoom, setZoom] = useState(4);
  const [clickCount, setClickCount] = useState(0);
  const [clickFeedback, setClickFeedback] = useState("waiting");
  const [resizeCount, setResizeCount] = useState(0);
  const [compact, setCompact] = useState(false);
  const [exercised, setExercised] = useState({
    click: false,
    collapse: false,
    expansion: false,
    fan: false,
    resize: false,
  });
  const pendingClickFeedback = useRef(false);
  const heartbeatCount = useRef(0);
  const heartbeatOutput = useRef<HTMLSpanElement>(null);
  const harnessRoot = useRef<HTMLElement>(null);

  useEffect(() => {
    const nextBenchmark = runHarnessBenchmark(points);
    let active = true;
    queueMicrotask(() => {
      if (active) {
        setBenchmark(nextBenchmark);
      }
    });

    return () => {
      active = false;
    };
  }, [points]);

  useEffect(() => {
    let frameId = 0;
    const tick = () => {
      heartbeatCount.current += 1;
      if (heartbeatOutput.current) {
        heartbeatOutput.current.textContent = String(heartbeatCount.current);
      }
      if (pendingClickFeedback.current) {
        pendingClickFeedback.current = false;
        setClickFeedback("next frame");
        setExercised((current) => ({ ...current, click: true }));
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("autorun") !== "1") {
      return;
    }

    const steps: Array<{
      action: HarnessAction;
      ready: () => boolean;
    }> = [
      { action: "control", ready: () => true },
      {
        action: "expand",
        ready: () => readHarnessText(harnessRoot.current, "harness-click-feedback") === "next frame",
      },
      {
        action: "fan",
        ready: () => readHarnessText(harnessRoot.current, "harness-mode") === "expanded",
      },
      {
        action: "collapse",
        ready: () =>
          harnessRoot.current?.querySelectorAll(
            '[data-testid="harness-fan-member"]',
          ).length === 9,
      },
      {
        action: "resize",
        ready: () => readHarnessText(harnessRoot.current, "harness-mode") === "collapsed",
      },
    ];
    let stepIndex = 0;
    let frameId = 0;
    const runStep = () => {
      const step = steps[stepIndex];
      if (!step) {
        return;
      }

      if (step.ready()) {
        harnessRoot.current
          ?.querySelector<HTMLButtonElement>(
            `[data-harness-action="${step.action}"]`,
          )
          ?.click();
        stepIndex += 1;
      }

      frameId = requestAnimationFrame(runStep);
    };

    frameId = requestAnimationFrame(runStep);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const visibleEntries = useMemo(
    () => queryLiveMapClusters(index, WORLD_BOUNDS, zoom),
    [index, zoom],
  );
  const fanMembers = useMemo(() => {
    if (mode !== "fan") {
      return [];
    }

    const overlapCluster = queryLiveMapClusters(
      index,
      OVERLAP_BOUNDS,
      MAX_ZOOM,
    ).find(
      (entry): entry is Extract<LiveMapClusterEntry, { kind: "cluster" }> =>
        entry.kind === "cluster" && entry.count === 9,
    );
    if (!overlapCluster) {
      return [];
    }

    const leaves = getLiveMapClusterLeaves(index, overlapCluster.clusterId);
    const offsets = buildDeterministicOverlapLayout(
      leaves.map(({ vehicleId }) => vehicleId),
    );

    return offsets.map((offset) => ({
      ...offset,
      sourceLatitude: leaves[0].latitude,
      sourceLongitude: leaves[0].longitude,
    }));
  }, [index, mode]);
  const gatePasses =
    benchmark !== null &&
    benchmark.buildMs < BUILD_LIMIT_MS &&
    benchmark.queryP95Ms < QUERY_P95_LIMIT_MS &&
    benchmark.clusteringLongTasks === 0 &&
    Object.values(exercised).every(Boolean);

  function expandCluster() {
    const cluster = visibleEntries.find(
      (entry): entry is Extract<LiveMapClusterEntry, { kind: "cluster" }> =>
        entry.kind === "cluster",
    );

    if (cluster) {
      setZoom(getLiveMapClusterExpansionZoom(index, cluster.clusterId));
    }
    setMode("expanded");
    setExercised((current) => ({ ...current, expansion: true }));
  }

  function testControl() {
    setClickCount((current) => current + 1);
    pendingClickFeedback.current = true;
    setClickFeedback("pending");
  }

  function resizeSurface() {
    setCompact((current) => !current);
    setResizeCount((current) => current + 1);
    setExercised((current) => ({ ...current, resize: true }));
  }

  return (
    <main
      ref={harnessRoot}
      className="min-h-screen overflow-auto bg-slate-950 p-6 text-slate-100"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-cyan-300">
            Development browser gate
          </p>
          <h1 className="mt-2 text-2xl font-semibold">
            Live map clustering harness
          </h1>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Points" testId="harness-point-count">
            {LIVE_MAP_HARNESS_POINT_COUNT}
          </Metric>
          <Metric label="Index build" testId="harness-build-time">
            {benchmark ? formatMilliseconds(benchmark.buildMs) : "measuring"}
          </Metric>
          <Metric label="Query p95" testId="harness-query-p95">
            {benchmark
              ? formatMilliseconds(benchmark.queryP95Ms)
              : "measuring"}
          </Metric>
          <Metric label="Clustering long tasks" testId="harness-long-tasks">
            {benchmark?.clusteringLongTasks ?? "measuring"}
          </Metric>
        </section>

        <section className="flex flex-wrap gap-2">
          <HarnessButton action="control" onClick={testControl}>
            Test control
          </HarnessButton>
          <HarnessButton action="expand" onClick={expandCluster}>
            Expand cluster
          </HarnessButton>
          <HarnessButton
            action="fan"
            onClick={() => {
              setZoom(MAX_ZOOM);
              setMode("fan");
              setExercised((current) => ({ ...current, fan: true }));
            }}
          >
            Fan overlaps
          </HarnessButton>
          <HarnessButton
            action="collapse"
            onClick={() => {
              setZoom(4);
              setMode("collapsed");
              setExercised((current) => ({ ...current, collapse: true }));
            }}
          >
            Collapse
          </HarnessButton>
          <HarnessButton action="resize" onClick={resizeSurface}>
            Resize surface
          </HarnessButton>
        </section>

        <section className="grid gap-3 font-mono text-sm sm:grid-cols-3">
          <Status label="Mode" testId="harness-mode" value={mode} />
          <Status
            label="Heartbeat"
            testId="harness-heartbeat"
            value="0"
            outputRef={heartbeatOutput}
          />
          <Status
            label="Click count"
            testId="harness-click-count"
            value={String(clickCount)}
          />
          <Status
            label="Click feedback"
            testId="harness-click-feedback"
            value={clickFeedback}
          />
          <Status
            label="Resize count"
            testId="harness-resize-count"
            value={String(resizeCount)}
          />
          <Status
            label="Automatic gate"
            testId="harness-gate-status"
            value={gatePasses ? "PASS" : "WAITING"}
          />
          <Status
            label="Exercised checks"
            testId="harness-exercised-checks"
            value={`${Object.values(exercised).filter(Boolean).length}/5`}
          />
        </section>

        <section
          data-testid="harness-surface"
          className={
            compact
              ? "h-96 w-3/4 overflow-hidden rounded-xl border border-cyan-500/40 bg-slate-900"
              : "h-96 w-full overflow-hidden rounded-xl border border-cyan-500/40 bg-slate-900"
          }
        >
          <svg
            aria-label="Synthetic clustering surface"
            className="h-full w-full"
            viewBox="0 0 1000 500"
          >
            {mode === "fan"
              ? fanMembers.map((member) => (
                  <g
                    key={member.vehicleId}
                    data-testid="harness-fan-member"
                  >
                    <line
                      x1="500"
                      y1="250"
                      x2={500 + member.offsetX}
                      y2={250 + member.offsetY}
                      stroke="rgb(34 211 238)"
                      strokeOpacity="0.45"
                    />
                    <circle
                      cx={500 + member.offsetX}
                      cy={250 + member.offsetY}
                      r="8"
                      fill="rgb(8 47 73)"
                      stroke="rgb(103 232 249)"
                      strokeWidth="2"
                    />
                  </g>
                ))
              : visibleEntries.map((entry, indexEntry) => (
                  <g key={entryKey(entry)}>
                    <circle
                      cx={30 + ((indexEntry * 83) % 940)}
                      cy={30 + ((indexEntry * 47) % 440)}
                      r={entry.kind === "cluster" ? 14 : 5}
                      fill={
                        entry.kind === "cluster"
                          ? "rgb(8 47 73)"
                          : "rgb(34 211 238)"
                      }
                      stroke="rgb(103 232 249)"
                      strokeWidth="2"
                    />
                    {entry.kind === "cluster" ? (
                      <text
                        x={30 + ((indexEntry * 83) % 940)}
                        y={34 + ((indexEntry * 47) % 440)}
                        fill="white"
                        fontSize="10"
                        textAnchor="middle"
                      >
                        {entry.count}
                      </text>
                    ) : null}
                  </g>
                ))}
          </svg>
        </section>
      </div>
    </main>
  );
}

function Metric({
  children,
  label,
  testId,
}: {
  readonly children: React.ReactNode;
  readonly label: string;
  readonly testId: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
      <p
        className="mt-2 font-mono text-xl text-cyan-200"
        data-testid={testId}
      >
        {children}
      </p>
    </div>
  );
}

function Status({
  label,
  outputRef,
  testId,
  value,
}: {
  readonly label: string;
  readonly outputRef?: Ref<HTMLSpanElement>;
  readonly testId: string;
  readonly value: string;
}) {
  return (
    <p className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2">
      <span className="text-slate-500">{label}: </span>
      <span
        ref={outputRef}
        data-testid={testId}
        className="text-cyan-200"
      >
        {value}
      </span>
    </p>
  );
}

function HarnessButton({
  action,
  children,
  onClick,
}: {
  readonly action: HarnessAction;
  readonly children: React.ReactNode;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-harness-action={action}
      onClick={onClick}
      className="rounded-md border border-cyan-400/60 bg-cyan-950 px-4 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
    >
      {children}
    </button>
  );
}

function entryKey(entry: LiveMapClusterEntry): string {
  return entry.kind === "cluster"
    ? `cluster-${entry.clusterId}`
    : `point-${entry.vehicleId}`;
}

function formatMilliseconds(value: number): string {
  return `${value.toFixed(2)} ms`;
}

function runHarnessBenchmark(
  points: ReturnType<typeof buildLiveMapClusteringHarnessPoints>,
): HarnessBenchmark {
  const buildStartedAt = performance.now();
  const index = buildLiveMapClusterIndex(points);
  const buildMs = performance.now() - buildStartedAt;
  const queryDurations = Array.from({ length: QUERY_RUN_COUNT }, (_, run) => {
    const queryStartedAt = performance.now();
    queryLiveMapClusters(index, WORLD_BOUNDS, 3 + (run % 10));
    return performance.now() - queryStartedAt;
  }).sort((left, right) => left - right);
  const queryP95Ms =
    queryDurations[Math.ceil(queryDurations.length * 0.95) - 1] ?? 0;

  return {
    buildMs,
    queryP95Ms,
    clusteringLongTasks: [buildMs, ...queryDurations].filter(
      (duration) => duration >= BUILD_LIMIT_MS,
    ).length,
  };
}

function readHarnessText(
  root: HTMLElement | null,
  testId: string,
): string | undefined {
  return (
    root
      ?.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
      ?.textContent?.trim() || undefined
  );
}

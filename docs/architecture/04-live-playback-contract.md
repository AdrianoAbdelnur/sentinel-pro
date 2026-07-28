# Live Playback Contract

## Goal

Define the provider-agnostic playback model that the UI can render without learning provider implementation details.

## Contracts

```ts
type LiveMonitor = {
  gridSize: 4 | 9 | 16;
  tiles: LiveTile[];
};

type LiveTileRenderer = "iframe" | "hls" | "flv" | "webrtc";
type LiveTileStatus = "ready" | "starting" | "offline" | "error";

type LiveTile = {
  id: string;
  deviceId: string;
  provider: string;
  channel: number;
  renderer: LiveTileRenderer;
  sourceUrl: string;
  status: LiveTileStatus;
  label?: string;
  error?: {
    code: string;
    message: string;
  };
};
```

## Rules

- One tile equals one playable video.
- The playback grid is global.
- Providers may contribute one or many tiles.
- The UI may branch on `renderer` and `status`.
- The UI MUST NOT branch on `provider`.

## Integration responsibility

Integrations resolve:

- how many playable tiles a device contributes
- which renderer is required
- the final `sourceUrl`
- provider-specific error translation

## Application responsibility

Application resolves:

- flattening provider output into one `LiveMonitor`
- deduplicating already-open playback items
- returning functional notices for unavailable live playback

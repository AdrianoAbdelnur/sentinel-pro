export type LiveTileRenderer = "iframe" | "hls" | "flv" | "webrtc";
export type LiveTileStatus = "ready" | "starting" | "offline" | "error";

export type LiveTile = {
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

export type LiveMonitor = {
  gridSize: 4 | 9 | 16;
  tiles: LiveTile[];
};

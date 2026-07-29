import type {
  LiveBottomPanelEmptyStateCode,
  LiveBottomPanelTab,
  LiveMapEmptyStateCode,
  LivePlaybackNoticeCode,
  VehicleStatus,
} from "@/application/live";

export const MAP_EMPTY_STATE_COPY: Record<LiveMapEmptyStateCode, string> = {
  "no-selection": "Seleccione al menos un vehículo para verlo en el mapa.",
  "no-mappable-selection":
    "Los vehículos seleccionados no tienen coordenadas GPS válidas.",
};

export const BOTTOM_PANEL_EMPTY_STATE_COPY: Record<
  LiveBottomPanelEmptyStateCode,
  string
> = {
  "no-selection": "Seleccione al menos un vehículo para ver sus datos.",
};

export const PLAYBACK_NOTICE_COPY: Record<LivePlaybackNoticeCode, string> = {
  "vehicle-offline": "Vehículo offline. No hay transmisión en vivo disponible.",
  "vehicle-no-video": "El vehículo no tiene video en vivo disponible.",
};

export const VEHICLE_STATUS_COPY: Record<VehicleStatus, string> = {
  "en-route": "En ruta",
  stopped: "Detenido",
  offline: "Offline",
};

export const BOTTOM_PANEL_TAB_COPY: Record<LiveBottomPanelTab["key"], string> = {
  status: "Estado",
  event: "Evento",
  normalAlarm: "Alarmas",
  aiAlarm: "Alarmas IA",
  driverSwipe: "Conductor",
};

export const BOTTOM_PANEL_COLUMN_COPY: Record<string, string> = {
  speed: "Velocidad (km/h)",
  ignition: "Ignición",
  network: "Red",
  lastEvent: "Último evento",
  occurredAt: "Ocurrido a las",
  alarm: "Alarma",
  severity: "Severidad",
  confidence: "Confianza",
  driver: "Conductor",
  swipedAt: "Marcado a las",
};

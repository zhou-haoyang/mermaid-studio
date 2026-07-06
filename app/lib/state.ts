// App state: the reducer, localStorage persistence, and the shareable snapshot.

import { useEffect, useState } from "react";
import {
  DEFAULT_SECURE,
  DEFAULT_VISUAL,
  parseConfigIntoVisual,
  parseRawConfig,
  serializeConfig,
  type SecureConfig,
  type VisualConfig,
} from "./config";
import { DEFAULT_TEMPLATE_CODE } from "./templates";

export type AppTheme = "light" | "dark" | "system";
export type ExportScale = 1 | 2 | 3;

export interface UiState {
  appTheme: AppTheme;
  configOpen: boolean;
  /** Editor pane width as a fraction of the split (0.2–0.8). */
  splitFraction: number;
  exportScale: ExportScale;
  /** CSS color or "transparent". */
  exportBg: string;
  exportFormat: "png" | "jpeg";
}

export interface State {
  code: string;
  visual: VisualConfig;
  secure: SecureConfig;
  /** Raw-JSON config override as typed by the user (may be invalid JSON). */
  rawOverride: string | null;
  ui: UiState;
}

export const DEFAULT_UI: UiState = {
  appTheme: "system",
  configOpen: false,
  splitFraction: 0.42,
  exportScale: 2,
  exportBg: "transparent",
  exportFormat: "png",
};

/** The default visual config, rendered into the raw box so it starts populated & in sync. */
const DEFAULT_RAW = serializeConfig(DEFAULT_VISUAL, null);

export const DEFAULT_STATE: State = {
  code: DEFAULT_TEMPLATE_CODE,
  visual: DEFAULT_VISUAL,
  secure: DEFAULT_SECURE,
  rawOverride: DEFAULT_RAW,
  ui: DEFAULT_UI,
};

/**
 * Make `visual` and `rawOverride` mutually consistent after a load/share/hydrate.
 * If the raw box holds a valid config it wins (its keys flow into the controls);
 * otherwise the box is regenerated from the typed visual config.
 */
export function reconcileConfig(state: State): State {
  const parsed = parseRawConfig(state.rawOverride);
  if (parsed) return { ...state, visual: parseConfigIntoVisual(parsed, state.visual) };
  return { ...state, rawOverride: serializeConfig(state.visual, null) };
}

export type Action =
  | { type: "setCode"; code: string }
  | { type: "patchVisual"; patch: Partial<VisualConfig> }
  | { type: "patchSecure"; patch: Partial<SecureConfig> }
  | { type: "patchUi"; patch: Partial<UiState> }
  | { type: "setThemeVar"; key: string; value: string | null }
  | { type: "setRaw"; raw: string | null }
  | { type: "loadTemplate"; code: string }
  | { type: "hydrate"; state: State }
  | { type: "reset" };

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "setCode":
    case "loadTemplate":
      return { ...state, code: action.code };
    case "patchVisual": {
      // A control moved → update the typed config and mirror it into the raw box.
      const visual = { ...state.visual, ...action.patch };
      return { ...state, visual, rawOverride: serializeConfig(visual, state.rawOverride) };
    }
    case "patchSecure":
      return { ...state, secure: { ...state.secure, ...action.patch } };
    case "patchUi":
      return { ...state, ui: { ...state.ui, ...action.patch } };
    case "setThemeVar": {
      const next = { ...state.visual.themeVariables };
      if (action.value === null) delete next[action.key];
      else next[action.key] = action.value;
      const visual = { ...state.visual, themeVariables: next };
      return { ...state, visual, rawOverride: serializeConfig(visual, state.rawOverride) };
    }
    case "setRaw": {
      // The raw box was edited → keep the exact text and push recognized keys
      // back into the typed controls (skip when the JSON is mid-edit / invalid).
      const parsed = parseRawConfig(action.raw);
      const visual = parsed ? parseConfigIntoVisual(parsed, state.visual) : state.visual;
      return { ...state, rawOverride: action.raw, visual };
    }
    case "hydrate":
      return reconcileConfig(action.state);
    case "reset":
      return { ...DEFAULT_STATE, ui: state.ui };
    default:
      return state;
  }
}

// ---- Persistence -----------------------------------------------------------

const STORAGE_KEY = "mermaid-editor:v1";
const SCHEMA_VERSION = 1;

/** Merge a possibly-partial stored state onto defaults so new fields never break older saves. */
function mergeWithDefaults(stored: Partial<State> | undefined): State {
  if (!stored || typeof stored !== "object") return DEFAULT_STATE;
  return reconcileConfig({
    code: typeof stored.code === "string" ? stored.code : DEFAULT_STATE.code,
    visual: { ...DEFAULT_VISUAL, ...(stored.visual ?? {}) },
    secure: { ...DEFAULT_SECURE, ...(stored.secure ?? {}) },
    rawOverride: typeof stored.rawOverride === "string" ? stored.rawOverride : null,
    ui: { ...DEFAULT_UI, ...(stored.ui ?? {}) },
  });
}

export function saveState(state: State): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: SCHEMA_VERSION, state }));
  } catch {
    /* private mode / quota — ignore */
  }
}

export function loadState(): State | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v?: number; state?: Partial<State> };
    if (parsed?.v !== SCHEMA_VERSION || !parsed.state) return null;
    return mergeWithDefaults(parsed.state);
  } catch {
    return null;
  }
}

// ---- Shareable snapshot ----------------------------------------------------

export interface ShareSnapshot {
  code: string;
  visual: VisualConfig;
  secure: SecureConfig;
  rawOverride: string | null;
}

export function toSnapshot(state: State): ShareSnapshot {
  return {
    code: state.code,
    visual: state.visual,
    secure: state.secure,
    rawOverride: state.rawOverride,
  };
}

/** Apply a decoded snapshot onto the current state (keeps local UI prefs). */
export function fromSnapshot(snapshot: Partial<ShareSnapshot> | null, base: State): State {
  if (!snapshot || typeof snapshot !== "object") return base;
  return reconcileConfig({
    ...base,
    code: typeof snapshot.code === "string" ? snapshot.code : base.code,
    visual: { ...DEFAULT_VISUAL, ...(snapshot.visual ?? {}) },
    secure: { ...DEFAULT_SECURE, ...(snapshot.secure ?? {}) },
    rawOverride: typeof snapshot.rawOverride === "string" ? snapshot.rawOverride : null,
  });
}

// ---- Hooks -----------------------------------------------------------------

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

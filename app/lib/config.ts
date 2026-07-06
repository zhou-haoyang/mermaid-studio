// Pure, side-effect-free configuration types, curated option lists, and the
// helpers that turn app state into mermaid config. Safe to import anywhere
// (no `mermaid`, no DOM access) so it never drags the ~1MB library into a chunk.

export type Theme = "default" | "neutral" | "dark" | "forest" | "base";
export type Look = "classic" | "handDrawn" | "neo";
export type Curve =
  | "basis"
  | "linear"
  | "cardinal"
  | "natural"
  | "step"
  | "stepBefore"
  | "stepAfter"
  | "monotoneX"
  | "monotoneY"
  | "bumpX"
  | "bumpY"
  | "catmullRom";
export type SecurityLevel = "strict" | "loose" | "antiscript";

export interface VisualConfig {
  theme: Theme;
  /** Concrete CSS font-family stack (never a `var()` — it must resolve inside the export sandbox). */
  fontFamily: string;
  look: Look;
  curve: Curve;
  htmlLabels: boolean;
  /** Only meaningful when `theme === "base"`. */
  themeVariables: Record<string, string>;
}

export interface SecureConfig {
  securityLevel: SecurityLevel;
  maxTextSize: number;
  maxEdges: number;
}

export interface Option<T extends string> {
  value: T;
  label: string;
}

export const THEMES: Option<Theme>[] = [
  { value: "default", label: "Default" },
  { value: "neutral", label: "Neutral" },
  { value: "dark", label: "Dark" },
  { value: "forest", label: "Forest" },
  { value: "base", label: "Base (customizable)" },
];

export const LOOKS: Option<Look>[] = [
  { value: "classic", label: "Classic" },
  { value: "handDrawn", label: "Hand-drawn" },
  { value: "neo", label: "Neo" },
];

export const CURVES: Option<Curve>[] = [
  { value: "basis", label: "Basis" },
  { value: "linear", label: "Linear" },
  { value: "cardinal", label: "Cardinal" },
  { value: "natural", label: "Natural" },
  { value: "step", label: "Step" },
  { value: "stepBefore", label: "Step before" },
  { value: "stepAfter", label: "Step after" },
  { value: "monotoneX", label: "Monotone X" },
  { value: "monotoneY", label: "Monotone Y" },
  { value: "bumpX", label: "Bump X" },
  { value: "bumpY", label: "Bump Y" },
  { value: "catmullRom", label: "Catmull-Rom" },
];

export const SECURITY_LEVELS: Option<SecurityLevel>[] = [
  { value: "strict", label: "Strict (safest)" },
  { value: "loose", label: "Loose (allows interaction/HTML)" },
  { value: "antiscript", label: "Anti-script" },
];

// Web-safe / system families only: these render identically on screen and when
// the SVG is rasterized in the isolated <img> export sandbox (no font embedding
// needed). See `export.ts` for the caveat around custom web fonts.
export const FONTS: Option<string>[] = [
  { value: '"trebuchet ms", verdana, arial, sans-serif', label: "Trebuchet (default)" },
  { value: "Arial, Helvetica, sans-serif", label: "Arial / Helvetica" },
  { value: "Verdana, Geneva, sans-serif", label: "Verdana" },
  { value: "Tahoma, Geneva, sans-serif", label: "Tahoma" },
  { value: '"Segoe UI", system-ui, sans-serif', label: "Segoe UI / System" },
  { value: 'Georgia, "Times New Roman", serif', label: "Georgia (serif)" },
  { value: '"Times New Roman", Times, serif', label: "Times (serif)" },
  { value: '"Courier New", Courier, monospace', label: "Courier (mono)" },
  { value: '"Comic Sans MS", "Comic Sans", cursive', label: "Comic Sans" },
];

// Curated set of `themeVariables` exposed as color pickers when theme === "base".
export interface ThemeVarField {
  key: string;
  label: string;
  fallback: string;
}
export const THEME_VAR_FIELDS: ThemeVarField[] = [
  { key: "primaryColor", label: "Primary", fallback: "#ECECFF" },
  { key: "primaryTextColor", label: "Primary text", fallback: "#131300" },
  { key: "primaryBorderColor", label: "Primary border", fallback: "#9370DB" },
  { key: "lineColor", label: "Lines", fallback: "#333333" },
  { key: "secondaryColor", label: "Secondary", fallback: "#ffffde" },
  { key: "tertiaryColor", label: "Tertiary", fallback: "#ffffff" },
  { key: "background", label: "Background", fallback: "#ffffff" },
];

export const DEFAULT_VISUAL: VisualConfig = {
  theme: "default",
  fontFamily: FONTS[0].value,
  look: "classic",
  curve: "basis",
  htmlLabels: true,
  themeVariables: {},
};

export const DEFAULT_SECURE: SecureConfig = {
  securityLevel: "strict",
  maxTextSize: 50000,
  maxEdges: 500,
};

/** Deep-merge plain objects (arrays and primitives from `source` win). */
function deepMerge<T extends Record<string, unknown>>(target: T, source: Record<string, unknown>): T {
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = (target as Record<string, unknown>)[key];
    if (sv && typeof sv === "object" && !Array.isArray(sv) && tv && typeof tv === "object" && !Array.isArray(tv)) {
      deepMerge(tv as Record<string, unknown>, sv as Record<string, unknown>);
    } else {
      (target as Record<string, unknown>)[key] = sv;
    }
  }
  return target;
}

/**
 * Build the *visual* mermaid config object (theme, font, look, flowchart, and
 * — only for the base theme — themeVariables). Applied per-render via an
 * `%%{init: ...}%%` directive so it never leaves stale global state behind.
 * `rawOverride` (from the raw-JSON escape hatch) is merged last and wins.
 */
export function buildVisualConfig(
  visual: VisualConfig,
  rawOverride?: Record<string, unknown> | null,
): Record<string, unknown> {
  const cfg: Record<string, unknown> = {
    theme: visual.theme,
    look: visual.look,
    fontFamily: visual.fontFamily,
    flowchart: { curve: visual.curve, htmlLabels: visual.htmlLabels },
  };
  if (visual.theme === "base" && Object.keys(visual.themeVariables).length > 0) {
    cfg.themeVariables = { ...visual.themeVariables };
  }
  if (rawOverride && typeof rawOverride === "object") {
    deepMerge(cfg, rawOverride);
  }
  return cfg;
}

export function buildInitDirective(
  visual: VisualConfig,
  rawOverride?: Record<string, unknown> | null,
): string {
  return `%%{init: ${JSON.stringify(buildVisualConfig(visual, rawOverride))}}%%\n`;
}

/** The *secure* keys — the only channel mermaid allows for these — passed to `initialize`. */
export function buildSecureConfig(secure: SecureConfig): Record<string, unknown> {
  return {
    startOnLoad: false,
    securityLevel: secure.securityLevel,
    maxTextSize: secure.maxTextSize,
    maxEdges: secure.maxEdges,
    suppressErrorRendering: true,
  };
}

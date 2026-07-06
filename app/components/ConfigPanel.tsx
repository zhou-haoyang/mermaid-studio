"use client";

import { useMemo } from "react";
import { RotateCcw, X } from "lucide-react";
import {
  CURVES,
  SECURITY_LEVELS,
  THEME_VAR_FIELDS,
  type SecureConfig,
  type VisualConfig,
} from "../lib/config";
import type { Action } from "../lib/state";

interface ConfigPanelProps {
  open: boolean;
  visual: VisualConfig;
  secure: SecureConfig;
  rawOverride: string | null;
  dispatch: React.Dispatch<Action>;
  onClose: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-black/10 py-4 last:border-b-0 dark:border-white/10">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

const fieldLabel = "flex items-center justify-between gap-2 text-sm";
const inputBase =
  "rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-blue-500 dark:border-white/20";

export default function ConfigPanel({
  open,
  visual,
  secure,
  rawOverride,
  dispatch,
  onClose,
}: ConfigPanelProps) {
  const rawError = useMemo(() => {
    if (!rawOverride || !rawOverride.trim()) return null;
    try {
      const parsed = JSON.parse(rawOverride);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return "Must be a JSON object";
      }
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }, [rawOverride]);

  const isBase = visual.theme === "base";

  return (
    <aside
      className={`h-full shrink-0 overflow-hidden border-l border-black/10 bg-background transition-[width] duration-200 dark:border-white/10 ${
        open ? "w-80" : "w-0"
      }`}
      aria-hidden={!open}
    >
      <div className="flex h-full w-80 flex-col">
        <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
          <h2 className="text-sm font-semibold">Configuration</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-foreground/60 hover:bg-foreground/10"
            aria-label="Close configuration"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          <Section title="Rendering">
            <label className={fieldLabel}>
              <span className="text-foreground/70">Edge curve</span>
              <select
                className={inputBase}
                value={visual.curve}
                onChange={(e) => dispatch({ type: "patchVisual", patch: { curve: e.target.value as VisualConfig["curve"] } })}
              >
                {CURVES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={visual.htmlLabels}
                onChange={(e) => dispatch({ type: "patchVisual", patch: { htmlLabels: e.target.checked } })}
              />
              <span className="text-foreground/70">
                HTML labels
                <span className="mt-0.5 block text-xs text-foreground/45">
                  Turn off for plain SVG text — more reliable in PNG/JPEG exports.
                </span>
              </span>
            </label>
          </Section>

          <Section title="Theme variables">
            {!isBase && (
              <p className="text-xs text-foreground/45">
                Switch the theme to <span className="font-medium">Base</span> to customize colors.
              </p>
            )}
            {isBase &&
              THEME_VAR_FIELDS.map((f) => {
                const current = visual.themeVariables[f.key];
                return (
                  <div key={f.key} className={fieldLabel}>
                    <span className="text-foreground/70">{f.label}</span>
                    <div className="flex items-center gap-1.5">
                      <label className="relative h-6 w-6 overflow-hidden rounded border border-black/15 dark:border-white/20">
                        <input
                          type="color"
                          value={current ?? f.fallback}
                          onChange={(e) => dispatch({ type: "setThemeVar", key: f.key, value: e.target.value })}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        />
                        <span className="block h-full w-full" style={{ background: current ?? f.fallback }} />
                      </label>
                      <button
                        type="button"
                        onClick={() => dispatch({ type: "setThemeVar", key: f.key, value: null })}
                        disabled={!current}
                        className="rounded p-1 text-foreground/40 hover:bg-foreground/10 disabled:opacity-30"
                        title="Reset to theme default"
                        aria-label={`Reset ${f.label}`}
                      >
                        <RotateCcw size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
          </Section>

          <Section title="Security & limits">
            <label className={fieldLabel}>
              <span className="text-foreground/70">Security level</span>
              <select
                className={inputBase}
                value={secure.securityLevel}
                onChange={(e) =>
                  dispatch({ type: "patchSecure", patch: { securityLevel: e.target.value as SecureConfig["securityLevel"] } })
                }
              >
                {SECURITY_LEVELS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-foreground/45">
              <span className="font-medium">Loose</span> enables click interactions and raw HTML but disables sanitization.
            </p>
            <label className={fieldLabel}>
              <span className="text-foreground/70">Max text size</span>
              <input
                type="number"
                className={`${inputBase} w-24`}
                value={secure.maxTextSize}
                min={1000}
                step={1000}
                onChange={(e) => dispatch({ type: "patchSecure", patch: { maxTextSize: Number(e.target.value) || 50000 } })}
              />
            </label>
            <label className={fieldLabel}>
              <span className="text-foreground/70">Max edges</span>
              <input
                type="number"
                className={`${inputBase} w-24`}
                value={secure.maxEdges}
                min={10}
                step={50}
                onChange={(e) => dispatch({ type: "patchSecure", patch: { maxEdges: Number(e.target.value) || 500 } })}
              />
            </label>
          </Section>

          <Section title="Config (JSON)">
            <p className="text-xs text-foreground/45">
              The live diagram config, kept in sync with the controls above — edit either side.
              Advanced keys with no control (e.g. <code>flowchart.nodeSpacing</code>) are preserved.
            </p>
            <textarea
              spellCheck={false}
              value={rawOverride ?? ""}
              onChange={(e) => dispatch({ type: "setRaw", raw: e.target.value || null })}
              placeholder={'{\n  "flowchart": { "nodeSpacing": 60 }\n}'}
              className={`h-32 w-full resize-y font-mono text-xs ${inputBase} ${
                rawError ? "border-red-500 focus:border-red-500" : ""
              }`}
            />
            {rawError && <p className="text-xs text-red-500">Invalid JSON: {rawError}</p>}
          </Section>

          <div className="py-4">
            <button
              type="button"
              onClick={() => {
                if (confirm("Reset code and all settings to defaults?")) dispatch({ type: "reset" });
              }}
              className="w-full rounded-md border border-black/15 px-3 py-1.5 text-sm text-foreground/70 hover:bg-foreground/5 dark:border-white/20"
            >
              Reset everything
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

"use client";

import { useState } from "react";
import { Check, Monitor, Moon, Settings2, Share2, Sun, Workflow } from "lucide-react";
import { FONTS, LOOKS, THEMES, type VisualConfig } from "../lib/config";
import { TEMPLATES } from "../lib/templates";
import type { AppTheme, Action, State } from "../lib/state";

interface ToolbarProps {
  state: State;
  dispatch: React.Dispatch<Action>;
  onShare: () => Promise<boolean>;
  DownloadMenu: React.ReactNode;
}

const selectClass =
  "rounded-md border border-black/15 bg-transparent py-1 pl-2 pr-6 text-sm outline-none focus:border-blue-500 dark:border-white/20";

const themeCycle: AppTheme[] = ["system", "light", "dark"];
const themeIcon: Record<AppTheme, React.ReactNode> = {
  system: <Monitor size={16} />,
  light: <Sun size={16} />,
  dark: <Moon size={16} />,
};

export default function Toolbar({ state, dispatch, onShare, DownloadMenu }: ToolbarProps) {
  const { visual, ui } = state;
  const [copied, setCopied] = useState(false);

  const patch = (p: Partial<VisualConfig>) => dispatch({ type: "patchVisual", patch: p });

  const handleTemplate = (id: string) => {
    const tpl = TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    if (state.code.trim() && !confirm(`Replace the current diagram with the "${tpl.label}" template?`)) return;
    dispatch({ type: "loadTemplate", code: tpl.code });
  };

  const handleShare = async () => {
    const ok = await onShare();
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const cycleTheme = () => {
    const next = themeCycle[(themeCycle.indexOf(ui.appTheme) + 1) % themeCycle.length];
    dispatch({ type: "patchUi", patch: { appTheme: next } });
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 overflow-x-auto overflow-y-hidden border-b border-black/10 bg-background px-3 dark:border-white/10">
      <div className="flex shrink-0 items-center gap-1.5 pr-1 font-semibold">
        <Workflow size={18} className="text-blue-600 dark:text-blue-400" />
        <span className="hidden sm:inline">Mermaid Studio</span>
      </div>

      <div className="mx-1 h-5 w-px shrink-0 bg-foreground/15" />

      <label className="flex shrink-0 items-center gap-1.5 text-sm">
        <span className="hidden text-foreground/50 lg:inline">Theme</span>
        <select
          className={selectClass}
          value={visual.theme}
          onChange={(e) => patch({ theme: e.target.value as VisualConfig["theme"] })}
          title="Diagram theme"
        >
          {THEMES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex shrink-0 items-center gap-1.5 text-sm">
        <span className="hidden text-foreground/50 lg:inline">Font</span>
        <select
          className={selectClass}
          value={visual.fontFamily}
          onChange={(e) => patch({ fontFamily: e.target.value })}
          title="Diagram font"
        >
          {FONTS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex shrink-0 items-center gap-1.5 text-sm">
        <span className="hidden text-foreground/50 lg:inline">Look</span>
        <select
          className={selectClass}
          value={visual.look}
          onChange={(e) => patch({ look: e.target.value as VisualConfig["look"] })}
          title="Diagram look"
        >
          {LOOKS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </label>

      <select
        className={selectClass}
        value=""
        onChange={(e) => {
          if (e.target.value) handleTemplate(e.target.value);
          e.target.value = "";
        }}
        title="Insert a starter template"
      >
        <option value="">Templates…</option>
        {TEMPLATES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>

      <div className="ml-auto" />

      <button
        type="button"
        onClick={cycleTheme}
        className="flex shrink-0 items-center gap-1.5 rounded-md border border-black/15 px-2 py-1.5 text-sm text-foreground/70 hover:bg-foreground/5 dark:border-white/20"
        title={`App appearance: ${ui.appTheme}`}
      >
        {themeIcon[ui.appTheme]}
        <span className="hidden capitalize md:inline">{ui.appTheme}</span>
      </button>

      <button
        type="button"
        onClick={handleShare}
        className="flex shrink-0 items-center gap-1.5 rounded-md border border-black/15 px-2 py-1.5 text-sm text-foreground/70 hover:bg-foreground/5 dark:border-white/20"
        title="Copy a shareable link"
      >
        {copied ? <Check size={16} className="text-green-600 dark:text-green-400" /> : <Share2 size={16} />}
        <span className="hidden md:inline">{copied ? "Copied!" : "Share"}</span>
      </button>

      <button
        type="button"
        onClick={() => dispatch({ type: "patchUi", patch: { configOpen: !ui.configOpen } })}
        className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1.5 text-sm hover:bg-foreground/5 ${
          ui.configOpen
            ? "border-blue-500 text-blue-600 dark:text-blue-400"
            : "border-black/15 text-foreground/70 dark:border-white/20"
        }`}
        title="Toggle configuration panel"
      >
        <Settings2 size={16} />
        <span className="hidden md:inline">Config</span>
      </button>

      <div className="shrink-0">{DownloadMenu}</div>
    </header>
  );
}

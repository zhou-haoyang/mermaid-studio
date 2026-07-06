@AGENTS.md

# Mermaid Studio — project guide

A **client-side Mermaid editor/viewer** (Next.js 16 App Router + React 19 + Tailwind v4 + TypeScript strict, pnpm). Everything interactive runs in the browser — Mermaid needs the DOM. Code lives under `app/` (no `src/`); path alias `@/*` → repo root.

## Commands

- `pnpm dev` / `pnpm build` / `pnpm lint` (Turbopack). No test runner is installed — **verify behavior by driving the running app in a headless browser** (e.g. Playwright against `http://localhost:3000`), not just types/lint.

## Architecture & non-obvious conventions

- **Client boundary (Next 16 rule):** `app/page.tsx` (server, holds `metadata`) → `app/EditorClient.tsx` (`'use client'`) does the **only** `dynamic(() => import('./components/EditorApp'), { ssr:false })` — `ssr:false` is illegal in Server Components here. `EditorApp` never SSRs, which makes reading `localStorage`/URL-hash in the reducer initializer safe.
- **Mermaid config split** (`app/lib/config.ts`, `app/lib/mermaid.ts`): *secure* keys (`securityLevel`, `maxTextSize`, `maxEdges`) go through `initialize`; *visual* keys (theme, font, look, flowchart, `themeVariables`) are applied per-render via a prepended `%%{init: …}%%` directive so no stale global state accumulates.
- **Render lifecycle:** lazy-imported mermaid singleton; `validate()` (`mermaid.parse`) for friendly errors; `renderDiagram()` renders into an **off-screen, laid-out (NOT `display:none`)** measurement div and removes stray `#id`/`#did` nodes in `finally`. SVG is injected imperatively via `ref.innerHTML`; on error the container is left untouched (**keep last good render**). A monotonic `tokenRef` in `EditorApp` discards out-of-order async results.
- **Export** (`app/lib/export.ts`): dimensions come from the SVG **`viewBox`** (× scale), not `getBoundingClientRect`. **Raster (PNG/JPEG) re-renders with `htmlLabels:false`** via `renderForRaster()` — HTML labels use `<foreignObject>`, which taints the canvas and breaks `toBlob`. SVG export keeps the on-screen look.
- **State** (`app/lib/state.ts`): one `useReducer`, debounced-persisted to `localStorage` and mirrored into the URL hash (pako, `app/lib/share.ts`). Hash takes precedence over `localStorage` on load.
- **Dark mode:** class-based via `@custom-variant dark` in `app/globals.css`; `EditorApp` toggles `.dark` on `<html>` from `ui.appTheme` (independent of the diagram theme).
- **Editor** (`app/lib/cmMermaid.ts`): a hand-written CodeMirror `StreamLanguage` (returns `@lezer/highlight` tag names) + a linter bridging `mermaid.parse` errors to the failing line.
- **KaTeX:** self-hosted via `import "katex/dist/katex.min.css"` in `layout.tsx`. `katex` is a **direct dependency pinned to match mermaid's range** (`^0.16.x`) so pnpm dedupes both to one shared version; keep them in lockstep when bumping.

## Gotchas

- `pako` has **no default export** — use named imports (`import { deflate, inflate } from "pako"`).
- Diagram fonts are **web-safe families only** (raster export can't see page webfonts); pass concrete family strings to mermaid, never `var()`.
- ESLint's `react-hooks/set-state-in-effect` flags synchronous `setState` in an effect body — do resets inside the async callback instead.

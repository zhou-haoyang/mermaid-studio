# Mermaid Studio

A client-side [Mermaid](https://mermaid.js.org/) diagram **editor & viewer**: write Mermaid source, see a live preview, customize theme / font / config, and export as vector (SVG) or raster (PNG / JPEG).

## Features

- **Live editor** — [CodeMirror](https://codemirror.net/) with Mermaid syntax highlighting, line numbers, and inline error markers on the failing line. Invalid source shows a friendly error **while keeping the last valid diagram on screen**.
- **Themes** — `default`, `neutral`, `dark`, `forest`, and `base` (with custom `themeVariables` color pickers).
- **Fonts** — a curated set of web-safe families, applied to the diagram.
- **Config** — `look` (classic / hand-drawn / neo), edge curve, HTML labels, security level & limits, plus a raw-JSON override for anything else.
- **Math** — LaTeX via KaTeX inside labels, e.g. `A["$$E = mc^2$$"]`.
- **Export** — **SVG** (vector), plus **PNG / JPEG** at 1×/2×/3× with transparent / white / black / custom backgrounds.
- **Pan & zoom** — drag + scroll-wheel zoom, with fit-to-view and reset.
- **Starter templates** — flowchart, sequence, class, state, ER, gantt, pie, mind map, git graph.
- **Auto-save & shareable links** — your work persists to `localStorage`, and the full diagram + settings are encoded into the URL hash so a link reproduces it.
- **Light / dark / system** app appearance, independent of the diagram theme.

## Getting started

Requires Node.js ≥ 20.9 and [pnpm](https://pnpm.io/).

```bash
pnpm install
pnpm dev          # start the dev server (http://localhost:3000)
```

Then open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the Turbopack dev server. |
| `pnpm build` | Production build. |
| `pnpm start` | Serve the production build. |
| `pnpm lint` | Run ESLint. |

## Tech stack

- **[Next.js 16](https://nextjs.org/)** (App Router, Turbopack) + **React 19** — the whole editor is a client-only component (Mermaid needs the DOM).
- **[Tailwind CSS v4](https://tailwindcss.com/)** (CSS-first config in `app/globals.css`, class-based dark mode).
- **TypeScript** (strict).
- **[mermaid](https://mermaid.js.org/) v11**, **CodeMirror 6**, **[KaTeX](https://katex.org/)** (self-hosted), **pako** (URL compression), **lucide-react** (icons).

## Project structure

```
app/
  page.tsx           Server entry → renders the client editor
  EditorClient.tsx   'use client' boundary; dynamic(ssr:false) import of EditorApp
  layout.tsx         Root layout, fonts, self-hosted KaTeX CSS
  globals.css        Tailwind + theme tokens + class-based dark variant
  components/
    EditorApp.tsx    App root: state, render pipeline, layout
    Toolbar.tsx      Theme/font/look, templates, appearance, share, export
    EditorPane.tsx   CodeMirror editor + error banner
    ViewerPane.tsx   SVG injection, pan/zoom, zoom controls
    ConfigPanel.tsx  Advanced config drawer
    DownloadMenu.tsx Export options (format/scale/background)
    Divider.tsx      Draggable split handle
  lib/
    config.ts        Types, option lists, mermaid config builders
    mermaid.ts       Lazy mermaid wrapper: validate / render / export render
    export.ts        SVG/PNG/JPEG export pipeline
    cmMermaid.ts     CodeMirror Mermaid language + linter
    templates.ts     Starter diagrams
    share.ts         URL-hash encode/decode
    state.ts         Reducer, persistence, snapshot
```

## Known limitations

- **Raster export of custom web fonts** — a rasterized SVG can't see page-loaded webfonts, so PNG/JPEG text falls back to a system font. The shipped font list is web-safe specifically so exports stay faithful.
- **Raster export of math / rich labels** — PNG/JPEG export disables HTML labels (`<foreignObject>`) to avoid tainting the canvas. Math and HTML-formatted labels therefore render as plain text in raster output; use **SVG export** to keep them.

## Deploy

This is a fully static, client-side app. `pnpm build` prerenders it, and it can be hosted on any static host (or [Vercel](https://vercel.com/new)).

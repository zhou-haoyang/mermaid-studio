"use client";

// The one place `ssr: false` is legal in Next 16: it must originate inside a
// Client Component. `EditorApp` therefore never prerenders, which makes reading
// localStorage / the URL hash during init safe (no hydration mismatch) and
// guarantees mermaid only ever runs in the browser.

import dynamic from "next/dynamic";

const EditorApp = dynamic(() => import("./components/EditorApp"), {
  ssr: false,
  loading: () => (
    <div className="flex h-dvh items-center justify-center bg-background text-sm text-foreground/50">
      Loading editor…
    </div>
  ),
});

export default function EditorClient() {
  return <EditorApp />;
}

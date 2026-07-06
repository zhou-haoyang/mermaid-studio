// Server Component route entry. Keeps `metadata` legal (see layout.tsx) and
// hands off to the client-only editor, which owns all browser interaction.
import EditorClient from "./EditorClient";

export default function Page() {
  return <EditorClient />;
}

import type { WorkspaceMode } from "@/lib/app-mode";
import { getAppData } from "../actions";
import { AppShell } from "../_components/AppShell";

export const dynamic = "force-dynamic";

export default async function DemoAppPage() {
  const mode: WorkspaceMode = "demo";
  const { collections, notes } = await getAppData(mode);
  return (
    <AppShell
      collections={collections.map((c) => ({ id: c.id, name: c.name }))}
      notes={notes}
      mode={mode}
    />
  );
}

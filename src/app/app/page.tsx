import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppData } from "./actions";
import { AppShell } from "./_components/AppShell";
import type { WorkspaceMode } from "@/lib/app-mode";

export default async function AppPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  const mode: WorkspaceMode = "user";
  const { collections, notes } = await getAppData(mode);

  return (
    <AppShell
      collections={collections.map((c) => ({ id: c.id, name: c.name }))}
      notes={notes}
      mode={mode}
    />
  );
}

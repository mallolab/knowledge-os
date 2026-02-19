import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppData } from "./actions";
import { AppShell } from "./_components/AppShell";

export default async function AppPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  const { collections, notes } = await getAppData();

  return (
    <AppShell
      collections={collections.map((c) => ({ id: c.id, name: c.name }))}
      notes={notes}
    />
  );
}

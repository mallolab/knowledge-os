"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Command, Search, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NewNoteDialog } from "./NewNoteDialog";
import { NewCollectionDialog } from "./NewCollectionDialog";
import { BrandMark } from "@/components/brand/BrandMark";

export function TopBar({
  collections,
  query,
  setQuery,
  isSearching,
  isPending,
  onClear,
}: {
  collections: { id: string; name: string }[];
  query: string;
  setQuery: (v: string) => void;
  isSearching: boolean;
  isPending: boolean;
  onClear: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();

  async function signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace("/login");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to sign out. Try again.";
      window.dispatchEvent(
        new CustomEvent("ko:toast", {
          detail: { message, tone: "error" },
        }),
      );
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        const el = document.getElementById(
          "global-search",
        ) as HTMLInputElement | null;
        el?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="glass-panel ko-fade-up space-y-4 rounded-3xl p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <BrandMark size="md" subtitle="Daily intelligence desk" />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <p className="ko-token inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
              <Sparkles className="size-3" />
              Semantic + AI
            </p>
            <p className="text-xs text-muted-foreground">
              Curated notes and retrieval in one focused workspace.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <NewCollectionDialog />
          <NewNoteDialog collections={collections} />
          <Button variant="outline" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xl">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="global-search"
            placeholder={isPending ? "Searching..." : "Search notes semantically"}
            className="w-full rounded-xl bg-background/70 pl-10"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          {isSearching && (
            <Button variant="outline" onClick={onClear}>
              Clear
            </Button>
          )}
          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Command className="size-3.5" />
            Focus search: Cmd/Ctrl + /
          </p>
        </div>
      </div>
    </div>
  );
}

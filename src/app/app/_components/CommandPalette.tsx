"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpenText,
  FolderTree,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  CommandSeparator,
} from "@/components/ui/command";
import type { Note } from "@/lib/types";

export function CommandPalette({
  collections,
  notes,
  onClearSearch,
  onJumpToNote,
  onCreateNote,
  onCreateCollection,
  onSelectCollection,
}: {
  collections: { id: string; name: string }[];
  notes: Note[];
  onClearSearch: () => void;
  onJumpToNote: (id: string) => void;
  onCreateNote: () => void;
  onCreateCollection: () => void;
  onSelectCollection: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);

      if (!open) return;

      if (e.altKey && !e.metaKey && !e.ctrlKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setOpen(false);
        onCreateNote();
      }

      if (e.altKey && !e.metaKey && !e.ctrlKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        setOpen(false);
        onCreateCollection();
      }

      if (e.altKey && !e.metaKey && !e.ctrlKey && e.key.toLowerCase() === "x") {
        e.preventDefault();
        setOpen(false);
        onClearSearch();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClearSearch, onCreateCollection, onCreateNote, open]);

  const recentNotes = useMemo(() => notes.slice(0, 8), [notes]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search notes…" />
      <CommandList>
        <CommandEmpty>No matches yet. Try a note title or action keyword.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem
            value="new note"
            onSelect={() => {
              setOpen(false);
              onCreateNote();
            }}
          >
            <Plus className="size-4" />
            New note
            <CommandShortcut>⌥N</CommandShortcut>
          </CommandItem>

          <CommandItem
            value="new collection"
            onSelect={() => {
              setOpen(false);
              onCreateCollection();
            }}
          >
            <FolderTree className="size-4" />
            New collection
            <CommandShortcut>⌥C</CommandShortcut>
          </CommandItem>

          <CommandItem
            value="focus search"
            onSelect={() => {
              setOpen(false);
              const el = document.getElementById(
                "global-search",
              ) as HTMLInputElement | null;
              el?.focus();
            }}
          >
            <Search className="size-4" />
            Focus search
            <CommandShortcut>⌘/</CommandShortcut>
          </CommandItem>

          <CommandItem
            value="clear search"
            onSelect={() => {
              setOpen(false);
              onClearSearch();
            }}
          >
            <X className="size-4" />
            Clear search
            <CommandShortcut>⌥X</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Notes">
          {recentNotes.map((n) => (
            <CommandItem
              key={n.id}
              value={`${n.title ?? "untitled"} ${n.content}`}
              onSelect={() => {
                setOpen(false);
                onJumpToNote(n.id);
              }}
            >
              <BookOpenText className="size-4" />
              {n.title?.trim() ? n.title : "Untitled"}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Collections">
          <CommandItem
            value="all collections"
            onSelect={() => {
              setOpen(false);
              onSelectCollection("all");
            }}
          >
            <FolderTree className="size-4" />
            All collections
          </CommandItem>
          <CommandItem
            value="no collection"
            onSelect={() => {
              setOpen(false);
              onSelectCollection("none");
            }}
          >
            <Sparkles className="size-4" />
            No collection
          </CommandItem>
          {collections.map((c) => (
            <CommandItem
              key={c.id}
              value={c.name}
              onSelect={() => {
                setOpen(false);
                onSelectCollection(c.id);
              }}
            >
              <FolderTree className="size-4" />
              {c.name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

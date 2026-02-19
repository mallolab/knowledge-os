"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createNote } from "../actions";
import { useEffect } from "react";

export function NewNoteDialog({
  collections,
}: {
  collections: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagsCsv, setTagsCsv] = useState("");
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function emitToast(message: string, tone: "success" | "error" | "info") {
    window.dispatchEvent(
      new CustomEvent("ko:toast", {
        detail: { message, tone },
      }),
    );
  }

  async function onCreate() {
    setError(null);
    setLoading(true);
    try {
      await createNote({ title, content, tagsCsv, collectionId });
      setTitle("");
      setContent("");
      setTagsCsv("");
      setCollectionId(null);
      setOpen(false);
      emitToast("Note created.", "success");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create note.";
      setError(message);
      emitToast(message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    function handler() {
      setOpen(true);
    }
    window.addEventListener("ko:new-note", handler);
    return () => window.removeEventListener("ko:new-note", handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New note</Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create note</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            placeholder="Write your note…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-40"
          />
          <Input
            placeholder="Tags (comma separated) e.g. ui, react, business"
            value={tagsCsv}
            onChange={(e) => setTagsCsv(e.target.value)}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={collectionId === null ? "default" : "outline"}
              onClick={() => setCollectionId(null)}
            >
              No collection
            </Button>
            {collections.map((c) => (
              <Button
                key={c.id}
                type="button"
                variant={collectionId === c.id ? "default" : "outline"}
                onClick={() => setCollectionId(c.id)}
              >
                {c.name}
              </Button>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onCreate}
              disabled={loading || !content.trim()}
            >
              {loading ? "Creating…" : "Create"}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

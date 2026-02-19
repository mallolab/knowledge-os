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
import { createCollection } from "../actions";
import { useEffect } from "react";

export function NewCollectionDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
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
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    setLoading(true);
    try {
      await createCollection(trimmed);
      setName("");
      setOpen(false);
      emitToast("Collection created.", "success");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create collection.";
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
    window.addEventListener("ko:new-collection", handler);
    return () => window.removeEventListener("ko:new-collection", handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">New collection</Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create collection</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            placeholder="e.g. Learning, UI, Clients…"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              type="button"
            >
              Cancel
            </Button>
            <Button
              onClick={onCreate}
              disabled={loading || !name.trim()}
              type="button"
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

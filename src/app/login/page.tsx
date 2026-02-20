"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Command, KeyRound, Mail, Orbit, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BrandMark } from "@/components/brand/BrandMark";

type Mode = "signin" | "signup" | "magic";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setLoading(true);

    try {
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${location.origin}/auth/callback` },
        });
        if (error) throw error;
        setStatus("Magic link sent. Check your inbox.");
        return;
      }

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setStatus("Account created. Sign in to continue.");
        setMode("signin");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      router.replace("/app");
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Something went wrong";
      setStatus(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ko-grid-overlay relative min-h-screen overflow-hidden px-4 py-8 sm:px-8 sm:py-10">
      <div className="ko-drift pointer-events-none absolute -top-24 left-[-4rem] h-80 w-80 rounded-full bg-teal-200/35 blur-3xl" />
      <div className="ko-drift pointer-events-none absolute -bottom-28 right-[-4rem] h-80 w-80 rounded-full bg-amber-200/30 blur-3xl" />

      <div className="ko-stagger relative mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="glass-panel hidden rounded-3xl p-8 lg:block">
          <BrandMark size="md" subtitle="Secure workspace" />

          <p className="ko-token mt-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]">
            <Sparkles className="size-3.5" />
            Access Portal
          </p>

          <h1 className="mt-6 text-4xl leading-tight">
            Your second brain deserves a crafted front door.
          </h1>

          <p className="mt-4 max-w-md text-sm text-muted-foreground">
            Knowledge OS combines secure note capture, semantic retrieval, and
            AI enrichment in a single focused workspace.
          </p>

          <div className="mt-8 space-y-3 text-sm text-muted-foreground">
            <p className="inline-flex items-center gap-2">
              <KeyRound className="size-4" />
              Secure auth with RLS-backed data access
            </p>
            <p className="inline-flex items-center gap-2">
              <Mail className="size-4" />
              Password and magic link login flows
            </p>
            <p className="inline-flex items-center gap-2">
              <Orbit className="size-4" />
              Private semantic indexing per account
            </p>
          </div>
        </section>

        <Card className="glass-panel w-full rounded-3xl border-none px-3 py-5 sm:px-5 sm:py-6">
          <CardHeader className="space-y-3 pb-3">
            <CardTitle className="text-3xl">Sign in</CardTitle>
            <CardDescription>
              Enter your personal research cockpit.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-4 sm:pb-6">
            <div className="mb-6 grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={mode === "signin" ? "default" : "outline"}
                onClick={() => setMode("signin")}
                className="w-full"
              >
                Sign in
              </Button>
              <Button
                type="button"
                variant={mode === "signup" ? "default" : "outline"}
                onClick={() => setMode("signup")}
                className="w-full"
              >
                Sign up
              </Button>
              <Button
                type="button"
                variant={mode === "magic" ? "default" : "outline"}
                onClick={() => setMode("magic")}
                className="w-full"
              >
                Magic link
              </Button>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <Input
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              {mode !== "magic" && (
                <Input
                  placeholder="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              )}

              <Button className="w-full" disabled={loading}>
                {loading
                  ? "Working..."
                  : mode === "signin"
                    ? "Sign in"
                    : mode === "signup"
                      ? "Create account"
                      : "Send magic link"}
              </Button>

              {status && (
                <p className="rounded-lg border bg-card/70 px-3 py-2 text-sm text-muted-foreground">
                  {status}
                </p>
              )}

              <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                <Link
                  href="/app/demo"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border bg-card/70 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
                >
                  Open demo
                  <Command className="size-4" />
                </Link>
                <Link
                  href="/case-study"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border bg-card/70 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
                >
                  Case study
                  <BookOpen className="size-4" />
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

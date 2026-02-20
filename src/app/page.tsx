import Link from "next/link";
import {
  ArrowRight,
  Command,
  Layers2,
  Orbit,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";

export default function Home() {
  return (
    <div className="ko-grid-overlay relative min-h-screen overflow-hidden px-4 py-10 sm:px-8 sm:py-12">
      <div className="ko-drift pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-emerald-200/35 blur-3xl" />
      <div className="ko-drift pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-amber-200/35 blur-3xl" />

      <main className="ko-stagger relative mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="glass-panel rounded-3xl p-7 sm:p-10">
          <BrandMark size="lg" subtitle="Portfolio Edition" />

          <p className="ko-token mt-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]">
            <Sparkles className="size-3.5" />
            Signature Build
          </p>

          <h1 className="mt-6 text-4xl leading-tight sm:text-5xl">
            Knowledge OS is a crafted interface for deep thinking.
          </h1>

          <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            Capture notes quickly, enrich with AI summaries and tags, then retrieve
            meaning with semantic search. The interface is tuned for rhythm,
            focus, and clarity.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              Enter Workspace
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/app/demo"
              className="inline-flex items-center gap-2 rounded-xl border bg-card/70 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              Open Demo App
              <Command className="size-4" />
            </Link>
          </div>
        </section>

        <section className="grid gap-4">
          <div className="glass-panel rounded-2xl p-6">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Signature Interactions
            </p>
            <ul className="mt-3 space-y-3 text-sm">
              <li className="inline-flex items-start gap-2">
                <Orbit className="mt-0.5 size-4 text-emerald-700" />
                Semantic search with instant local fallback
              </li>
              <li className="inline-flex items-start gap-2">
                <Layers2 className="mt-0.5 size-4 text-emerald-700" />
                Command palette for notes and collection filters
              </li>
              <li className="inline-flex items-start gap-2">
                <WandSparkles className="mt-0.5 size-4 text-emerald-700" />
                AI enrichment with guardrails and rate limits
              </li>
            </ul>
          </div>

          <div className="glass-panel rounded-2xl p-6">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Design Direction
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Editorial typography, paper-like color palette, and staged motion
              reveal. Built to feel intentional in portfolio reviews.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-amber-300/70 bg-amber-100/70 px-3 py-1 text-xs font-medium text-amber-900">
              <WandSparkles className="size-3.5" />
              Visual polish enabled
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft, Compass, Layers2, Sparkles, WandSparkles } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";

export default function CaseStudyPage() {
  return (
    <div className="ko-grid-overlay relative min-h-screen overflow-hidden px-4 py-8 sm:px-8 sm:py-10">
      <div className="ko-drift pointer-events-none absolute -top-24 left-[-4rem] h-80 w-80 rounded-full bg-teal-200/35 blur-3xl" />
      <div className="ko-drift pointer-events-none absolute -bottom-28 right-[-4rem] h-80 w-80 rounded-full bg-amber-200/30 blur-3xl" />

      <main className="ko-stagger relative mx-auto w-full max-w-5xl space-y-5">
        <section className="glass-panel rounded-3xl p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-4">
              <BrandMark size="md" subtitle="Case study" />
              <p className="ko-token inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]">
                <Sparkles className="size-3.5" />
                Knowledge OS
              </p>
              <h1 className="max-w-3xl text-4xl leading-tight sm:text-5xl">
                Designing a calm semantic workspace for high-context thinking.
              </h1>
              <p className="max-w-3xl text-base text-muted-foreground sm:text-lg">
                Knowledge OS explores a simple idea: AI should reduce cognitive overhead,
                not create more of it. The product combines structured note capture, model
                enrichment, and retrieval by meaning in one focused interface.
              </p>
            </div>

            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border bg-card/80 px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              <ArrowLeft className="size-4" />
              Back home
            </Link>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          <article className="glass-panel rounded-2xl p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Problem
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Notes get fragmented, search becomes keyword-only, and AI features often feel
              bolted on. Users need one place to capture thoughts, refine them, and retrieve
              ideas semantically.
            </p>
          </article>

          <article className="glass-panel rounded-2xl p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Approach
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Blend fast local interactions with background semantic capability. Keep visual
              hierarchy clean, use restrained motion, and make every AI action transparent.
            </p>
          </article>

          <article className="glass-panel rounded-2xl p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Outcome
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              A production-ready workspace with secure auth, vector search, command-driven
              workflows, and a public demo mode that can be explored without sign-up.
            </p>
          </article>
        </section>

        <section className="glass-panel rounded-3xl p-6 sm:p-8">
          <h2 className="text-2xl sm:text-3xl">Architecture highlights</h2>
          <div className="mt-5 grid gap-3">
            <div className="inline-flex items-start gap-3 rounded-xl border border-border/70 bg-card/70 px-4 py-3 text-sm">
              <Layers2 className="mt-0.5 size-4 text-emerald-700" />
              <div>
                <p className="font-medium">Structured data flow</p>
                <p className="text-muted-foreground">
                  Note content, summary, tags, and embedding are persisted for both precise
                  and semantic retrieval.
                </p>
              </div>
            </div>
            <div className="inline-flex items-start gap-3 rounded-xl border border-border/70 bg-card/70 px-4 py-3 text-sm">
              <Compass className="mt-0.5 size-4 text-emerald-700" />
              <div>
                <p className="font-medium">Semantic ranking + local fallback</p>
                <p className="text-muted-foreground">
                  Queries return fast local matches first while pgvector-backed semantic
                  results stream in.
                </p>
              </div>
            </div>
            <div className="inline-flex items-start gap-3 rounded-xl border border-border/70 bg-card/70 px-4 py-3 text-sm">
              <WandSparkles className="mt-0.5 size-4 text-emerald-700" />
              <div>
                <p className="font-medium">Guardrailed AI usage</p>
                <p className="text-muted-foreground">
                  Request budgeting, dedupe windows, and demo-specific limits keep usage
                  predictable and cost-aware.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="glass-panel rounded-3xl p-6 sm:p-8">
          <h2 className="text-2xl sm:text-3xl">Design principles</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>Editorial typography over dashboard noise.</li>
            <li>Paper-like palette with atmospheric depth.</li>
            <li>Motion as guidance, not decoration.</li>
            <li>AI as quiet augmentation to human thought.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}

import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: {
    wrap: "gap-2",
    glyph: "size-7",
    dot: "size-2.5",
    title: "text-base",
    subtitle: "text-[10px]",
  },
  md: {
    wrap: "gap-2.5",
    glyph: "size-9",
    dot: "size-3",
    title: "text-xl",
    subtitle: "text-xs",
  },
  lg: {
    wrap: "gap-3",
    glyph: "size-11",
    dot: "size-3.5",
    title: "text-2xl",
    subtitle: "text-xs",
  },
};

export function BrandMark({
  className,
  subtitle = "Semantic Note Workspace",
  size = "md",
}: BrandMarkProps) {
  const s = sizeClasses[size];

  return (
    <div className={cn("inline-flex items-center", s.wrap, className)}>
      <div
        className={cn(
          "relative grid place-items-center rounded-2xl border border-emerald-300/70 bg-gradient-to-br from-emerald-100 via-cyan-100 to-amber-100 shadow-sm",
          s.glyph,
        )}
      >
        <span className="absolute inset-1 rounded-xl border border-white/70" />
        <span
          className={cn(
            "rounded-full bg-emerald-700/80 shadow-[0_0_0_4px_oklch(0.95_0.03_165/70%)]",
            s.dot,
          )}
        />
      </div>

      <div className="leading-none">
        <p className={cn("font-editorial tracking-tight", s.title)}>Knowledge OS</p>
        <p
          className={cn(
            "mt-1 uppercase tracking-[0.18em] text-muted-foreground",
            s.subtitle,
          )}
        >
          {subtitle}
        </p>
      </div>
    </div>
  );
}

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          position: "relative",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "radial-gradient(circle at 80% 10%, rgba(251,191,36,0.35), transparent 40%), radial-gradient(circle at 10% 80%, rgba(20,184,166,0.35), transparent 42%), linear-gradient(140deg, #f8faf8 0%, #f3f6f4 100%)",
          padding: "62px 72px",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            borderRadius: 999,
            border: "1px solid rgba(20, 184, 166, 0.35)",
            color: "#0f766e",
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "10px 18px",
            width: "fit-content",
            background: "rgba(255,255,255,0.75)",
          }}
        >
          Knowledge OS
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 900 }}>
          <div
            style={{
              color: "#0f172a",
              fontSize: 74,
              lineHeight: 1.03,
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            A crafted semantic workspace for deep thinking.
          </div>
          <div
            style={{
              color: "#334155",
              fontSize: 34,
              lineHeight: 1.28,
              maxWidth: 850,
            }}
          >
            Structured note capture, AI enrichment, and vector retrieval in a focused,
            minimal interface.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            color: "#475569",
            fontSize: 24,
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: "linear-gradient(130deg, #0f766e, #14b8a6)",
            }}
          />
          AI summarization
          <div style={{ opacity: 0.45 }}>•</div>
          Semantic search
          <div style={{ opacity: 0.45 }}>•</div>
          Supabase + pgvector
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}

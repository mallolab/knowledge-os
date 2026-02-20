import type { Metadata } from "next";
import "./globals.css";

function getSiteUrl() {
  const fallback = "https://knowledge-os-five.vercel.app";
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ??
    fallback;

  try {
    return new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return new URL(fallback);
  }
}

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "Knowledge OS",
  description:
    "A semantic note workspace for high-context thinking, research capture, and retrieval.",
  metadataBase: siteUrl,
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Knowledge OS",
    title: "Knowledge OS",
    description:
      "A crafted semantic workspace for deep thinking with AI enrichment and vector retrieval.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Knowledge OS OpenGraph preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Knowledge OS",
    description:
      "A crafted semantic workspace for deep thinking with AI enrichment and vector retrieval.",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}

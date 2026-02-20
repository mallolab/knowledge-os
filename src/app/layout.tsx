import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Knowledge OS",
  description:
    "A semantic note workspace for high-context thinking, research capture, and retrieval.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
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

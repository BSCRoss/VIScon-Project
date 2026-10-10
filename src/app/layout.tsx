import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "greyGiraffe",
  description: "Coordinate lunch with your group at ETH and UZH mensas",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "greyGiraffe", statusBarStyle: "default" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#1c1917" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}

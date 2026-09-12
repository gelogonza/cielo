import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Satoshi is self-hosted rather than pulled from Fontshare's CDN: a font
// request to a third party is a request we do not control, and "no tracking"
// in docs/product-principles.md is meant literally.
const satoshi = localFont({
  src: [
    { path: "../public/fonts/Satoshi-400.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/Satoshi-500.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/Satoshi-700.woff2", weight: "700", style: "normal" },
    { path: "../public/fonts/Satoshi-900.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-satoshi",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cielo",
  description: "All your bookmarks in one place.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Cielo" },
};

export const viewport: Viewport = {
  // viewportFit: cover pairs with the safe-area padding in globals.css so the
  // app sits correctly under an iPhone notch when installed.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#121212",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${satoshi.variable} h-full antialiased`}>
      <body className="bg-ink text-primary-text flex min-h-full flex-col">{children}</body>
    </html>
  );
}

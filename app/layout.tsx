import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
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
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="bg-ink text-primary-text flex min-h-full flex-col">{children}</body>
    </html>
  );
}

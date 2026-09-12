import type { MetadataRoute } from "next";

/**
 * Installing Cielo registers it as a Web Share Target, so the OS share sheet
 * lists it alongside Messages, Photos and the rest. A shared page arrives as a
 * GET to /save with title/text/url query params.
 *
 * Support is Android/Chromium only — iOS Safari implements Web Share (sending)
 * but not Web Share Target (receiving), so iOS users paste into /save instead.
 * See docs/devlog.md.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cielo — all your bookmarks in one place",
    short_name: "Cielo",
    description: "Save anything from any app into one library you organise yourself.",
    start_url: "/library",
    scope: "/",
    display: "standalone",
    background_color: "#121212",
    theme_color: "#121212",
    orientation: "portrait-primary",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: "/save",
      method: "GET",
      // Chromium fills whichever of these the source app provides; a plain
      // page share usually arrives with the link in `url`, but some apps put
      // it in `text` instead, so /save reads both.
      params: { title: "title", text: "text", url: "url" },
    },
  };
}

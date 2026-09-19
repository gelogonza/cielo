/**
 * Taking everything back out.
 *
 * Plain links, not fetch-and-blob: the route answers with a
 * `Content-Disposition: attachment`, so the browser downloads it without
 * leaving the page, and it works with JavaScript off. Nothing here needs
 * client state.
 */
export function ExportPanel() {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h2 className="text-2xl font-medium">Take everything with you</h2>
        <p className="text-muted text-base leading-[24px]">
          Your library is yours. Download the whole thing whenever you like — no
          request, no waiting, nothing held back.
        </p>
      </div>

      <div className="border-line bg-surface rounded-panel flex flex-col gap-4 border p-6">
        <div className="flex flex-col gap-1">
          <a
            href="/api/export?format=json"
            download
            className="text-primary-text text-base font-medium underline underline-offset-4"
          >
            Everything, as JSON
          </a>
          <p className="text-muted text-[13px] leading-[18px]">
            The complete copy: every item, note, highlight, section and tag.
          </p>
        </div>

        <div className="bg-line h-px w-full" />

        <div className="flex flex-col gap-1">
          <a
            href="/api/export?format=html"
            download
            className="text-primary-text text-base font-medium underline underline-offset-4"
          >
            Bookmarks, as HTML
          </a>
          <p className="text-muted text-[13px] leading-[18px]">
            The format Chrome, Safari, Firefox and most bookmarking tools import.
            Sections become folders; highlights saved without a link are not
            included, since the format has nowhere to put them.
          </p>
        </div>
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { parseBookmarkFile, type ParseResult } from "@/lib/import/parse-bookmarks";

/** Matches the server's per-request ceiling in app/api/import/route.ts. */
const CHUNK = 200;

type Stage =
  | { kind: "idle" }
  | { kind: "parsed"; fileName: string; result: ParseResult }
  | { kind: "importing"; done: number; total: number }
  | { kind: "done"; imported: number; reused: number; sectionsCreated: number };

export function ImportView() {
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [asSections, setAsSections] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  async function readFile(file: File) {
    setError(null);

    try {
      const result = parseBookmarkFile(await file.text(), file.name);

      if (result.bookmarks.length === 0) {
        setError("No bookmarks found in that file. Export again as HTML or CSV.");
        setStage({ kind: "idle" });
        return;
      }

      setStage({ kind: "parsed", fileName: file.name, result });
    } catch {
      setError("That file could not be read.");
    }
  }

  async function runImport(result: ParseResult) {
    const entries = result.bookmarks.map((bookmark) => ({
      ...bookmark,
      folder: asSections ? bookmark.folder : null,
    }));

    const totals = { imported: 0, reused: 0, sectionsCreated: 0 };
    setStage({ kind: "importing", done: 0, total: entries.length });

    for (let index = 0; index < entries.length; index += CHUNK) {
      const chunk = entries.slice(index, index + CHUNK);

      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: chunk }),
      });

      if (!response.ok) {
        setError("The import stopped partway. Anything already brought over is in your library.");
        setStage({ kind: "idle" });
        return;
      }

      const batch = await response.json();
      totals.imported += batch.imported;
      totals.reused += batch.reused;
      totals.sectionsCreated += batch.sectionsCreated;

      setStage({
        kind: "importing",
        done: Math.min(index + CHUNK, entries.length),
        total: entries.length,
      });
    }

    setStage({ kind: "done", ...totals });
  }

  return (
    <main className="mx-auto flex w-full max-w-[620px] flex-1 flex-col gap-8 px-5 py-10 sm:px-6 sm:py-16">
      <header className="flex items-center justify-between">
        <Logo className="size-12" />
        <Link href="/library" className="text-muted text-sm">
          Library
        </Link>
      </header>

      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-medium sm:text-4xl">Import your bookmarks</h1>
        <p className="text-muted text-base leading-[24px]">
          Bring everything over from Chrome, Safari, Firefox, Pocket, Raindrop or Instapaper. Export
          from there as HTML or CSV, then drop the file here. Nothing is uploaded until you confirm
          — the file is read on this device.
        </p>
      </div>

      {stage.kind === "idle" && (
        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files[0];
            if (file) void readFile(file);
          }}
          className="border-line bg-surface rounded-panel flex flex-col items-center gap-4 border border-dashed px-6 py-12 text-center"
        >
          <p className="text-muted text-base">Drop your export here</p>
          <input
            ref={inputRef}
            type="file"
            accept=".html,.htm,.csv,text/html,text/csv"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void readFile(file);
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="bg-accent text-accent-contrast rounded-full px-5 py-2.5 text-sm font-medium"
          >
            Choose a file
          </button>
        </div>
      )}

      {stage.kind === "parsed" && (
        <div className="border-line bg-surface rounded-panel flex flex-col gap-5 border p-6">
          <div>
            <p className="text-lg font-medium">
              {stage.result.bookmarks.length.toLocaleString()} bookmarks found
            </p>
            <p className="text-muted mt-1 text-sm">
              in {stage.fileName}
              {stage.result.folders.length > 0 &&
                ` · ${stage.result.folders.length} folder${stage.result.folders.length === 1 ? "" : "s"}`}
              {stage.result.skipped > 0 &&
                ` · ${stage.result.skipped} skipped (not saveable links)`}
            </p>
          </div>

          {stage.result.folders.length > 0 && (
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={asSections}
                onChange={(event) => setAsSections(event.target.checked)}
                className="mt-0.5 size-4 accent-[#95ff00]"
              />
              <span>
                Turn folders into sections
                <span className="text-muted block text-[13px]">
                  {stage.result.folders.slice(0, 4).join(", ")}
                  {stage.result.folders.length > 4 &&
                    ` and ${stage.result.folders.length - 4} more`}
                </span>
              </span>
            </label>
          )}

          <p className="text-muted text-[13px] leading-[18px]">
            Anything already in your library is left alone — importing twice will not duplicate it.
          </p>

          <Button onClick={() => void runImport(stage.result)}>
            Import {stage.result.bookmarks.length.toLocaleString()} bookmarks
          </Button>
        </div>
      )}

      {stage.kind === "importing" && (
        <div className="border-line bg-surface rounded-panel flex flex-col gap-4 border p-6">
          <p className="text-base font-medium">
            Importing {stage.done.toLocaleString()} of {stage.total.toLocaleString()}…
          </p>
          <div className="bg-ink h-2 w-full overflow-hidden rounded-full">
            <div
              className="bg-accent h-full rounded-full transition-[width] duration-300"
              style={{ width: `${Math.round((stage.done / stage.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {stage.kind === "done" && (
        <div className="border-line bg-surface rounded-panel flex flex-col gap-4 border p-6">
          <p className="text-lg font-medium">Done</p>
          <p className="text-muted text-base leading-[24px]">
            {stage.imported.toLocaleString()} brought over
            {stage.reused > 0 && `, ${stage.reused.toLocaleString()} already saved`}
            {stage.sectionsCreated > 0 &&
              `, ${stage.sectionsCreated} section${stage.sectionsCreated === 1 ? "" : "s"} created`}
            .
          </p>
          <p className="text-muted text-[13px] leading-[18px]">
            Imported bookmarks have no images yet. Run{" "}
            <code className="bg-ink rounded px-1.5 py-0.5">npm run backfill:thumbnails</code> to
            fetch them.
          </p>
          <Link
            href="/library"
            className="bg-accent text-accent-contrast flex h-12 items-center justify-center rounded-full text-base font-medium"
          >
            Open library
          </Link>
        </div>
      )}

      {error && (
        <p role="alert" className="text-center text-sm text-red-600">
          {error}
        </p>
      )}
    </main>
  );
}

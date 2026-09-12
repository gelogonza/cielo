"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Chip, FieldLabel } from "@/components/ui/chip";
import { detectPlatform } from "@/lib/items/platform";
import type { SharedLink } from "@/lib/share/shared-link";

export function ShareSaveForm({
  sections,
  shared,
}: {
  sections: { id: string; name: string }[];
  shared: SharedLink | null;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(shared?.url ?? "");
  const [tags, setTags] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!url.trim()) {
      setError("Paste a link to save.");
      return;
    }

    setError(null);
    setStatus("saving");

    const response = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: url.trim(),
        title: shared?.title ?? null,
        thumbnailUrl: null,
        contentType: "LINK",
        sourcePlatform: detectPlatform(url),
        sectionIds: selected,
        tagNames: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      }),
    });

    if (!response.ok) {
      setStatus("idle");
      setError("That link could not be saved. Check it and try again.");
      return;
    }

    setStatus("saved");
    router.refresh();
  }

  if (status === "saved") {
    return (
      <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center">
        <Logo className="size-16" />
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-medium">Saved to Cielo</h1>
          <p className="text-muted text-base">It is in your library now.</p>
        </div>
        <div className="flex w-full flex-col gap-3">
          <Link
            href="/library"
            className="bg-accent text-accent-contrast flex h-14 w-full items-center justify-center rounded-full text-lg font-medium"
          >
            Open library
          </Link>
          <button
            type="button"
            onClick={() => {
              setUrl("");
              setTags("");
              setSelected([]);
              setStatus("idle");
            }}
            className="text-muted h-14 text-base"
          >
            Save another
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-6 px-5 py-10 sm:px-6 sm:py-16">
      <header className="flex items-center justify-between">
        <Logo className="size-14" />
        <Link href="/library" className="text-muted text-sm">
          Library
        </Link>
      </header>

      <h1 className="text-3xl font-medium sm:text-4xl">Save to Cielo</h1>

      {shared?.title && <p className="text-muted -mt-2 text-base">{shared.title}</p>}

      <input
        type="url"
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        aria-label="Link to save"
        placeholder="Paste a link"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        className="bg-ink text-secondary-text placeholder:text-muted h-16 w-full rounded-full px-6 text-base outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      />

      {sections.length > 0 && (
        <div className="flex flex-col gap-3">
          <FieldLabel>ADD TO SECTIONS</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {sections.map((section) => (
              <Chip
                key={section.id}
                tone={selected.includes(section.id) ? "selected" : "outline"}
                aria-pressed={selected.includes(section.id)}
                onClick={() =>
                  setSelected((current) =>
                    current.includes(section.id)
                      ? current.filter((id) => id !== section.id)
                      : [...current, section.id],
                  )
                }
              >
                {section.name}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <input
        aria-label="Tags"
        autoCapitalize="none"
        placeholder="Add tags, comma separated"
        value={tags}
        onChange={(event) => setTags(event.target.value)}
        className="bg-ink text-secondary-text placeholder:text-muted h-14 w-full rounded-full px-6 text-base outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      />

      {error && (
        <p role="alert" className="text-center text-sm text-red-400">
          {error}
        </p>
      )}

      <Button onClick={() => void save()} disabled={status === "saving"}>
        {status === "saving" ? "Saving..." : "Save"}
      </Button>

      <p className="text-muted text-center text-[13px] leading-[18px]">
        On Android you can install Cielo and share straight from any app. On iPhone, copy the link
        and paste it here.
      </p>
    </main>
  );
}

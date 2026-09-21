"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip, FieldLabel } from "@/components/ui/chip";
import { Overlay } from "@/components/ui/overlay";
import { detectPlatform } from "@/lib/items/platform";
import type { SerializedItem } from "@/lib/items/serialize";
import {
  ALLOWED_IMAGE_TYPES,
  ITEM_IMAGES_BUCKET,
  MAX_IMAGE_BYTES,
  isAllowedImageType,
  objectKeyFor,
} from "@/lib/storage/item-images";
import { createClient } from "@/lib/supabase/client";

/** Save dialog — Figma node 31:14 (560px wide). */
export function SaveModal({
  sections,
  onClose,
  onSaved,
}: {
  sections: { id: string; name: string }[];
  onClose: () => void;
  onSaved: (item: SerializedItem) => void;
}) {
  const [tab, setTab] = useState<"link" | "quote" | "upload">("link");
  const [quote, setQuote] = useState("");
  const [quoteSource, setQuoteSource] = useState("");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function toggleSection(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  function tagNames() {
    return tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  /** The body for whichever tab is open, or null if it is not ready to save. */
  function buildBody() {
    if (tab === "quote") {
      const text = quote.trim();
      const source = quoteSource.trim();

      if (!text) {
        setError("Write or paste the text you want to keep.");
        return null;
      }

      return {
        // A quote needs no source; Postgres treats a null url as distinct, so
        // each sourceless quote stays its own item.
        url: source ? source : null,
        title: null,
        body: text,
        thumbnailUrl: null,
        contentType: "TEXT",
        sourcePlatform: source ? detectPlatform(source) : null,
        sectionIds: selected,
        tagNames: tagNames(),
      };
    }

    if (!url.trim()) {
      setError("Paste a link to save.");
      return null;
    }

    return {
      url: url.trim(),
      // The server scrapes og:title/og:image when these are null.
      title: null,
      body: null,
      thumbnailUrl: null,
      contentType: "LINK",
      sourcePlatform: detectPlatform(url),
      sectionIds: selected,
      tagNames: tagNames(),
    };
  }

  /**
   * Uploads the file with the user's own Supabase session, then tells the
   * server which key to attach. The image never passes through the app — it
   * goes browser → storage, under a path only this user can write.
   */
  async function saveUpload() {
    if (!file) {
      setError("Choose an image to upload.");
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const supabase = createClient();
      const { data: session } = await supabase.auth.getUser();

      if (!session.user) {
        setError("Your session expired. Log in again.");
        return;
      }

      const objectKey = objectKeyFor(session.user.id, file.type);
      const upload = await supabase.storage
        .from(ITEM_IMAGES_BUCKET)
        .upload(objectKey, file, { contentType: file.type, upsert: false });

      if (upload.error) {
        setError("That image could not be uploaded. Try again.");
        return;
      }

      const response = await fetch("/api/save-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectKey,
          title: file.name.replace(/\.[^.]+$/, "") || null,
          contentType: "IMAGE",
          sectionIds: selected,
          tagNames: tagNames(),
        }),
      });

      if (!response.ok) {
        setError("That image was uploaded but could not be saved. Try again.");
        return;
      }

      onSaved(await response.json());
    } finally {
      setIsSaving(false);
    }
  }

  function chooseFile(next: File | undefined) {
    if (!next) {
      return;
    }

    if (!isAllowedImageType(next.type)) {
      setError("Cielo can keep PNG, JPEG, WebP, GIF and AVIF images.");
      return;
    }

    if (next.size > MAX_IMAGE_BYTES) {
      setError(`That image is larger than ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB.`);
      return;
    }

    setError(null);
    setFile(next);
  }

  async function save() {
    if (tab === "upload") {
      await saveUpload();
      return;
    }

    const payload = buildBody();

    if (!payload) {
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setError(
          tab === "quote"
            ? "That quote could not be saved. Try again."
            : "That link could not be saved. Check it and try again.",
        );
        return;
      }

      onSaved(await response.json());
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Overlay label="Save to Cielo" onClose={onClose}>
      <div className="flex w-full flex-col gap-5 px-5 pt-6 pb-8 sm:w-[560px] sm:max-w-full sm:gap-[22px] sm:px-10 sm:pt-10 sm:pb-9">
        <h2 className="text-secondary-text text-2xl font-medium sm:text-[28px]">Save to Cielo</h2>

        <div role="tablist" className="bg-ink flex h-[54px] gap-1 rounded-full p-[5px]">
          <TabButton active={tab === "link"} onClick={() => setTab("link")}>
            Paste link
          </TabButton>
          <TabButton active={tab === "quote"} onClick={() => setTab("quote")}>
            Quote
          </TabButton>
          <TabButton active={tab === "upload"} onClick={() => setTab("upload")}>
            Upload
          </TabButton>
        </div>

        {tab === "link" ? (
          <input
            type="url"
            aria-label="Link to save"
            placeholder="Paste a link"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void save();
            }}
            className="bg-ink text-secondary-text placeholder:text-muted h-16 w-full rounded-full px-[26px] text-[17px] outline-none focus-visible:ring-2 focus-visible:ring-accent-strong/70"
          />
        ) : tab === "quote" ? (
          <div className="flex flex-col gap-3">
            <textarea
              aria-label="Quote"
              placeholder="Paste or write the text you want to keep"
              value={quote}
              onChange={(event) => setQuote(event.target.value)}
              rows={5}
              className="bg-ink text-secondary-text placeholder:text-muted rounded-field w-full resize-none px-[22px] py-4 text-[15px] leading-[22px] outline-none focus-visible:ring-2 focus-visible:ring-accent-strong/70"
            />
            <input
              type="url"
              aria-label="Source link (optional)"
              placeholder="Where it came from (optional)"
              value={quoteSource}
              onChange={(event) => setQuoteSource(event.target.value)}
              className="bg-ink text-secondary-text placeholder:text-muted h-12 w-full rounded-full px-[22px] text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-accent-strong/70"
            />
          </div>
        ) : (
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              chooseFile(event.dataTransfer.files[0]);
            }}
            className="border-line bg-ink rounded-field flex flex-col items-center gap-3 border border-dashed px-6 py-8 text-center"
          >
            <p className="text-muted text-[15px]">
              {file ? file.name : "Drop an image here"}
            </p>
            <input
              ref={fileInput}
              type="file"
              aria-label="Image to upload"
              accept={ALLOWED_IMAGE_TYPES.join(",")}
              className="sr-only"
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="bg-surface text-primary-text rounded-full px-5 py-2.5 text-sm font-medium"
            >
              {file ? "Choose a different image" : "Choose an image"}
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <FieldLabel>ADD TO SECTIONS</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {sections.map((section) => (
              <Chip
                key={section.id}
                tone={selected.includes(section.id) ? "selected" : "outline"}
                aria-pressed={selected.includes(section.id)}
                onClick={() => toggleSection(section.id)}
              >
                {section.name}
              </Chip>
            ))}
          </div>
        </div>

        <input
          aria-label="Tags"
          placeholder="Add tags, comma separated"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          className="bg-ink text-secondary-text placeholder:text-muted h-14 w-full rounded-full px-[26px] text-base outline-none focus-visible:ring-2 focus-visible:ring-accent-strong/70"
        />

        {error && (
          <p role="alert" className="text-center text-[13px] text-red-400">
            {error}
          </p>
        )}

        <Button onClick={() => void save()} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save"}
        </Button>

        <p className="text-muted text-center text-[13px] leading-[18px]">
          Already saved this link? Cielo adds it to these sections instead of making a duplicate.
        </p>
      </div>
    </Overlay>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex h-full flex-1 items-center justify-center rounded-full text-base transition ${
        active ? "bg-surface text-secondary-text font-medium" : "text-muted"
      }`}
    >
      {children}
    </button>
  );
}

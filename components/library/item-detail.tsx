"use client";

import { useState } from "react";
import { Chip, FieldLabel } from "@/components/ui/chip";
import { Overlay } from "@/components/ui/overlay";
import type { SerializedItem } from "@/lib/items/serialize";
import { sourceLabel } from "@/lib/items/platform";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Item detail overlay — Figma node 27:3 (1100x700, 620px media + 480px meta). */
export function ItemDetailOverlay({
  item,
  allSections,
  onClose,
  onUpdate,
  onDelete,
}: {
  item: SerializedItem;
  allSections: { id: string; name: string }[];
  onClose: () => void;
  /** Persists section/tag changes; resolves with the updated item. */
  onUpdate: (input: { sectionIds?: string[]; tagNames?: string[] }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isPickingSection, setIsPickingSection] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const label = sourceLabel(item.url);
  const unusedSections = allSections.filter(
    (section) => !item.sections.some((current) => current.id === section.id),
  );

  async function run(input: { sectionIds?: string[]; tagNames?: string[] }) {
    setIsBusy(true);
    try {
      await onUpdate(input);
    } finally {
      setIsBusy(false);
    }
  }

  function addTag() {
    const name = newTag.trim();
    setNewTag("");
    setIsAddingTag(false);

    if (name && !item.tags.some((tag) => tag.name === name)) {
      void run({ tagNames: [...item.tags.map((tag) => tag.name), name] });
    }
  }

  return (
    <Overlay label={item.title ?? "Item"} onClose={onClose}>
      <div className="flex w-full flex-col sm:h-[700px] sm:w-[1100px] sm:max-w-full sm:flex-row sm:items-start">
        <div className="bg-media relative aspect-[4/3] w-full shrink-0 overflow-hidden sm:aspect-auto sm:h-full sm:w-[620px] sm:min-w-0 sm:flex-1">
          {item.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- hotlinked, see ItemCard
            <img
              src={item.thumbnailUrl}
              alt={item.title ?? ""}
              referrerPolicy="no-referrer"
              className="size-full object-cover"
            />
          ) : (
            // Same reasoning as the feed's TextCard: a save with no picture
            // should still look deliberate rather than empty.
            <div className="flex size-full flex-col items-center justify-center gap-2 p-10 text-center">
              <p className="text-secondary-text text-xl font-medium">{item.title ?? "Untitled"}</p>
              {label && <p className="text-muted text-sm">{label}</p>}
            </div>
          )}
        </div>

        <div className="flex w-full flex-col gap-5 px-5 pt-6 pb-8 sm:h-full sm:w-[480px] sm:shrink-0 sm:gap-[22px] sm:px-10 sm:pt-10">
          <h2 className="text-secondary-text text-2xl leading-tight font-medium sm:text-[28px] sm:leading-[34px]">
            {item.title ?? "Untitled"}
          </h2>

          <div className="flex items-center gap-2.5">
            {label && <span className="text-muted text-[15px]">{label}</span>}
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-ink text-secondary-text rounded-full px-4 py-2 text-[13px] font-medium"
              >
                Visit original
              </a>
            )}
          </div>

          <hr className="border-divider" />

          <div className="flex flex-col gap-3">
            <FieldLabel>TAGS</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              {item.tags.map((tag) => (
                <Chip
                  key={tag.id}
                  disabled={isBusy}
                  title={`Remove ${tag.name}`}
                  onClick={() =>
                    run({ tagNames: item.tags.filter((t) => t.id !== tag.id).map((t) => t.name) })
                  }
                >
                  {tag.name}
                </Chip>
              ))}

              {isAddingTag ? (
                <input
                  autoFocus
                  aria-label="New tag"
                  value={newTag}
                  onChange={(event) => setNewTag(event.target.value)}
                  onBlur={addTag}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addTag();
                    if (event.key === "Escape") {
                      setNewTag("");
                      setIsAddingTag(false);
                    }
                  }}
                  className="bg-ink text-secondary-text w-28 rounded-full px-3.5 py-2 text-[13px] outline-none"
                />
              ) : (
                <Chip tone="outline" onClick={() => setIsAddingTag(true)}>
                  +&nbsp;&nbsp;Add tag
                </Chip>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <FieldLabel>SECTIONS</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              {item.sections.map((section) => (
                <Chip
                  key={section.id}
                  tone="selected"
                  disabled={isBusy}
                  title={`Remove from ${section.name}`}
                  onClick={() =>
                    run({
                      sectionIds: item.sections.filter((s) => s.id !== section.id).map((s) => s.id),
                    })
                  }
                >
                  {section.name}
                </Chip>
              ))}

              {isPickingSection
                ? unusedSections.map((section) => (
                    <Chip
                      key={section.id}
                      tone="outline"
                      disabled={isBusy}
                      onClick={() => {
                        setIsPickingSection(false);
                        void run({ sectionIds: [...item.sections.map((s) => s.id), section.id] });
                      }}
                    >
                      {section.name}
                    </Chip>
                  ))
                : unusedSections.length > 0 && (
                    <Chip tone="outline" onClick={() => setIsPickingSection(true)}>
                      +&nbsp;&nbsp;Add to section
                    </Chip>
                  )}
            </div>
          </div>

          <NoteField itemId={item.id} initialBody={item.note ?? ""} />

          <div className="hidden flex-1 sm:block" />

          <div className="text-muted flex items-center justify-between text-[13px]">
            <span>Saved {dateFormat.format(new Date(item.savedAt))}</span>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void onDelete()}
              className="font-medium hover:text-white disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

/** Notes save on blur — there is no explicit save control in the design. */
function NoteField({ itemId, initialBody }: { itemId: string; initialBody: string }) {
  const [body, setBody] = useState(initialBody);

  async function persist() {
    if (body === initialBody) {
      return;
    }

    await fetch(`/api/items/${itemId}/note`, {
      method: body.trim() ? "PUT" : "DELETE",
      headers: { "Content-Type": "application/json" },
      ...(body.trim() ? { body: JSON.stringify({ body }) } : {}),
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <FieldLabel>NOTE</FieldLabel>
      <textarea
        aria-label="Note"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onBlur={() => void persist()}
        placeholder="Add a note"
        className="bg-ink text-secondary-text placeholder:text-muted rounded-field h-24 w-full resize-none px-[18px] py-4 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      />
    </div>
  );
}

"use client";

import { useState } from "react";

export interface EditableTag {
  id: string;
  name: string;
  itemCount: number;
}

/**
 * The tag list while it is being edited.
 *
 * Tags normally render as chips, which are too small to carry a menu without
 * either cramping them or shifting the layout on hover. So editing is a mode:
 * the chips become full-width rows, the way sections already look, and go back
 * to chips when you are done. An explicit mode also means a tag can never be
 * deleted by a mis-tap on a filter.
 *
 * No popover, deliberately — the sidebar is an `overflow-auto` column, and a
 * menu anchored to a 60px chip has nowhere to go inside it.
 */
export function TagEditor({
  tags,
  onRename,
  onDelete,
}: {
  tags: EditableTag[];
  onRename: (id: string, name: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
}) {
  return (
    <div className="mt-2.5 flex w-full flex-col gap-1">
      {tags.map((tag) => (
        <TagRow
          key={tag.id}
          tag={tag}
          onRename={(name) => onRename(tag.id, name)}
          onDelete={() => onDelete(tag.id)}
        />
      ))}
    </div>
  );
}

function TagRow({
  tag,
  onRename,
  onDelete,
}: {
  tag: EditableTag;
  onRename: (name: string) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  async function commit() {
    const next = draft?.trim() ?? "";
    setDraft(null);

    if (next && next !== tag.name) {
      await onRename(next);
    }
  }

  if (draft !== null) {
    return (
      <input
        autoFocus
        aria-label={`Rename ${tag.name}`}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") void commit();
          if (event.key === "Escape") setDraft(null);
        }}
        className="bg-ink text-primary-text h-9 w-full rounded-full px-3.5 text-[13px] outline-none"
      />
    );
  }

  if (isConfirming) {
    return (
      <div className="border-line flex flex-col gap-2 rounded-2xl border p-2.5">
        {/* Deleting a tag drops the join rows, not the items. */}
        <p className="text-muted text-[13px] leading-[18px]">
          Delete {tag.name}?{" "}
          {tag.itemCount === 0
            ? "Nothing is tagged with it."
            : `The ${tag.itemCount === 1 ? "item" : `${tag.itemCount} items`} stay in your library.`}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setIsConfirming(false);
              void onDelete();
            }}
            className="bg-ink text-primary-text h-8 flex-1 rounded-full text-[13px] font-medium transition hover:bg-red-50 hover:text-red-700"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => setIsConfirming(false)}
            className="text-muted hover:text-primary-text h-8 flex-1 rounded-full text-[13px] transition"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-ink flex h-9 w-full items-center rounded-full pr-1 pl-3.5">
      <button
        type="button"
        onClick={() => setDraft(tag.name)}
        aria-label={`Rename ${tag.name}`}
        className="text-primary-text flex-1 truncate text-left text-[13px]"
      >
        {tag.name}
      </button>
      <span className="text-muted px-2 text-xs">{tag.itemCount}</span>
      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        aria-label={`Delete ${tag.name}`}
        className="text-muted hover:text-primary-text flex size-7 items-center justify-center rounded-full text-base leading-none transition"
      >
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
  );
}

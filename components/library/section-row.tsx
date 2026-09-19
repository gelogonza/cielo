"use client";

import { useEffect, useRef, useState } from "react";

/**
 * One row in the sidebar's section list.
 *
 * Sections are entirely user-named, so they have to be renameable and
 * deletable — the routes have existed since the start, this is the UI for
 * them. "General" is a computed view over every item rather than a stored
 * section, so it renders through the same row with no `onRename`/`onDelete`
 * and therefore no menu.
 *
 * The menu sits on top of the count rather than beside it: adding a permanent
 * control to every row would widen the mobile chip strip and put a delete
 * button under every thumb, for something you do once a month.
 */
export function SectionRow({
  name,
  count,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  name: string;
  count: number;
  active: boolean;
  onSelect: () => void;
  /** Omitted for "General", which is computed and cannot be edited. */
  onRename?: (name: string) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
}) {
  const [menu, setMenu] = useState<"closed" | "open" | "confirming">("closed");
  const [draft, setDraft] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);

  const editable = Boolean(onRename && onDelete);

  // Clicking anywhere else, or pressing Escape, puts the menu away — including
  // out of the confirm step, so a delete needs a deliberate second click.
  useEffect(() => {
    if (menu === "closed") {
      return;
    }

    const dismiss = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) {
        setMenu("closed");
      }
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu("closed");
    };

    document.addEventListener("mousedown", dismiss);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", dismiss);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  async function commitRename() {
    const next = draft?.trim() ?? "";
    setDraft(null);

    if (next && next !== name) {
      await onRename?.(next);
    }
  }

  if (draft !== null) {
    return (
      <input
        autoFocus
        aria-label={`Rename ${name}`}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commitRename()}
        onKeyDown={(event) => {
          if (event.key === "Enter") void commitRename();
          if (event.key === "Escape") setDraft(null);
        }}
        className="bg-ink text-primary-text rounded-row h-[46px] shrink-0 px-[18px] text-base outline-none lg:w-full"
      />
    );
  }

  return (
    <div ref={container} className="group/row relative shrink-0 lg:w-full">
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "true" : undefined}
        className={`rounded-row flex h-[46px] w-full items-center gap-2 px-[18px] whitespace-nowrap transition lg:justify-between lg:gap-0 ${
          active ? "bg-accent text-accent-contrast" : "text-primary-text hover:bg-ink"
        }`}
      >
        <span className={`text-base ${active ? "font-medium" : ""}`}>{name}</span>
        <span
          className={`text-sm transition ${active ? "" : "text-muted"} ${
            editable ? "lg:group-hover/row:opacity-0 lg:group-focus-within/row:opacity-0" : ""
          }`}
        >
          {count}
        </span>
      </button>

      {editable && (
        <>
          {/* Hidden below lg: the mobile sidebar is a filter strip, and a
              per-chip menu there would be mostly mis-taps. */}
          <button
            type="button"
            aria-label={`Options for ${name}`}
            aria-haspopup="menu"
            aria-expanded={menu !== "closed"}
            onClick={() => setMenu(menu === "closed" ? "open" : "closed")}
            className={`absolute top-1/2 right-[14px] hidden size-7 -translate-y-1/2 items-center justify-center rounded-full text-base leading-none opacity-0 transition focus-visible:opacity-100 group-hover/row:opacity-100 group-focus-within/row:opacity-100 lg:flex ${
              active
                ? "text-accent-contrast hover:bg-black/10"
                : "text-muted hover:text-primary-text hover:bg-black/5"
            } ${menu !== "closed" ? "opacity-100" : ""}`}
          >
            <span aria-hidden="true">···</span>
          </button>

          {menu !== "closed" && (
            <div
              role="menu"
              // Spans the row rather than sizing to its content: the sidebar
              // is an overflow-auto column, so anything wider than the row is
              // clipped at its edge.
              className="border-line bg-surface absolute inset-x-0 top-full z-20 mt-1 rounded-2xl border p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
            >
              {menu === "open" ? (
                <>
                  <MenuItem
                    onClick={() => {
                      setMenu("closed");
                      setDraft(name);
                    }}
                  >
                    Rename
                  </MenuItem>
                  <MenuItem onClick={() => setMenu("confirming")}>Delete</MenuItem>
                </>
              ) : (
                <div className="flex flex-col gap-2.5 px-2.5 py-2">
                  {/* Deleting a section drops the join rows, not the items —
                      say so, or "delete" reads as losing everything in it. */}
                  <p className="text-muted text-[13px] leading-[18px]">
                    Delete {name}?{" "}
                    {count === 0
                      ? "Nothing is filed in it."
                      : count === 1
                        ? "The item in it stays in your library."
                        : `The ${count} items in it stay in your library.`}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMenu("closed");
                        void onDelete?.();
                      }}
                      className="bg-ink text-primary-text h-8 flex-1 rounded-full text-[13px] font-medium transition hover:bg-red-50 hover:text-red-700"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setMenu("closed")}
                      className="text-muted hover:text-primary-text h-8 flex-1 rounded-full text-[13px] transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MenuItem({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="text-primary-text hover:bg-ink flex h-9 w-full items-center rounded-xl px-2.5 text-left text-sm transition"
    >
      {children}
    </button>
  );
}

"use client";

import { useState } from "react";
import { SectionRow } from "./section-row";
import { TagEditor } from "./tag-editor";

export interface SidebarSection {
  id: string;
  name: string;
  itemCount: number;
}

export interface SidebarTag {
  id: string;
  name: string;
  itemCount: number;
}

/**
 * Library sidebar (Figma node 20:9). "General" is a computed view over every
 * item rather than a real section, so it sits above the SECTIONS list.
 *
 * Sections are entirely user-named — there is no automatic classification.
 */
export function Sidebar({
  generalCount,
  sections,
  tags,
  activeSectionId,
  activeTagId,
  onSelectSection,
  onSelectTag,
  onSectionsChanged,
}: {
  generalCount: number;
  sections: SidebarSection[];
  tags: SidebarTag[];
  /** null selects the computed "General" view. */
  activeSectionId: string | null;
  activeTagId: string | null;
  onSelectSection: (id: string | null) => void;
  onSelectTag: (id: string) => void;
  onSectionsChanged: () => void;
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isEditingTags, setIsEditingTags] = useState(false);

  async function createSection() {
    const name = draftName.trim();
    setDraftName("");
    setIsCreating(false);

    if (!name) {
      return;
    }

    await send(
      "/api/sections",
      { method: "POST", body: { name } },
      null,
      "Could not add that section.",
    );
  }

  async function renameSection(id: string, name: string) {
    await send(
      `/api/sections/${id}`,
      { method: "PATCH", body: { name } },
      null,
      "Could not rename that section.",
    );
  }

  async function renameTag(id: string, name: string) {
    // Tags are unique per user, so the 409 here is a real answer, not a
    // failure — say which one it is.
    await send(
      `/api/tags/${id}`,
      { method: "PATCH", body: { name } },
      `You already have a tag called "${name}".`,
      "Could not rename that tag.",
    );
  }

  async function deleteTag(id: string) {
    await send(`/api/tags/${id}`, { method: "DELETE" }, null, "Could not delete that tag.");
  }

  async function deleteSection(id: string) {
    // The feed is still filtered on a section that no longer exists, so fall
    // back to General before the sidebar re-renders without it.
    if (activeSectionId === id) {
      onSelectSection(null);
    }

    await send(`/api/sections/${id}`, { method: "DELETE" }, null, "Could not delete that section.");
  }

  /**
   * Every section write goes through here: refetch on success so the sidebar
   * shows the server's truth rather than an optimistic guess, and say so when
   * it fails instead of appearing to do nothing.
   */
  async function send(
    url: string,
    init: { method: string; body?: unknown },
    conflict: string | null,
    failure: string,
  ) {
    setError(null);

    try {
      const response = await fetch(url, {
        method: init.method,
        ...(init.body
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(init.body),
            }
          : {}),
      });

      if (!response.ok) {
        setError(response.status === 409 && conflict ? conflict : failure);
        return;
      }

      onSectionsChanged();
    } catch {
      setError(failure);
    }
  }

  return (
    <nav
      aria-label="Sections and tags"
      className="bg-surface rounded-panel flex w-full shrink-0 flex-col p-4 lg:h-[830px] lg:w-60 lg:overflow-y-auto lg:px-5 lg:py-6"
    >
      {/* One horizontally scrolling strip on phones; from lg it unfolds into the
          design's vertical list, with General sitting above the SECTIONS label.
          `contents` lets the inner group flatten into the mobile strip. */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-x-visible lg:px-0 lg:pb-0">
        <SectionRow
          name="General"
          count={generalCount}
          active={activeSectionId === null}
          onSelect={() => onSelectSection(null)}
        />

        <p className="text-muted mt-4 hidden pt-1 text-xs font-medium tracking-[1px] lg:block">
          SECTIONS
        </p>

        <div className="contents lg:mt-1.5 lg:flex lg:flex-col lg:gap-1">
          {sections.map((section) => (
            <SectionRow
              key={section.id}
              name={section.name}
              count={section.itemCount}
              active={activeSectionId === section.id}
              onSelect={() => onSelectSection(section.id)}
              onRename={(name) => renameSection(section.id, name)}
              onDelete={() => deleteSection(section.id)}
            />
          ))}

          {isCreating ? (
            <input
              autoFocus
              aria-label="New section name"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={() => void createSection()}
              onKeyDown={(event) => {
                if (event.key === "Enter") void createSection();
                if (event.key === "Escape") {
                  setDraftName("");
                  setIsCreating(false);
                }
              }}
              placeholder="Section name"
              className="bg-ink text-primary-text placeholder:text-muted rounded-row h-[46px] shrink-0 px-[18px] text-base outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="text-muted hover:text-primary-text rounded-row flex h-[46px] shrink-0 items-center px-[18px] text-base whitespace-nowrap transition"
            >
              +&nbsp;&nbsp;New section
            </button>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-2 px-[18px] text-[13px] text-red-600">
          {error}
        </p>
      )}

      <a
        href="/import"
        className="text-muted hover:text-primary-text rounded-row mt-2 hidden h-[38px] shrink-0 items-center px-[18px] text-sm transition lg:flex"
      >
        Import and export
      </a>

      <div className="mt-4 flex items-center justify-between lg:mt-6 lg:pt-1">
        <p className="text-muted text-xs font-medium tracking-[1px]">TAGS</p>
        {tags.length > 0 && (
          <button
            type="button"
            onClick={() => setIsEditingTags((editing) => !editing)}
            className="text-muted hover:text-primary-text text-xs transition"
          >
            {isEditingTags ? "Done" : "Edit"}
          </button>
        )}
      </div>

      {isEditingTags ? (
        <TagEditor tags={tags} onRename={renameTag} onDelete={deleteTag} />
      ) : (
        <div className="-mx-1 mt-2.5 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-x-visible lg:px-0 lg:pb-0">
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => onSelectTag(tag.id)}
              aria-pressed={activeTagId === tag.id}
              className={`shrink-0 rounded-full px-3.5 py-[7px] text-[13px] whitespace-nowrap transition ${
                activeTagId === tag.id
                  ? "bg-accent text-accent-contrast"
                  : "bg-ink text-secondary-text hover:text-white"
              }`}
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}

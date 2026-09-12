"use client";

import { useState } from "react";

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

  async function createSection() {
    const name = draftName.trim();
    setDraftName("");
    setIsCreating(false);

    if (!name) {
      return;
    }

    const response = await fetch("/api/sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (response.ok) {
      onSectionsChanged();
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

      <p className="text-muted mt-4 text-xs font-medium tracking-[1px] lg:mt-6 lg:pt-1">TAGS</p>

      <div className="-mx-1 mt-2.5 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-x-visible lg:px-0 lg:pb-0">
        {tags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            onClick={() => onSelectTag(tag.id)}
            aria-pressed={activeTagId === tag.id}
            className={`shrink-0 rounded-full px-3.5 py-[7px] text-[13px] whitespace-nowrap transition ${
              activeTagId === tag.id
                ? "bg-white text-accent-contrast"
                : "bg-ink text-secondary-text hover:text-white"
            }`}
          >
            {tag.name}
          </button>
        ))}
      </div>
    </nav>
  );
}

function SectionRow({
  name,
  count,
  active,
  onSelect,
}: {
  name: string;
  count: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={`rounded-row flex h-[46px] shrink-0 items-center gap-2 px-[18px] whitespace-nowrap transition lg:w-full lg:justify-between lg:gap-0 ${
        active ? "bg-accent text-accent-contrast" : "text-primary-text hover:bg-ink"
      }`}
    >
      <span className={`text-base ${active ? "font-medium" : ""}`}>{name}</span>
      <span className={`text-sm ${active ? "" : "text-muted"}`}>{count}</span>
    </button>
  );
}

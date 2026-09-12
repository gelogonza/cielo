import { describe, expect, it } from "vitest";
import { GENERAL, resolveDefaultSection } from "@/extension/src/lib/default-section.js";

const sections = [
  { id: "section-1", name: "Inspo" },
  { id: "section-2", name: "Workout" },
];

describe("resolveDefaultSection", () => {
  it("defaults to General when nothing was chosen", () => {
    expect(resolveDefaultSection(null, sections)).toEqual(GENERAL);
    expect(resolveDefaultSection(undefined, sections)).toEqual(GENERAL);
  });

  it("resolves a stored id to the live section", () => {
    expect(resolveDefaultSection("section-2", sections)).toEqual({
      id: "section-2",
      name: "Workout",
    });
  });

  it("picks up a rename made in the web app", () => {
    expect(resolveDefaultSection("section-1", [{ id: "section-1", name: "Renamed" }])).toEqual({
      id: "section-1",
      name: "Renamed",
    });
  });

  it("falls back to General when the section was deleted", () => {
    expect(resolveDefaultSection("section-gone", sections)).toEqual(GENERAL);
  });

  it("falls back to General when the sections list could not be loaded", () => {
    expect(resolveDefaultSection("section-1", [])).toEqual(GENERAL);
  });

  it("never reports General as a real section id", () => {
    expect(resolveDefaultSection(null, sections).id).toBeNull();
  });
});

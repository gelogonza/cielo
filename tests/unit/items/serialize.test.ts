import { describe, expect, it } from "vitest";
import { serializeItem } from "@/lib/items/serialize";

const base = {
  id: "item-1",
  url: "https://are.na/block/1",
  title: "Poster archive",
  body: null,
  thumbnailUrl: "https://cdn.test/thumb.jpg",
  contentType: "LINK" as const,
  sourceType: "WEB" as const,
  sourcePlatform: "web",
  savedAt: new Date("2026-08-12T10:30:00.000Z"),
  sections: [{ section: { id: "section-1", name: "Type" } }],
  tags: [{ tag: { id: "tag-1", name: "poster" } }],
};

describe("serializeItem", () => {
  it("flattens join rows into plain section and tag lists", () => {
    expect(serializeItem(base)).toMatchObject({
      sections: [{ id: "section-1", name: "Type" }],
      tags: [{ id: "tag-1", name: "poster" }],
    });
  });

  it("renders savedAt as an ISO string for the wire", () => {
    expect(serializeItem(base).savedAt).toBe("2026-08-12T10:30:00.000Z");
  });

  it("omits note entirely when the relation was not loaded", () => {
    expect(serializeItem(base)).not.toHaveProperty("note");
  });

  it("unwraps a loaded note to its body", () => {
    expect(serializeItem({ ...base, note: { body: "Reference for grid" } }).note).toBe(
      "Reference for grid",
    );
  });

  it("carries a highlight's captured text on the wire", () => {
    expect(serializeItem({ ...base, body: "Remember everything. Organize nothing." }).body).toBe(
      "Remember everything. Organize nothing.",
    );
  });

  it("reports body as null for a save that is not a highlight", () => {
    expect(serializeItem(base).body).toBeNull();
  });

  it("reports a loaded-but-absent note as null", () => {
    expect(serializeItem({ ...base, note: null }).note).toBeNull();
  });
});

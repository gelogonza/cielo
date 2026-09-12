import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakePrisma } from "./fake-prisma";

/**
 * End-to-end coverage of the flows the library screen depends on, running the
 * real route handlers and real services against an in-memory database.
 */
const db = new FakePrisma();
let currentUser: { id: string; email: string } | null = { id: "user-1", email: "a@example.test" };

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: async () => currentUser }));
vi.mock("@/lib/scrape/scrape-url", () => ({
  scrapeUrl: async (url: string) => ({ title: `Scraped ${url}`, thumbnailUrl: null }),
}));

const { POST: save } = await import("@/app/api/save/route");
const { GET: listItems } = await import("@/app/api/items/route");
const {
  GET: getItem,
  PATCH: patchItem,
  DELETE: deleteItem,
} = await import("@/app/api/items/[id]/route");
const { PUT: putNote } = await import("@/app/api/items/[id]/note/route");
const { GET: listSections, POST: createSection } = await import("@/app/api/sections/route");
const { GET: listTags } = await import("@/app/api/tags/route");

function json(url: string, method: string, body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function saveLink(url: string, overrides: Record<string, unknown> = {}) {
  const response = await save(
    json("/api/save", "POST", {
      url,
      contentType: "LINK",
      sourcePlatform: "web",
      ...overrides,
    }),
    {},
  );
  return { status: response.status, body: await response.json() };
}

async function feed(query = "") {
  const response = await listItems(json(`/api/items${query}`, "GET"), {});
  return { status: response.status, body: await response.json() };
}

beforeEach(() => {
  Object.assign(db, new FakePrisma());
  currentUser = { id: "user-1", email: "a@example.test" };
});

describe("save → feed", () => {
  it("a saved link appears in the General feed", async () => {
    const saved = await saveLink("https://are.na/block/1");
    expect(saved.status).toBe(201);

    const { body } = await feed();

    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ id: saved.body.id, url: "https://are.na/block/1" });
  });

  it("scrapes a title when the caller supplies none", async () => {
    await saveLink("https://are.na/block/1");

    const { body } = await feed();
    expect(body.items[0].title).toBe("Scraped https://are.na/block/1");
  });

  it("re-saving the same url reuses the item instead of duplicating it", async () => {
    const first = await saveLink("https://are.na/block/1");
    const second = await saveLink("https://are.na/block/1");

    expect(second.body.reused).toBe(true);
    expect(second.body.id).toBe(first.body.id);

    const { body } = await feed();
    expect(body.items).toHaveLength(1);
  });

  it("re-saving adds the new sections rather than replacing them", async () => {
    const type = await (
      await createSection(json("/api/sections", "POST", { name: "Type" }), {})
    ).json();
    const film = await (
      await createSection(json("/api/sections", "POST", { name: "Film" }), {})
    ).json();

    await saveLink("https://are.na/block/1", { sectionIds: [type.id] });
    await saveLink("https://are.na/block/1", { sectionIds: [film.id] });

    const { body } = await feed();
    expect(body.items[0].sections.map((s: { name: string }) => s.name).sort()).toEqual([
      "Film",
      "Type",
    ]);
  });

  it("returns items newest-first", async () => {
    await saveLink("https://are.na/block/1");
    await saveLink("https://are.na/block/2");

    const { body } = await feed();
    expect(body.items.map((item: { url: string }) => item.url)).toEqual([
      "https://are.na/block/2",
      "https://are.na/block/1",
    ]);
  });
});

describe("sections are user-named, never inferred", () => {
  it("a new section starts empty and fills only when items are saved to it", async () => {
    const section = await (
      await createSection(json("/api/sections", "POST", { name: "Workout" }), {})
    ).json();

    let sections = await (await listSections(json("/api/sections", "GET"), {})).json();
    expect(sections.sections).toContainEqual({ id: section.id, name: "Workout", itemCount: 0 });

    await saveLink("https://are.na/block/1", { sectionIds: [section.id] });

    sections = await (await listSections(json("/api/sections", "GET"), {})).json();
    expect(sections.sections[0].itemCount).toBe(1);
  });

  it("filtering by section returns only that section's items", async () => {
    const inspo = await (
      await createSection(json("/api/sections", "POST", { name: "Inspo" }), {})
    ).json();

    await saveLink("https://are.na/block/1", { sectionIds: [inspo.id] });
    await saveLink("https://are.na/block/2");

    const filtered = await feed(`?sectionId=${inspo.id}`);
    expect(filtered.body.items).toHaveLength(1);
    expect(filtered.body.items[0].url).toBe("https://are.na/block/1");

    const general = await feed();
    expect(general.body.items).toHaveLength(2);
  });

  it("an item saved to no section is still visible in General", async () => {
    await saveLink("https://are.na/block/1");

    const { body } = await feed();
    expect(body.items[0].sections).toEqual([]);
  });
});

describe("tags", () => {
  it("reuses an existing tag rather than creating a duplicate", async () => {
    await saveLink("https://are.na/block/1", { tagNames: ["poster"] });
    await saveLink("https://are.na/block/2", { tagNames: ["poster"] });

    const tags = await (await listTags(json("/api/tags", "GET"), {})).json();

    expect(tags.tags).toHaveLength(1);
    expect(tags.tags[0]).toMatchObject({ name: "poster", itemCount: 2 });
  });

  it("filters the feed by tag", async () => {
    await saveLink("https://are.na/block/1", { tagNames: ["poster"] });
    await saveLink("https://are.na/block/2", { tagNames: ["film"] });

    const tags = await (await listTags(json("/api/tags", "GET"), {})).json();
    const poster = tags.tags.find((tag: { name: string }) => tag.name === "poster");

    const { body } = await feed(`?tagId=${poster.id}`);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].url).toBe("https://are.na/block/1");
  });
});

describe("pagination", () => {
  it("walks every item exactly once across pages", async () => {
    for (let index = 0; index < 5; index += 1) {
      await saveLink(`https://are.na/block/${index}`);
    }

    const first = await feed("?limit=2");
    expect(first.body.items).toHaveLength(2);

    const second = await feed(`?limit=2&cursor=${first.body.nextCursor}`);
    const third = await feed(`?limit=2&cursor=${second.body.nextCursor}`);

    const seen = [...first.body.items, ...second.body.items, ...third.body.items].map(
      (item: { url: string }) => item.url,
    );

    expect(new Set(seen).size).toBe(5);
    expect(third.body.nextCursor).toBeNull();
  });
});

describe("item detail editing", () => {
  it("attaches and then detaches a section from the detail panel", async () => {
    const section = await (
      await createSection(json("/api/sections", "POST", { name: "Type" }), {})
    ).json();
    const saved = await saveLink("https://are.na/block/1");

    const attached = await patchItem(
      json(`/api/items/${saved.body.id}`, "PATCH", { sectionIds: [section.id] }),
      ctx(saved.body.id),
    );
    expect((await attached.json()).sections).toEqual([{ id: section.id, name: "Type" }]);

    const detached = await patchItem(
      json(`/api/items/${saved.body.id}`, "PATCH", { sectionIds: [] }),
      ctx(saved.body.id),
    );
    expect((await detached.json()).sections).toEqual([]);
  });

  it("stores a note and returns it with the item", async () => {
    const saved = await saveLink("https://are.na/block/1");

    await putNote(
      json(`/api/items/${saved.body.id}/note`, "PUT", { body: "Grid reference" }),
      ctx(saved.body.id),
    );

    const detail = await getItem(json(`/api/items/${saved.body.id}`, "GET"), ctx(saved.body.id));
    expect((await detail.json()).note).toBe("Grid reference");
  });

  it("replaces rather than duplicates a note on a second edit", async () => {
    const saved = await saveLink("https://are.na/block/1");

    await putNote(
      json(`/api/items/${saved.body.id}/note`, "PUT", { body: "first" }),
      ctx(saved.body.id),
    );
    await putNote(
      json(`/api/items/${saved.body.id}/note`, "PUT", { body: "second" }),
      ctx(saved.body.id),
    );

    const detail = await getItem(json(`/api/items/${saved.body.id}`, "GET"), ctx(saved.body.id));
    expect((await detail.json()).note).toBe("second");
    expect(db.notes).toHaveLength(1);
  });

  it("removes the item from the feed once deleted", async () => {
    const saved = await saveLink("https://are.na/block/1");

    const response = await deleteItem(
      json(`/api/items/${saved.body.id}`, "DELETE"),
      ctx(saved.body.id),
    );
    expect(response.status).toBe(204);

    const { body } = await feed();
    expect(body.items).toHaveLength(0);
  });
});

describe("tenant isolation", () => {
  it("never shows one user's items to another", async () => {
    await saveLink("https://are.na/block/1");

    currentUser = { id: "user-2", email: "b@example.test" };

    const { body } = await feed();
    expect(body.items).toHaveLength(0);
  });

  it("refuses to attach an item to a section owned by someone else", async () => {
    const section = await (
      await createSection(json("/api/sections", "POST", { name: "Private" }), {})
    ).json();

    currentUser = { id: "user-2", email: "b@example.test" };
    const saved = await saveLink("https://are.na/block/1", { sectionIds: [section.id] });

    expect(saved.body.sections).toEqual([]);
  });

  it("will not let another user delete an item", async () => {
    const saved = await saveLink("https://are.na/block/1");

    currentUser = { id: "user-2", email: "b@example.test" };
    const response = await deleteItem(
      json(`/api/items/${saved.body.id}`, "DELETE"),
      ctx(saved.body.id),
    );

    expect(response.status).toBe(404);
  });

  it("rejects every library route without a session", async () => {
    currentUser = null;

    expect((await feed()).status).toBe(401);
    expect((await listSections(json("/api/sections", "GET"), {})).status).toBe(401);
  });
});

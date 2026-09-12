import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const user = { id: "user-1", email: "person@example.com" };
const getSessionUser = vi.fn(async () => user);
const saveLink = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("@/lib/items/item-service", () => ({ itemService: { saveLink } }));

const { POST } = await import("@/app/api/save/route");

function request(body: unknown) {
  return new NextRequest("http://localhost/api/save", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const validBody = {
  url: "https://example.com/post",
  title: "A post",
  thumbnailUrl: "https://example.com/thumb.jpg",
  contentType: "LINK",
  sourcePlatform: "web",
  sectionIds: ["section-1"],
  tagNames: ["inspo"],
};

const savedItem = {
  id: "item-1",
  url: validBody.url,
  title: validBody.title,
  thumbnailUrl: validBody.thumbnailUrl,
  contentType: "LINK",
  sourceType: "WEB",
  sourcePlatform: "web",
  savedAt: new Date("2026-01-01"),
  sections: [{ section: { id: "section-1", name: "Design" } }],
  tags: [{ tag: { id: "tag-1", name: "inspo" } }],
};

describe("POST /api/save", () => {
  beforeEach(() => {
    saveLink.mockReset();
  });

  it("saves a link and returns 201 with flattened sections/tags", async () => {
    saveLink.mockResolvedValue({ item: savedItem, reused: false });

    const response = await POST(request(validBody), {});

    expect(saveLink).toHaveBeenCalledWith("user-1", {
      url: validBody.url,
      title: validBody.title,
      thumbnailUrl: validBody.thumbnailUrl,
      body: null,
      contentType: "LINK",
      sourcePlatform: "web",
      sectionIds: ["section-1"],
      tagNames: ["inspo"],
    });
    expect(response.status).toBe(201);

    const json = await response.json();
    expect(json.sections).toEqual([{ id: "section-1", name: "Design" }]);
    expect(json.tags).toEqual([{ id: "tag-1", name: "inspo" }]);
    expect(json.reused).toBe(false);
  });

  it("returns 201 with reused:true when the item already existed", async () => {
    saveLink.mockResolvedValue({ item: savedItem, reused: true });

    const response = await POST(request(validBody), {});

    expect(response.status).toBe(201);
    expect((await response.json()).reused).toBe(true);
  });

  it("defaults sectionIds and tagNames to empty arrays when omitted", async () => {
    saveLink.mockResolvedValue({ item: savedItem, reused: false });

    const { sectionIds, tagNames, ...withoutJoins } = validBody;
    void sectionIds;
    void tagNames;

    await POST(request(withoutJoins), {});

    expect(saveLink).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ sectionIds: [], tagNames: [] }),
    );
  });

  it("returns 400 without calling the service when url is missing", async () => {
    const { url, ...withoutUrl } = validBody;
    void url;

    const response = await POST(request(withoutUrl), {});

    expect(response.status).toBe(400);
    expect(saveLink).not.toHaveBeenCalled();
  });

  it("returns 422 without calling the service when contentType is invalid", async () => {
    const response = await POST(request({ ...validBody, contentType: "NOT_A_TYPE" }), {});

    expect(response.status).toBe(422);
    expect(saveLink).not.toHaveBeenCalled();
  });

  it("returns 400 when both url and contentType are invalid", async () => {
    const { url, ...rest } = validBody;
    void url;

    const response = await POST(request({ ...rest, contentType: "NOT_A_TYPE" }), {});

    expect(response.status).toBe(400);
    expect(saveLink).not.toHaveBeenCalled();
  });
});

describe("POST /api/save — highlights", () => {
  beforeEach(() => {
    // Without its own reset this block inherits call counts from the tests
    // above, and the "never called" assertions pass or fail by accident.
    saveLink.mockReset();
    saveLink.mockResolvedValue({ item: savedItem, reused: false });
  });

  it("accepts a quote with no source url", async () => {
    // A highlight saved from the web app need not come from anywhere.
    const response = await POST(
      request({
        url: null,
        body: "Remember everything. Organize nothing.",
        contentType: "TEXT",
      }),
      {},
    );

    expect(response.status).toBe(201);
    expect(saveLink).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ url: null, contentType: "TEXT" }),
    );
  });

  it("rejects a non-TEXT save with no url", async () => {
    const response = await POST(request({ url: null, contentType: "LINK" }), {});

    expect(response.status).toBe(400);
    expect(saveLink).not.toHaveBeenCalled();
  });

  it("rejects a TEXT save with no body — there would be nothing to keep", async () => {
    const response = await POST(
      request({ url: "https://example.com/p", contentType: "TEXT", body: null }),
      {},
    );

    expect(response.status).toBe(400);
    expect(saveLink).not.toHaveBeenCalled();
  });

  it("still answers 400 when the url is missing and contentType is invalid", async () => {
    // Zod stops before the object refinements here, so this is checked directly.
    const response = await POST(request({ url: null, contentType: "NOPE" }), {});

    expect(response.status).toBe(400);
  });
});

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const user = { id: "user-1", email: "person@example.com" };
const getSessionUser = vi.fn(async () => user as typeof user | null);
const get = vi.fn();
const download = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("@/lib/items/item-service", () => ({ itemService: { get } }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ storage: { from: () => ({ download }) } }),
}));

const { GET } = await import("@/app/api/items/[id]/image/route");

function request() {
  return GET(new NextRequest("http://localhost/api/items/item-1/image"), {
    params: Promise.resolve({ id: "item-1" }),
  });
}

const uploaded = {
  id: "item-1",
  thumbnailUrl: "user-1/abc.png",
  sourceType: "DIRECT",
};

beforeEach(() => {
  getSessionUser.mockResolvedValue(user);
  get.mockReset();
  download.mockReset();

  get.mockResolvedValue(uploaded);
  download.mockResolvedValue({ data: new Blob(["png bytes"], { type: "image/png" }), error: null });
});

describe("GET /api/items/:id/image", () => {
  it("streams the object the item points at", async () => {
    const response = await request();

    expect(get).toHaveBeenCalledWith("user-1", "item-1");
    expect(download).toHaveBeenCalledWith("user-1/abc.png");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(await response.text()).toBe("png bytes");
  });

  it("lets the browser cache it, but never a shared cache", async () => {
    // Immutable because a new upload gets a new uuid — private because it is
    // the user's own image.
    const cacheControl = (await request()).headers.get("Cache-Control");

    expect(cacheControl).toContain("private");
    expect(cacheControl).toContain("immutable");
  });

  it("404s for an item that is not an upload", async () => {
    get.mockResolvedValue({ id: "item-1", thumbnailUrl: "https://cdn.test/x.jpg", sourceType: "WEB" });

    expect((await request()).status).toBe(404);
    expect(download).not.toHaveBeenCalled();
  });

  it("404s for an item that is not this user's, because the lookup is scoped", async () => {
    get.mockResolvedValue(null);

    expect((await request()).status).toBe(404);
    expect(download).not.toHaveBeenCalled();
  });

  it("refuses to read a key outside the user's own folder", async () => {
    get.mockResolvedValue({ ...uploaded, thumbnailUrl: "user-2/abc.png" });

    expect((await request()).status).toBe(404);
    expect(download).not.toHaveBeenCalled();
  });

  it("404s when the row survives but the object is gone", async () => {
    download.mockResolvedValue({ data: null, error: { message: "Object not found" } });

    expect((await request()).status).toBe(404);
  });

  it("returns 401 without a session and reads nothing", async () => {
    getSessionUser.mockResolvedValue(null);

    expect((await request()).status).toBe(401);
    expect(get).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
  });
});

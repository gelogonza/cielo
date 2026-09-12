import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const user = { id: "user-1", email: "person@example.com" };
const getSessionUser = vi.fn(async () => user as typeof user | null);
const setNote = vi.fn();
const removeNote = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("@/lib/items/item-service", () => ({ itemService: { setNote, removeNote } }));

const { PUT, DELETE } = await import("@/app/api/items/[id]/note/route");

const context = { params: Promise.resolve({ id: "item-1" }) };

function putRequest(body: unknown) {
  return new NextRequest("http://localhost/api/items/item-1/note", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  getSessionUser.mockResolvedValue(user);
  setNote.mockReset();
  removeNote.mockReset();
});

describe("PUT /api/items/:id/note", () => {
  it("returns the stored note in the contract's shape", async () => {
    setNote.mockResolvedValue({
      id: "note-1",
      itemId: "item-1",
      body: "Grid reference",
      createdAt: new Date("2026-08-12T10:00:00.000Z"),
    });

    const response = await PUT(putRequest({ body: "Grid reference" }), context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "note-1",
      itemId: "item-1",
      body: "Grid reference",
      createdAt: "2026-08-12T10:00:00.000Z",
    });
  });

  it("rejects a body that is not a string", async () => {
    const response = await PUT(putRequest({ body: 42 }), context);

    expect(response.status).toBe(400);
    expect(setNote).not.toHaveBeenCalled();
  });

  it("returns 404 when the item is not the caller's", async () => {
    setNote.mockResolvedValue(null);

    expect((await PUT(putRequest({ body: "x" }), context)).status).toBe(404);
  });
});

describe("DELETE /api/items/:id/note", () => {
  it("returns 204 once the note is gone", async () => {
    removeNote.mockResolvedValue(true);

    const response = await DELETE(
      new NextRequest("http://localhost/api/items/item-1/note"),
      context,
    );

    expect(response.status).toBe(204);
  });

  it("returns 404 when there was no note to remove", async () => {
    removeNote.mockResolvedValue(false);

    const response = await DELETE(
      new NextRequest("http://localhost/api/items/item-1/note"),
      context,
    );

    expect(response.status).toBe(404);
  });
});

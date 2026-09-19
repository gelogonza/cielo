import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const user = { id: "user-1", email: "person@example.com" };
const getSessionUser = vi.fn(async () => user);
const list = vi.fn();
const create = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("@/lib/sections/section-service", () => ({ sectionService: { list, create } }));

const { GET, POST } = await import("@/app/api/sections/route");

describe("GET /api/sections", () => {
  it("returns the sections for the authenticated user", async () => {
    list.mockResolvedValue([{ id: "section-1", name: "Design", itemCount: 2 }]);

    const response = await GET(new NextRequest("http://localhost/api/sections"), {});

    expect(list).toHaveBeenCalledWith("user-1");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      sections: [{ id: "section-1", name: "Design", itemCount: 2 }],
    });
  });
});

describe("POST /api/sections", () => {
  beforeEach(() => {
    create.mockReset();
  });

  function post(name: string) {
    return POST(
      new NextRequest("http://localhost/api/sections", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
      {},
    );
  }

  const section = { id: "section-1", name: "Design", createdAt: new Date() };

  it("creates a section and returns 201", async () => {
    create.mockResolvedValue({ section, created: true });

    const response = await post("Design");

    expect(create).toHaveBeenCalledWith("user-1", "Design");
    expect(response.status).toBe(201);
  });

  it("answers 200 with the existing section when that name is already taken", async () => {
    // Find-or-create, like tags — typing a name you already have should not
    // leave you with two sections that look identical.
    create.mockResolvedValue({ section, created: false });

    const response = await post("Design");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: "section-1", name: "Design" });
  });

  it("returns 400 without calling the service when name is missing", async () => {
    const request = new NextRequest("http://localhost/api/sections", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request, {});

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
});

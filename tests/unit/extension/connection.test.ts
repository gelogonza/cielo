import { describe, expect, it, vi } from "vitest";
import { describeConnection, probeApi } from "@/extension/src/lib/connection.js";

describe("probeApi", () => {
  it("asks the one route that proves Cielo is there", async () => {
    const fetchImpl = vi.fn(async () => ({ status: 200 }));

    await probeApi("https://cielo.app", fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith("https://cielo.app/api/sections", {
      credentials: "include",
    });
  });

  it("reports the status it got", async () => {
    const fetchImpl = vi.fn(async () => ({ status: 401 }));

    await expect(probeApi("https://cielo.app", fetchImpl)).resolves.toEqual({
      reached: true,
      status: 401,
    });
  });

  it("does not throw when nothing is there", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });

    await expect(probeApi("https://nope.test", fetchImpl)).resolves.toEqual({
      reached: false,
      status: 0,
    });
  });
});

describe("describeConnection", () => {
  it("treats 401 as success, because it still proves Cielo is there", () => {
    // The point of the check is the address, not the session — and these two
    // are indistinguishable from the toolbar otherwise.
    expect(describeConnection({ reached: true, status: 401 })).toEqual({
      tone: "ok",
      message: "Found Cielo. Log in there to start saving.",
    });
  });

  it("says so when you are already signed in", () => {
    expect(describeConnection({ reached: true, status: 200 }).tone).toBe("ok");
  });

  it("distinguishes a wrong address from a dead one", () => {
    expect(describeConnection({ reached: false, status: 0 })).toEqual({
      tone: "error",
      message: "Nothing answered at that address.",
    });

    const wrongSite = describeConnection({ reached: true, status: 404 });
    expect(wrongSite.tone).toBe("error");
    expect(wrongSite.message).toContain("404");
  });

  it("treats a server error as a failure, not a pass", () => {
    expect(describeConnection({ reached: true, status: 500 }).tone).toBe("error");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_API_BASE_URL,
  getApiBaseUrl,
  normalizeBaseUrl,
  setApiBaseUrl,
} from "@/extension/src/lib/config.js";

/** Minimal `chrome.storage.local` double — the only chrome API config uses. */
function stubStorage(initial: Record<string, unknown> = {}) {
  const store = { ...initial };

  const local = {
    get: vi.fn(async (key: string) => (key in store ? { [key]: store[key] } : {})),
    set: vi.fn(async (values: Record<string, unknown>) => {
      Object.assign(store, values);
    }),
  };

  vi.stubGlobal("chrome", { storage: { local } });
  return { store, local };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("normalizeBaseUrl", () => {
  it("keeps an origin it is already given", () => {
    expect(normalizeBaseUrl("https://cielo.app")).toBe("https://cielo.app");
    expect(normalizeBaseUrl("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("assumes https for a bare host, because a deployment is the common case", () => {
    expect(normalizeBaseUrl("cielo.app")).toBe("https://cielo.app");
    expect(normalizeBaseUrl("cielo.vercel.app")).toBe("https://cielo.vercel.app");
  });

  it("assumes http for a loopback host, because a dev server is not on https", () => {
    // "localhost:3000" looks like a scheme to a naive parser; it is not.
    expect(normalizeBaseUrl("localhost:3000")).toBe("http://localhost:3000");
    expect(normalizeBaseUrl("127.0.0.1:3000")).toBe("http://127.0.0.1:3000");
  });

  it("drops the path, query and hash — every caller appends its own path", () => {
    expect(normalizeBaseUrl("https://cielo.app/library?q=1#x")).toBe("https://cielo.app");
    expect(normalizeBaseUrl("cielo.app/library")).toBe("https://cielo.app");
  });

  it("drops a trailing slash so the joined URL never doubles it", () => {
    expect(normalizeBaseUrl("https://cielo.app/")).toBe("https://cielo.app");
  });

  it("keeps a non-default port", () => {
    expect(normalizeBaseUrl("https://cielo.app:8443")).toBe("https://cielo.app:8443");
  });

  it("ignores surrounding whitespace from a paste", () => {
    expect(normalizeBaseUrl("  https://cielo.app  ")).toBe("https://cielo.app");
  });

  it("rejects a scheme the extension cannot fetch over", () => {
    expect(normalizeBaseUrl("ftp://cielo.app")).toBeNull();
    expect(normalizeBaseUrl("file:///Users/me/cielo")).toBeNull();
    expect(normalizeBaseUrl("javascript://cielo.app")).toBeNull();
  });

  it("rejects empty and non-string input", () => {
    expect(normalizeBaseUrl("")).toBeNull();
    expect(normalizeBaseUrl("   ")).toBeNull();
    expect(normalizeBaseUrl(undefined)).toBeNull();
    expect(normalizeBaseUrl(null)).toBeNull();
    expect(normalizeBaseUrl(42)).toBeNull();
  });
});

describe("getApiBaseUrl", () => {
  it("returns the stored origin", async () => {
    stubStorage({ apiBaseUrl: "https://cielo.app" });
    await expect(getApiBaseUrl()).resolves.toBe("https://cielo.app");
  });

  it("falls back to the dev server when nothing is stored", async () => {
    stubStorage();
    await expect(getApiBaseUrl()).resolves.toBe(DEFAULT_API_BASE_URL);
  });

  it("falls back rather than returning a stored value that is no longer valid", async () => {
    stubStorage({ apiBaseUrl: "not a url" });
    await expect(getApiBaseUrl()).resolves.toBe(DEFAULT_API_BASE_URL);
  });

  it("falls back when storage itself throws", async () => {
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async () => {
            throw new Error("no storage");
          }),
        },
      },
    });

    await expect(getApiBaseUrl()).resolves.toBe(DEFAULT_API_BASE_URL);
  });
});

describe("setApiBaseUrl", () => {
  it("stores the normalized origin, not the raw input", async () => {
    const { store, local } = stubStorage();

    await expect(setApiBaseUrl("  cielo.app/library  ")).resolves.toBe("https://cielo.app");
    expect(local.set).toHaveBeenCalledWith({ apiBaseUrl: "https://cielo.app" });
    expect(store.apiBaseUrl).toBe("https://cielo.app");
  });

  it("writes nothing when the input is not a usable address", async () => {
    const { local } = stubStorage();

    await expect(setApiBaseUrl("ftp://cielo.app")).resolves.toBeNull();
    expect(local.set).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vitest";
import { resolvePopupState } from "@/extension/src/lib/popup-state.js";

describe("resolvePopupState", () => {
  it("prompts for login when there is no session cookie", () => {
    expect(resolvePopupState({ signedIn: false })).toEqual({ kind: "signed-out" });
  });

  it("prompts for login when a save came back 401, even with a cookie present", () => {
    // A stale cookie can outlive the session it stands for.
    expect(resolvePopupState({ signedIn: true, outcome: { status: "signed_out" } })).toEqual({
      kind: "signed-out",
    });
  });

  it("falls back to ready when signed in with nothing saved yet", () => {
    expect(resolvePopupState({ signedIn: true })).toEqual({ kind: "ready" });
    expect(resolvePopupState({ signedIn: true, outcome: null })).toEqual({ kind: "ready" });
  });

  it("confirms the last successful save", () => {
    expect(
      resolvePopupState({
        signedIn: true,
        outcome: {
          status: "success",
          title: "Poster archive",
          thumbnailUrl: "https://cdn.test/t.jpg",
          sectionName: "Inspo",
          reused: false,
        },
      }),
    ).toEqual({
      kind: "saved",
      title: "Poster archive",
      thumbnailUrl: "https://cdn.test/t.jpg",
      sectionName: "Inspo",
      reused: false,
    });
  });

  it("defaults a save with no section to General", () => {
    expect(
      resolvePopupState({ signedIn: true, outcome: { status: "success", title: "x" } }),
    ).toMatchObject({ sectionName: "General", reused: false });
  });

  it("marks a re-save so the popup can say it was already there", () => {
    expect(
      resolvePopupState({
        signedIn: true,
        outcome: { status: "success", title: "x", reused: true },
      }),
    ).toMatchObject({ reused: true });
  });

  it("surfaces an error message", () => {
    expect(
      resolvePopupState({
        signedIn: true,
        outcome: { status: "error", message: "Save failed (500)." },
      }),
    ).toEqual({ kind: "error", message: "Save failed (500)." });
  });

  it("supplies a fallback message for an error with none", () => {
    expect(resolvePopupState({ signedIn: true, outcome: { status: "error" } })).toMatchObject({
      kind: "error",
    });
  });
});

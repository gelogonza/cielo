# Product principles

Cielo is a **central operating system for your saves and the notes you keep on
them**. One private library. You save from anywhere; you organise it your way;
you find it again later. That is the whole product.

The closest reference point is [mymind](https://mymind.com) — "remember
everything, organise nothing." We are building something in that spirit.

## What Cielo is not

These are constraints, not preferences. Do not add any of them, and push back if
asked to add one by implication (an "engagement" feature, a "growth" surface, a
"share to X" button).

| Not this               | Why it matters here                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| **No ads**             | The library is the product. Nothing is ever sold against its contents.                        |
| **No social features** | No followers, feeds, profiles, likes, or public pages. Nobody else sees your library.         |
| **No collaboration**   | No shared boards, no invites, no multiplayer. A library belongs to exactly one person.        |
| **No tracking**        | No analytics SDKs, no third-party scripts, no telemetry, no session recording.                |
| **No metrics**         | No streaks, no "you saved 12 things this week", no engagement numbers shown back at the user. |
| **No pressure**        | No notifications nagging you to return, no inbox-zero guilt, no unread badges on the library. |

**Counts are not metrics.** The sidebar's `Type 24` is a navigational fact about
how much is in a section, like a folder size. A number that exists to make the
user feel something about their own behaviour is the thing being banned.

## What Cielo is

- **Capture with near-zero friction.** Right-click from the extension, the OS
  share sheet on Android, or paste a link. The save must never become a form.
- **Yours to organise.** Sections are user-named. Tags are user-written. Nothing
  is filed on your behalf without you being able to override it.
- **Notes on saves are first-class.** The point is not just the bookmark; it is
  what you thought about it.
- **Private by construction.** Every query is scoped to the session user at the
  service layer, not filtered in the UI.
- **Light ground, acid accent.** The Figma was drawn dark and the app was built
  that way first; it now sits on a light ground. The accent is unchanged, but it
  is a fill colour — it is unreadable as text on white.

## Auto-classification — planned, not built

An AI/ML pass that classifies a save into its category (design, tech, art,
recipe, workout, …) is a **wanted future feature**, deliberately out of the MVP.

When it is built, it must respect the principles above:

- It **suggests**; the user disposes. A suggested section or tag is always
  editable and removable, and user-set values are never silently overwritten.
- User-named sections remain the source of truth. Auto-classification adds
  a second, clearly-marked path into them — it does not replace them.
- It must not become a reason to ship tracking. Classify the content, never the
  user's behaviour.

Until then, organisation is entirely manual and that is the intended MVP
experience — not a gap to be papered over.

## Verified as of 2026-09-11

`package.json` carries no analytics or telemetry dependency, and no source file
loads a third-party script. If you are adding a dependency that phones home,
you are breaking a principle, not making a trade-off.

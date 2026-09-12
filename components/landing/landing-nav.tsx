import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const LINKS = [
  { href: "#how-to", label: "How to" },
  { href: "#features", label: "Features" },
  { href: "#about", label: "About" },
];

/**
 * Floating navbar for the landing page. The search field lives only where
 * there is something to search — the library — so signed-out visitors get
 * navigation here instead.
 */
export function LandingNav() {
  return (
    <div className="sticky top-4 z-40 px-4 sm:top-5 sm:px-6">
      <header className="border-line bg-surface/80 mx-auto flex w-full max-w-[980px] items-center gap-2 rounded-full border p-1.5 pr-2 backdrop-blur-xl sm:gap-3 sm:pr-3">
        <Logo className="size-9 sm:size-11" />

        {/* Scrolls rather than wraps on a narrow phone — a wrapped link would
            make the pill two rows tall and push Sign Up off the edge. */}
        <nav
          aria-label="Primary"
          className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto sm:justify-center sm:gap-1"
        >
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-muted hover:text-primary-text hover:bg-ink shrink-0 rounded-full px-2.5 py-1.5 text-[13px] whitespace-nowrap transition sm:px-3.5 sm:text-sm"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/login"
            className="text-muted hover:text-primary-text hidden h-9 items-center justify-center rounded-full px-3.5 text-sm transition sm:flex"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="bg-accent text-accent-contrast flex h-9 shrink-0 items-center justify-center rounded-full px-4 text-[13px] font-medium whitespace-nowrap transition hover:brightness-95 sm:px-5 sm:text-sm"
          >
            Sign Up
          </Link>
        </div>
      </header>
    </div>
  );
}

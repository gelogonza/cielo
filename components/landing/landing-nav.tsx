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
      <header className="border-line bg-surface/70 mx-auto flex w-full max-w-[1100px] items-center gap-3 rounded-full border p-2 pr-3 backdrop-blur-xl sm:gap-4 sm:pr-4">
        <Logo className="size-10 sm:size-14" />

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
              className="text-muted hover:text-primary-text hover:bg-ink shrink-0 rounded-full px-2.5 py-2 text-[13px] whitespace-nowrap transition sm:px-4 sm:text-base"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/login"
            className="text-muted hover:text-primary-text hidden h-11 items-center justify-center rounded-full px-4 text-base transition sm:flex"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="bg-accent text-accent-contrast flex h-10 shrink-0 items-center justify-center rounded-full px-4 text-[13px] font-medium whitespace-nowrap transition hover:brightness-95 sm:h-11 sm:px-6 sm:text-base"
          >
            Sign Up
          </Link>
        </div>
      </header>
    </div>
  );
}

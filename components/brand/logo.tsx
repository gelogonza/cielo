"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

/** Intrinsic size of the exported mark, so next/image keeps the right ratio. */
const MARK_WIDTH = 74;
const MARK_HEIGHT = 73;

/** Keep in sync with the --spin animation duration in globals.css. */
const SPIN_MS = 420;

/**
 * The Cielo mark, and the way home from every screen. In Figma the mark sits
 * rotated inside its frame, so that base rotation is baked into the inner
 * element and the interaction transforms wrap it.
 *
 * Rendered size comes from `className` (so callers can go responsive); the
 * image just fills whatever box it is given.
 *
 * Click spins the mark before navigating; the delay is skipped entirely when
 * the viewer prefers reduced motion.
 */
export function Logo({
  href = "/",
  className = "size-[74px]",
}: {
  href?: string;
  className?: string;
}) {
  const router = useRouter();
  const [isSpinning, setIsSpinning] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    // Let modified clicks (new tab, download) behave normally.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
      return;
    }

    event.preventDefault();

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      router.push(href);
      return;
    }

    setIsSpinning(true);
    timeout.current = setTimeout(() => router.push(href), SPIN_MS);
  }

  return (
    <a
      href={href}
      onClick={handleClick}
      aria-label="Cielo — back to home"
      className={`group inline-block shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-strong ${className}`}
    >
      <span
        className={`block size-full transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-hover:rotate-6 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none ${
          isSpinning ? "animate-logo-spin" : ""
        }`}
        onAnimationEnd={() => setIsSpinning(false)}
      >
        <span className="bg-brand-ground flex size-full items-center justify-center rounded-full p-[16%]">
          <Image
            src="/brand/cielo-mark.svg"
            alt=""
            width={MARK_WIDTH}
            height={MARK_HEIGHT}
            priority
            className="block size-full -rotate-[160.69deg]"
          />
        </span>
      </span>
    </a>
  );
}

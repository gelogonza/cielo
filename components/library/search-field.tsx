"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/**
 * Example searches cycled through the placeholder, as if someone were typing.
 * Kept short — a long phrase spends most of its time mid-word.
 */
const EXAMPLES = ["graphic design", "ocean", "windows xp", "type specimens", "ceramics"];

const TYPE_MS = 85;
const DELETE_MS = 40;
/** How long a finished phrase sits before it is deleted again. */
const HOLD_MS = 1800;

/**
 * Search over the library. Only rendered where there is something to search —
 * the landing page has a navbar instead.
 *
 * The typed placeholder is decoration: `aria-label` stays fixed so the field's
 * accessible name never shifts underneath a screen reader, and the animation
 * stops the moment the field is actually used.
 */
export function SearchField({
  defaultValue,
  onSearch,
}: {
  defaultValue?: string;
  /** Called with the debounced query; "" means the search was cleared. */
  onSearch?: (query: string) => void;
}) {
  const [placeholder, setPlaceholder] = useState(EXAMPLES[0]);
  const [isPaused, setIsPaused] = useState(Boolean(defaultValue));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Typing fires a query per keystroke otherwise; 250ms is short enough to
  // feel immediate and long enough to skip most of a word.
  function handleChange(value: string) {
    setIsPaused(true);

    if (debounce.current) {
      clearTimeout(debounce.current);
    }

    debounce.current = setTimeout(() => onSearch?.(value.trim()), 250);
  }

  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
    },
    [],
  );

  useEffect(() => {
    if (isPaused) {
      return;
    }

    let phrase = 0;
    let letters = 0;
    let deleting = false;
    let cancelled = false;

    function step() {
      if (cancelled) return;

      // Checked here rather than in the effect body so the first paint is not
      // a synchronous re-render.
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setPlaceholder("Search anything");
        return;
      }

      const target = EXAMPLES[phrase];
      letters += deleting ? -1 : 1;
      setPlaceholder(target.slice(0, letters));

      let delay = deleting ? DELETE_MS : TYPE_MS;

      if (!deleting && letters === target.length) {
        deleting = true;
        delay = HOLD_MS;
      } else if (deleting && letters === 0) {
        deleting = false;
        phrase = (phrase + 1) % EXAMPLES.length;
        delay = TYPE_MS * 3;
      }

      timer.current = setTimeout(step, delay);
    }

    timer.current = setTimeout(step, HOLD_MS);

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [isPaused]);

  return (
    <div className="search-ring w-full rounded-full p-px sm:max-w-[280px]">
      <div className="bg-surface relative flex h-9 w-full items-center rounded-full sm:h-10">
        <Image
          aria-hidden
          src="/icons/search.svg"
          alt=""
          width={23}
          height={23}
          className="pointer-events-none absolute left-3.5 size-3.5"
        />
        <input
          type="search"
          aria-label="Search anything"
          placeholder={placeholder}
          defaultValue={defaultValue}
          // Any real interaction ends the demo for good — resuming it while
          // someone is thinking about their own query would be maddening.
          onFocus={() => setIsPaused(true)}
          // Covers the native clear button too, which fires an input event.
          onChange={(event) => handleChange(event.target.value)}
          className="placeholder:text-muted text-primary-text h-full w-full rounded-full bg-transparent pr-3 pl-9 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-accent-strong/70"
        />
      </div>
    </div>
  );
}

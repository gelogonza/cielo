import Image from "next/image";

/**
 * Search over the library. Only rendered where there is something to search —
 * the landing page has a navbar instead.
 */
export function SearchField({ defaultValue }: { defaultValue?: string }) {
  return (
    <div className="bg-surface relative flex h-11 w-full items-center rounded-full sm:h-12 sm:max-w-[360px]">
      <Image
        aria-hidden
        src="/icons/search.svg"
        alt=""
        width={23}
        height={23}
        className="pointer-events-none absolute left-4 size-4"
      />
      <input
        type="search"
        aria-label="Search anything"
        placeholder="Search anything"
        defaultValue={defaultValue}
        className="placeholder:text-muted text-primary-text h-full w-full rounded-full bg-transparent pr-4 pl-11 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      />
    </div>
  );
}

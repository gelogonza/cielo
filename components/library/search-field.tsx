import Image from "next/image";

/**
 * Search over the library. Only rendered where there is something to search —
 * the landing page has a navbar instead.
 */
export function SearchField({ defaultValue }: { defaultValue?: string }) {
  return (
    <div className="bg-surface border-line relative flex h-9 w-full items-center rounded-full border sm:h-10 sm:max-w-[280px]">
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
        placeholder="Search anything"
        defaultValue={defaultValue}
        className="placeholder:text-muted text-primary-text h-full w-full rounded-full bg-transparent pr-3 pl-9 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-accent-strong/70"
      />
    </div>
  );
}

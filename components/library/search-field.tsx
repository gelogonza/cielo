import Image from "next/image";

/** The 479x84 pill search bar used on the landing page and the library. */
export function SearchField({
  tone = "solid",
  defaultValue,
}: {
  /** The landing page uses a translucent bar; the library a solid one. */
  tone?: "solid" | "translucent";
  defaultValue?: string;
}) {
  return (
    <div
      className={`relative flex h-14 w-full items-center rounded-full sm:h-21 sm:max-w-[479px] ${
        tone === "solid" ? "bg-surface" : "bg-[#212121]/20"
      }`}
    >
      <Image
        aria-hidden
        src="/icons/search.svg"
        alt=""
        width={23}
        height={23}
        className="pointer-events-none absolute left-5 size-5 sm:left-10 sm:size-[23px]"
      />
      <input
        type="search"
        aria-label="Search anything"
        placeholder="Search anything"
        defaultValue={defaultValue}
        className="placeholder:text-muted text-primary-text h-full w-full rounded-full bg-transparent pr-6 pl-13 text-base outline-none focus-visible:ring-2 focus-visible:ring-accent/60 sm:pr-10 sm:pl-[74px] sm:text-2xl"
      />
    </div>
  );
}

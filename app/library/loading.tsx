import { FeedSkeleton, SidebarSkeleton } from "@/components/library/card-skeleton";

/**
 * Shown while the library page's own queries run on the server. Mirrors the
 * real layout so the shell does not shift when the data lands.
 */
export default function LibraryLoading() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-3 px-4 pt-5 sm:gap-8 sm:px-[29px] sm:pt-[37px]">
        <div className="bg-thumb animate-skeleton size-14 rounded-full sm:size-[94px]" />
        <div className="order-last w-full sm:order-none sm:flex sm:flex-1 sm:justify-center">
          <div className="bg-surface h-11 w-full rounded-full sm:h-12 sm:max-w-[360px]" />
        </div>
        <div className="bg-thumb animate-skeleton ml-auto h-11 w-24 rounded-full sm:h-[55px] sm:w-[157px]" />
      </header>

      <div className="flex flex-1 flex-col items-start gap-5 px-4 pt-5 pb-12 sm:px-9 lg:flex-row lg:gap-10 lg:pt-[29px] lg:pb-16">
        <SidebarSkeleton />
        <div
          aria-busy="true"
          aria-label="Loading your library"
          className="w-full min-w-0 flex-1 columns-2 gap-3 [column-fill:balance] sm:gap-5 lg:columns-3 xl:columns-4"
        >
          <FeedSkeleton />
        </div>
      </div>
    </div>
  );
}

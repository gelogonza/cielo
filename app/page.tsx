import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ProcessMarquee } from "@/components/landing/process-marquee";
import { SearchField } from "@/components/library/search-field";

/** Landing — Figma node 2:15, with the process marquee below the hero. */
export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-4 px-5 pt-6 sm:gap-8 sm:px-[38px] sm:pt-[38px]">
        <Logo className="size-14 sm:size-[74px]" />

        <div className="order-last w-full sm:order-none sm:flex sm:flex-1 sm:justify-center">
          <SearchField tone="translucent" />
        </div>

        <nav className="ml-auto flex items-center gap-2 sm:gap-[18px]">
          <Link
            href="/login"
            className="text-muted hover:text-primary-text bg-ink/20 flex h-11 w-[104px] items-center justify-center rounded-full border border-accent/[0.28] text-base transition sm:h-[55px] sm:w-[157px] sm:text-xl"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="bg-accent text-accent-contrast flex h-11 w-[104px] items-center justify-center rounded-full text-base font-medium transition hover:brightness-95 sm:h-[55px] sm:w-[157px] sm:text-xl"
          >
            Sign Up
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-12 px-5 py-16 sm:gap-16 sm:px-6 sm:py-24">
        <div className="flex flex-col items-center gap-6 text-center sm:gap-10">
          <h1 className="text-[64px] leading-none font-medium sm:text-[80px] lg:text-[96px]">
            Cielo
          </h1>
          <p className="text-2xl leading-tight font-medium text-balance sm:text-3xl lg:text-4xl">
            All your bookmarks
            <br />
            in one place
          </p>
        </div>

        <ProcessMarquee />
      </main>
    </div>
  );
}

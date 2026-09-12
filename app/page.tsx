import Link from "next/link";
import { HeroCollage } from "@/components/landing/hero-collage";
import { LandingNav } from "@/components/landing/landing-nav";
import { ProcessMarquee } from "@/components/landing/process-marquee";

/** What each section link in the navbar points at. */
const FEATURES = [
  {
    title: "Save from anywhere",
    body: "The extension saves a page, a link, an image, or text you have highlighted. On Android, Cielo shows up in the share sheet like any other app.",
  },
  {
    title: "Your own sections",
    body: "Name them whatever you want — inspo, tech, workout. Nothing is filed on your behalf, and everything stays visible in General.",
  },
  {
    title: "Notes on your saves",
    body: "The point is not just the bookmark. It is what you thought about it when you found it.",
  },
  {
    title: "Private by construction",
    body: "No ads, no feeds, no followers, no tracking. One library, and it is yours.",
  },
];

/** Landing — Figma node 2:15, with a navbar in place of the search field. */
export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <LandingNav />

      <main className="flex flex-1 flex-col items-center">
        <section className="hero-wash relative isolate flex flex-col items-center gap-7 px-5 pt-20 pb-14 text-center sm:px-6 sm:pt-28">
          <h1 className="text-[64px] leading-[0.95] font-medium tracking-[-0.03em] text-balance sm:text-[88px] lg:text-[112px]">
            All your bookmarks
            <br />
            in one place
          </h1>
          <p className="text-muted max-w-[540px] text-lg leading-[26px] text-balance sm:text-xl">
            Save anything from anywhere — a page, an image, a video, a line you highlighted — into
            one private library you organise yourself.
          </p>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="bg-accent text-accent-contrast flex h-12 items-center justify-center rounded-full px-7 text-base font-medium transition hover:brightness-95"
            >
              Start your library
            </Link>
            <a
              href="#how-to"
              className="border-line text-primary-text hover:bg-surface flex h-12 items-center justify-center rounded-full border px-6 text-base transition"
            >
              See how it works
            </a>
          </div>

          <p className="text-muted text-[13px]">Free. No ads, no feed, no tracking.</p>
        </section>

        <HeroCollage />

        <div className="flex w-full flex-col items-center gap-24 px-5 pt-8 pb-24 sm:px-6">
          <section id="how-to" className="flex w-full scroll-mt-28 flex-col items-center gap-10">
            <SectionHeading
              eyebrow="How to"
              title="Save it once, find it later"
              body="Right-click anything on any page, or share to Cielo from your phone. It lands in one library you organise yourself."
            />
            <ProcessMarquee />
          </section>

          <section id="features" className="w-full max-w-[900px] scroll-mt-28">
            <SectionHeading eyebrow="Features" title="What Cielo does" />
            <ul className="mt-10 grid gap-4 sm:grid-cols-2">
              {FEATURES.map((feature) => (
                <li
                  key={feature.title}
                  className="border-line bg-surface/50 rounded-panel border p-6"
                >
                  <h3 className="text-lg font-medium">{feature.title}</h3>
                  <p className="text-muted mt-2 text-[15px] leading-[22px]">{feature.body}</p>
                </li>
              ))}
            </ul>
          </section>

          <section id="about" className="w-full max-w-[640px] scroll-mt-28 text-center">
            <SectionHeading eyebrow="About" title="A quiet place for what you save" />
            <p className="text-muted mt-6 text-[15px] leading-[24px]">
              Saved things are scattered — Instagram saves, TikTok favourites, X bookmarks, browser
              folders you never open again. Cielo is one private place for all of it, with your
              notes attached. There is nothing to perform here: no feed, no followers, no streaks,
              and nothing sold against what you keep.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="text-muted text-xs font-medium tracking-[1px] uppercase">{eyebrow}</p>
      <h2 className="text-2xl font-medium sm:text-3xl">{title}</h2>
      {body && <p className="text-muted max-w-[560px] text-[15px] leading-[22px]">{body}</p>}
    </div>
  );
}

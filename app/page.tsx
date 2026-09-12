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

      <main className="flex flex-1 flex-col items-center gap-24 px-5 pt-24 pb-24 sm:px-6 sm:pt-32">
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
            folders you never open again. Cielo is one private place for all of it, with your notes
            attached. There is nothing to perform here: no feed, no followers, no streaks, and
            nothing sold against what you keep.
          </p>
        </section>
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

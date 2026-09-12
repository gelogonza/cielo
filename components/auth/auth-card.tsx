import { Logo } from "@/components/brand/logo";

/** Auth shell — Figma node 14:3 (480px card, accent hairline, centred on the ink ground). */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="px-5 pt-6 sm:px-[30px] sm:pt-[38px]">
        <Logo className="size-16 sm:size-[94px]" />
      </header>

      <main className="flex flex-1 items-center justify-center px-5 pb-16 sm:px-6 sm:pb-24">
        <div className="bg-surface-raised rounded-panel flex w-full max-w-[480px] flex-col gap-6 border border-accent-strong/40 px-6 pt-8 pb-8 sm:gap-7 sm:px-12 sm:pt-12 sm:pb-10">
          <div className="flex flex-col gap-2.5">
            <h1 className="text-[32px] leading-none font-medium sm:text-[40px]">{title}</h1>
            <p className="text-muted text-base sm:text-lg">{subtitle}</p>
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}

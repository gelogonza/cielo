import Image from "next/image";

/**
 * Brand moment on a full page load of the landing: the mark spins in, the
 * wordmark pops up beneath it, then the whole thing clears.
 *
 * Deliberately CSS-only. A JS-gated splash has to decide whether to show
 * *during* render, which either mismatches hydration or flashes the page
 * first; an animation with `forwards` just plays and gets out of the way.
 *
 * It is decoration over content that is already in the DOM — so it is hidden
 * from assistive tech, holds no focusable elements, and stops intercepting
 * pointer events the moment it finishes.
 */
export function Splash() {
  return (
    <div aria-hidden className="splash">
      <div className="splash-mark">
        <Image
          src="/brand/cielo-mark.svg"
          alt=""
          width={74}
          height={73}
          priority
          className="block size-[104px] sm:size-[128px]"
        />
      </div>
      <p className="splash-word text-primary-text text-4xl font-medium tracking-[-0.02em] sm:text-5xl">
        Cielo
      </p>
    </div>
  );
}

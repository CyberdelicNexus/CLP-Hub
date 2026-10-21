import Image from "next/image";

/**
 * The Clear Light wordmark (D-129): silver letters with the light in a dark
 * orb over the "i". The orb is near-black on a transparent ground, so landing.css
 * screens it onto the page (`.cl-logo`) and only the letters and the light show.
 * The name is the same in every language, so is its alt text.
 */
export function ClearLightLogo({ priority = false }: { priority?: boolean }) {
  return <Image src="/landing/media/clear-light-logo-v2.webp" width={880} height={252} alt="Clear Light" className="cl-logo" priority={priority} />;
}

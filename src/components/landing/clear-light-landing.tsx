import { ScrollCraftMount } from "@/components/landing/scrollcraft-mount";
import { Eligibility } from "@/components/landing/sections/eligibility";
import { Hero } from "@/components/landing/sections/hero";
import { Invitation } from "@/components/landing/sections/invitation";
import { Join } from "@/components/landing/sections/join";
import { Split } from "@/components/landing/sections/split";
import { Stages } from "@/components/landing/sections/stages";
import { What, Why } from "@/components/landing/sections/why-what";
import { SiteBar } from "@/components/landing/site-bar";
import { ACTIONS, NAV } from "@/content/landing/clear-light";

export const LANDING_ROOT_ID = "clear-light";

/**
 * The eight locked sections, in order (docs/landing-page.md). Essential content
 * is ordinary document flow; the scroll engine and the pointer reveal are
 * layered on top and the page reads completely without either.
 */
export function ClearLightLanding({ qualtricsUrl, fontClass }: { qualtricsUrl: string | null; fontClass: string }) {
  return (
    <div id={LANDING_ROOT_ID} className={`cl ${fontClass}`} lang="es">
      <SiteBar brand="aNUma" links={NAV} cta={{ href: "#invitacion", label: ACTIONS.primaryCta }} />
      <main id="main">
        <Hero />
        <Why />
        <What />
        <Stages />
        <Join />
        <Split />
        <Eligibility />
        <Invitation qualtricsUrl={qualtricsUrl} rootId={LANDING_ROOT_ID} />
      </main>
      <ScrollCraftMount rootId={LANDING_ROOT_ID} />
    </div>
  );
}

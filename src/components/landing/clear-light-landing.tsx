import { CookieBanner } from "@/components/landing/consent";
import { ContactDialog } from "@/components/landing/contact-dialog";
import { ScrollCraftMount } from "@/components/landing/scrollcraft-mount";
import { Eligibility } from "@/components/landing/sections/eligibility";
import { Invitation } from "@/components/landing/sections/invitation";
import { Join } from "@/components/landing/sections/join";
import { Opening } from "@/components/landing/sections/opening";
import { Split } from "@/components/landing/sections/split";
import { Stages } from "@/components/landing/sections/stages";
import { Team } from "@/components/landing/sections/team";
import { LightJourney } from "@/components/landing/light-journey";
import { LightRelay } from "@/components/landing/light-relay";
import { LanguageSwitch } from "@/components/landing/language-switch";
import { SiteBar } from "@/components/landing/site-bar";
import { StarField } from "@/components/landing/star-field";
import type { LandingCopy } from "@/content/landing/clear-light";
import type { PublicLocale } from "@/domain/locale";

export const LANDING_ROOT_ID = "clear-light";

/**
 * The recruitment story, in order (docs/landing-page.md). Essential content
 * is ordinary document flow; the scroll engine and the pointer reveal are
 * layered on top and the page reads completely without either. The copy is
 * the visitor's language (D-063); layout, media and anchors never vary by it.
 */
export function ClearLightLanding({
  locale,
  copy,
  fontClass,
}: {
  locale: PublicLocale;
  copy: LandingCopy;
  fontClass: string;
}) {
  return (
    <div id={LANDING_ROOT_ID} className={`cl cl--landing ${fontClass}`} lang={locale}>
      <div className="cl-atmosphere" aria-hidden="true">
        <div className="cl-atmosphere__violet" />
      </div>
      <StarField rootId={LANDING_ROOT_ID} />
      <SiteBar
        brand="Clear Light"
        links={copy.NAV}
        /* 2026-09-29 request: matches the hero's "Aplicar al estudio"
           button — same label, same direct destination (D-090), so the
           persistent nav CTA does not promise something different from
           what the hero already does. */
        cta={{ href: "/clearlight/participar", label: copy.ACTIONS.exploreCta }}
        language={<LanguageSwitch locale={locale} label={copy.LANGUAGE.label} from="/" />}
      />
      <main id="main">
        <Opening copy={copy} lang={locale} />
        <Split copy={copy} />
        <Stages copy={copy} />
        <Join copy={copy} />
        <Eligibility copy={copy} />
        <Team copy={copy} />
        <Invitation copy={copy} rootId={LANDING_ROOT_ID} />
      </main>
      <LightRelay rootId={LANDING_ROOT_ID} />
      <LightJourney rootId={LANDING_ROOT_ID} />
      <ContactDialog copy={copy.CONTACT} />
      <CookieBanner copy={copy.CONSENT} />
      <ScrollCraftMount rootId={LANDING_ROOT_ID} />
    </div>
  );
}

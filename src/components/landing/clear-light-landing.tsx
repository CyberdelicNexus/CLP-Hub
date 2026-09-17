import { CookieBanner } from "@/components/landing/consent";
import { ContactDialog } from "@/components/landing/contact-dialog";
import { ScrollCraftMount } from "@/components/landing/scrollcraft-mount";
import { Eligibility } from "@/components/landing/sections/eligibility";
import { Invitation } from "@/components/landing/sections/invitation";
import { Join } from "@/components/landing/sections/join";
import { Opening } from "@/components/landing/sections/opening";
import { Split } from "@/components/landing/sections/split";
import { Stages } from "@/components/landing/sections/stages";
import { LanguageSwitch } from "@/components/landing/language-switch";
import { SiteBar } from "@/components/landing/site-bar";
import type { LandingCopy } from "@/content/landing/clear-light";
import type { PublicLocale } from "@/domain/locale";

export const LANDING_ROOT_ID = "clear-light";

/**
 * The eight locked sections, in order (docs/landing-page.md). Essential content
 * is ordinary document flow; the scroll engine and the pointer reveal are
 * layered on top and the page reads completely without either. The copy is
 * the visitor's language (D-063); layout, media and anchors never vary by it.
 */
export function ClearLightLanding({
  locale,
  copy,
  qualtricsUrl,
  fontClass,
}: {
  locale: PublicLocale;
  copy: LandingCopy;
  qualtricsUrl: string | null;
  fontClass: string;
}) {
  return (
    <div id={LANDING_ROOT_ID} className={`cl ${fontClass}`} lang={locale}>
      <SiteBar
        brand="aNUma"
        links={copy.NAV}
        cta={{ href: "#invitacion", label: copy.ACTIONS.primaryCta }}
        language={<LanguageSwitch locale={locale} label={copy.LANGUAGE.label} from="/" />}
      />
      <main id="main">
        <Opening copy={copy} lang={locale} />
        <Stages copy={copy} />
        <Join copy={copy} />
        <Split copy={copy} />
        <Eligibility copy={copy} />
        <Invitation copy={copy} qualtricsUrl={qualtricsUrl} rootId={LANDING_ROOT_ID} />
      </main>
      <ContactDialog copy={copy.CONTACT} />
      <CookieBanner copy={copy.CONSENT} />
      <ScrollCraftMount rootId={LANDING_ROOT_ID} />
    </div>
  );
}

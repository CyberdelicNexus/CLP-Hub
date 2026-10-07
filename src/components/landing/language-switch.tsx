import clsx from "clsx";
import { PUBLIC_LOCALE_NAMES, PUBLIC_LOCALES, type PublicLocale } from "@/domain/locale";

/**
 * ES · EN · GL (D-063), as one circular globe icon that opens a dropdown
 * (2026-09-29 request — three separate side-by-side buttons became one).
 * A native <details>/<summary> disclosure, like the staff app's own
 * icon-triggered popovers: no JavaScript, keyboard-operable (Enter/Space
 * opens it, Tab reaches each option), and it closes itself on navigation
 * because each option is a real link to a new page, not a client update.
 *
 * Each option is a plain link to /clearlight/idioma/[locale], named in its own language
 * and marked with `lang`, so a screen reader pronounces "Galego" as Galician.
 * The current language is `aria-current`, not a link target.
 */
export function LanguageSwitch({
  locale,
  label,
  from,
  className,
}: {
  locale: PublicLocale;
  label: string;
  /** The page to come back to: one of the paths the route accepts. */
  from: string;
  className?: string;
}) {
  return (
    <details className={clsx("lang", className)}>
      <summary className="lang__trigger" aria-label={label} title={label}>
        <GlobeIcon aria-hidden />
        <span className="cl-sr">{PUBLIC_LOCALE_NAMES[locale]}</span>
      </summary>
      <ul className="lang__list" aria-label={label}>
        {PUBLIC_LOCALES.map((l) => (
          <li key={l}>
            <a
              href={`/clearlight/idioma/${l}?desde=${encodeURIComponent(from)}`}
              className="lang__option"
              lang={l}
              hrefLang={l}
              aria-current={l === locale ? "true" : undefined}
            >
              {PUBLIC_LOCALE_NAMES[l]}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

function GlobeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <path d="M12 3c2.4 2.7 3.6 5.8 3.6 9s-1.2 6.3-3.6 9c-2.4-2.7-3.6-5.8-3.6-9s1.2-6.3 3.6-9z" />
    </svg>
  );
}

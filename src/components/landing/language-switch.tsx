import clsx from "clsx";
import { PUBLIC_LOCALE_NAMES, PUBLIC_LOCALES, type PublicLocale } from "@/domain/locale";

/**
 * ES · EN · GL (D-063). Each option is a plain link to /idioma/[locale], named
 * in its own language and marked with `lang`, so a screen reader pronounces
 * "Galego" as Galician. The current language is `aria-current`, not a link
 * target, and the short code is what sighted readers see.
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
    <nav aria-label={label} className={clsx("lang", className)}>
      <ul className="lang__list">
        {PUBLIC_LOCALES.map((l) => (
          <li key={l}>
            <a
              href={`/idioma/${l}?desde=${encodeURIComponent(from)}`}
              className="lang__option"
              lang={l}
              hrefLang={l}
              aria-current={l === locale ? "true" : undefined}
              aria-label={PUBLIC_LOCALE_NAMES[l]}
              title={PUBLIC_LOCALE_NAMES[l]}
            >
              {l.toUpperCase()}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

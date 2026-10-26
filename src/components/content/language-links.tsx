import { PUBLIC_LOCALE_NAMES, type PublicLocale } from "@/domain/locale";

/** The languages a study page can be read in. English is not offered. */
const OFFERED = ["es", "gl"] as const;

/**
 * Spanish · Galego for a study content page (D-135): plain links to the public
 * language route, which remembers the choice in the technical cookie and comes
 * back to this page (`from` is the path under the Clear Light site). Works
 * without JavaScript. Each language is named in itself and marked with `lang`.
 */
export function StudyLanguageLinks({
  locale,
  from,
  label,
}: {
  locale: PublicLocale;
  from: string;
  label: string;
}) {
  return (
    <nav aria-label={label} className="flex items-center gap-1 text-sm">
      {OFFERED.map((l) => (
        <a
          key={l}
          href={`/clearlight/idioma/${l}?desde=${encodeURIComponent(from)}`}
          lang={l}
          hrefLang={l}
          aria-current={l === locale ? "true" : undefined}
          className={
            l === locale
              ? "rounded-lg bg-muted px-2.5 py-1 font-medium text-foreground"
              : "rounded-lg px-2.5 py-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          }
        >
          {PUBLIC_LOCALE_NAMES[l]}
        </a>
      ))}
    </nav>
  );
}

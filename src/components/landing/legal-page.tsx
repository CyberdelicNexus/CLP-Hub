import { getTranslations } from "next-intl/server";
import { CookieBanner } from "@/components/landing/consent";
import { ContactDialog } from "@/components/landing/contact-dialog";
import { HOLDING_FONT_CLASS, PUBLIC_FONT_CLASS } from "@/components/landing/fonts";
import { Missing } from "@/components/landing/missing";
import { SiteFooter } from "@/components/landing/site-footer";
import { isProduction } from "@/config/env";
import { missingContentList } from "@/content/landing/clear-light";
import { LEGAL, legalPage, type LegalBlock, type LegalPage } from "@/content/landing/legal";

const ROOT_ID = "clear-light-legal";

function Block({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case "p":
      return <p className="legal__p">{block.text}</p>;
    case "list":
      return (
        <ul className="legal__list">
          {block.items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      );
    case "rows":
      return (
        <dl className="legal__rows">
          {block.rows.map((r) => (
            <div key={r.label}>
              <dt>{r.label}</dt>
              <dd>{typeof r.value === "string" ? r.value : <Missing item={r.value} />}</dd>
            </div>
          ))}
        </dl>
      );
    case "table":
      return (
        <div className="legal__table">
          <table>
            <thead>
              <tr>
                {block.head.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, i) => (i === 0 ? <th key={i} scope="row">{cell}</th> : <td key={i}>{cell}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "missing":
      return (
        <p className="legal__p">
          <Missing item={block.item} />
        </p>
      );
  }
}

/**
 * One legal page of the public site (D-052), in the landing page's theme, with
 * the same footer, contact dialog and consent banner. Drafts: the page says so
 * at the top, shows its unresolved facts as markers outside production, and in
 * production shows the holding page while anything on the site is unapproved,
 * like the landing page itself.
 */
export async function LegalPageView({ slug }: { slug: LegalPage["slug"] }) {
  if (isProduction() && missingContentList({ qualtricsUrl: null }).length > 0) {
    const t = await getTranslations("public.holding");
    return (
      <main id="main" className={`cl holding ${HOLDING_FONT_CLASS}`} lang="es">
        <div>
          <h1 className="cl-title--md">{t("title")}</h1>
          <p className="cl-lead">{t("body")}</p>
        </div>
      </main>
    );
  }

  const page = legalPage(slug);
  return (
    <div id={ROOT_ID} className={`cl legal ${PUBLIC_FONT_CLASS}`} lang="es">
      <header className="legal__bar">
        {/* Full document loads, not <Link>: the landing's scroll engine is a
            plain script that mounts on page load (scrollcraft-mount.tsx). */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="bar__brand">
          aNUma
        </a>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="cl-link">
          {LEGAL.back}
        </a>
      </header>
      <main id="main" className="legal__main">
        <p className="legal__draft" role="note">
          {LEGAL.draft} <Missing item={LEGAL.review} />
        </p>
        <h1 className="cl-title legal__title">{page.title}</h1>
        {page.sections.map((s) => (
          <section key={s.heading} className="legal__section">
            <h2 className="legal__heading">{s.heading}</h2>
            {s.blocks.map((b, i) => (
              <Block key={i} block={b} />
            ))}
          </section>
        ))}
      </main>
      <SiteFooter rootId={ROOT_ID} onLanding={false} />
      <ContactDialog />
      <CookieBanner />
    </div>
  );
}

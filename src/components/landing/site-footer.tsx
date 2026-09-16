import { CookieSettingsButton } from "@/components/landing/consent";
import { StillToggle } from "@/components/landing/still-toggle";
import { INVITATION } from "@/content/landing/clear-light";

/**
 * The public site's footer, shared by the landing page and the legal pages
 * (D-052): brand and tagline, the study links, the legal links, cookie
 * settings and the pause control. In-page anchors get `/` prepended off the
 * landing page. `#contacto` stays a bare hash everywhere: ContactDialog opens on it.
 */
export function SiteFooter({ rootId, onLanding }: { rootId: string; onLanding: boolean }) {
  const f = INVITATION.footer;
  const href = (h: string) => (!onLanding && h.startsWith("#") && h !== "#contacto" ? `/${h}` : h);
  return (
    <footer className="foot">
      <div className="foot__inner">
        <div className="foot__brandcol">
          <a href={onLanding ? "#inicio" : "/"} className="foot__brand">
            aNUma
          </a>
          <p className="foot__tagline">{f.tagline}</p>
        </div>
        <nav className="foot__groups" aria-label="Pie de página">
          {f.groups.map((g) => (
            <div key={g.heading} className="foot__group">
              <h2 className="foot__heading">{g.heading}</h2>
              <ul className="foot__links">
                {g.links.map((l) => (
                  <li key={l.href}>
                    <a href={href(l.href)}>{l.label}</a>
                  </li>
                ))}
                {g.heading === "Legal" ? (
                  <li>
                    <CookieSettingsButton label={f.cookieSettings} />
                  </li>
                ) : null}
              </ul>
            </div>
          ))}
        </nav>
        <div className="foot__base">
          <p className="foot__note">{f.note}</p>
          <StillToggle rootId={rootId} labels={f.still} />
        </div>
      </div>
    </footer>
  );
}

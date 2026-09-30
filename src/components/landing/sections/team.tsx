import Image from "next/image";
import type { LandingCopy } from "@/content/landing/clear-light";

export function Team({ copy }: { copy: LandingCopy }) {
  const { TEAM } = copy;
  return (
    <section id="equipo" className="team cl-wrap" aria-labelledby="team-title">
      <div className="team__copy">
        <p className="cl-eyebrow">{TEAM.eyebrow}</p>
        <h2 id="team-title" className="cl-title">{TEAM.heading}</h2>
        {TEAM.body.map((paragraph) => <p className="cl-lead" key={paragraph}>{paragraph}</p>)}
        <a href="#contacto" className="cl-link">{TEAM.contact}</a>
      </div>
      <figure className="team__portrait">
        <Image src="/landing/media/team-placeholder.svg" alt={TEAM.imageAlt} width={800} height={640} />
        <figcaption>{TEAM.imageCaption}</figcaption>
      </figure>
    </section>
  );
}

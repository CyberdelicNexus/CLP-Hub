"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import type { LandingCopy } from "@/content/landing/clear-light";
import { TEAM_MEMBERS } from "@/content/landing/team";

const ORDER = [0, 1, 2, 5, 6, 7, 3, 4];

export function Team({ copy }: { copy: LandingCopy }) {
  const { TEAM } = copy;
  const rail = useRef<HTMLUListElement>(null);
  const [opened, setOpened] = useState<number | null>(null);
  const [position, setPosition] = useState({ progress: 0, visible: 0.5, end: false });

  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    const update = () => {
      const range = element.scrollWidth - element.clientWidth;
      setPosition({ progress: range > 0 ? element.scrollLeft / range : 0,
        visible: Math.min(1, element.clientWidth / element.scrollWidth),
        end: range <= 1 || element.scrollLeft >= range - 2 });
    };
    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => { observer.disconnect(); element.removeEventListener("scroll", update); };
  }, []);

  function move(direction: number) {
    const element = rail.current;
    if (!element) return;
    setOpened(null);
    element.scrollBy({ left: direction * element.clientWidth,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  return (
    <section id="equipo" className="team cl-wrap" aria-labelledby="team-title">
      <div className="team__copy">
        <div className="team__heading">
          <p className="cl-eyebrow">{TEAM.eyebrow}</p>
          <h2 id="team-title" className="cl-title">{TEAM.heading}</h2>
        </div>
        <div className="team__intro">
          {TEAM.body.map((paragraph) => <p className="cl-lead" key={paragraph}>{paragraph}</p>)}
        </div>
      </div>
      <div className="team__carousel">
        <ul id="team-portraits" ref={rail} className="team__members" aria-label={TEAM.heading}>
          {ORDER.map((index) => {
            const member = TEAM_MEMBERS[index];
            const text = TEAM.members[index];
            const active = opened === index;
            return (
              <li key={member.name} className={"team__member team__member--" + index} data-open={active || undefined}>
                <button className="team__card" aria-expanded={active} aria-controls={"team-bio-" + index}
                  onClick={() => setOpened(active ? null : index)}
                  onKeyDown={(event) => { if (event.key === "Escape") { setOpened(null); event.currentTarget.blur(); } }}>
                  <span className="team__portrait" aria-hidden="true">
                    {member.photo ? <Image src={member.photo} alt="" fill sizes="(max-width: 700px) 78vw, (max-width: 1100px) 32vw, 300px" /> : null}
                  </span>
                  <span className="team__identity">
                    <span className="team__name">{member.name}</span>
                    <span className="team__role">{text.role}</span>
                  </span>
                  <span id={"team-bio-" + index} className="team__bio">{text.bio}</span>
                </button>
                {member.href ? <a className="team__link" href={member.href} target="_blank" rel="noopener noreferrer">
                  {TEAM.profile}<ArrowUpRight size={16} aria-hidden="true" />
                  <span className="cl-sr">: {member.name} ({TEAM.newTab})</span>
                </a> : null}
              </li>
            );
          })}
        </ul>
        <div className="team__navigation">
          <button className="team__arrow" onClick={() => move(-1)} disabled={position.progress <= 0.001} aria-label={TEAM.previous} aria-controls="team-portraits"><ArrowLeft size={20} /></button>
          <div className="team__progress" aria-hidden="true"><span style={{ transform: "translateX(" + position.progress * (1 - position.visible) * 100 / position.visible + "%)", width: position.visible * 100 + "%" }} /></div>
          <button className="team__arrow" onClick={() => move(1)} disabled={position.end} aria-label={TEAM.next} aria-controls="team-portraits"><ArrowRight size={20} /></button>
        </div>
      </div>
    </section>
  );
}

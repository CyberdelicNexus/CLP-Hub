"use client";

import { useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import { setThirdPartyConsent, useThirdPartyConsent } from "@/components/landing/consent";
import { CONSENT } from "@/content/landing/clear-light";

/**
 * Section 3 film. Poster first; the visitor starts it. The clip itself is
 * hosted on YouTube, so nothing loads from YouTube until the visitor clicks:
 * the iframe (youtube-nocookie.com) is only ever mounted after that click, and
 * only with consent to third-party content (D-052). Without it, the click asks
 * for consent in place.
 */
export function FilmPlayer({
  youtubeId,
  poster,
  alt,
  label,
  playLabel,
}: {
  youtubeId: string;
  poster: string;
  alt: string;
  label: string;
  playLabel: string;
}) {
  const [requested, setRequested] = useState(false);
  const consent = useThirdPartyConsent();
  const playing = requested && consent === "accepted";
  const asking = requested && consent !== "accepted";

  return (
    <div className={clsx("film", playing && "is-playing")}>
      <div className="film__frame">
        <Image src={poster} alt={alt} fill sizes="(max-width: 860px) 100vw, 45vw" quality={90} />
        {asking ? (
          <div className="film__consent" role="group" aria-label={CONSENT.title}>
            <p>{CONSENT.filmBlocked}</p>
            <button type="button" className="cl-btn" onClick={() => setThirdPartyConsent(true)}>
              {CONSENT.filmAccept}
            </button>
          </div>
        ) : null}
        {playing ? (
          <iframe
            className="film__embed"
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1&cc_lang_pref=es&hl=es`}
            title={label}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : null}
        {!requested ? (
          <button type="button" className="film__play" onClick={() => setRequested(true)} aria-label={playLabel}>
            <span className="film__play-disc" aria-hidden />
          </button>
        ) : null}
        <span className="film__label" aria-hidden>
          {label}
        </span>
      </div>
    </div>
  );
}

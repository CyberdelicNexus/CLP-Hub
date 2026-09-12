"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import clsx from "clsx";

/**
 * Section 3 film. Poster first; the visitor starts it. Native controls so it
 * can be paused, scrubbed and stopped without anything bespoke. Pauses itself
 * when scrolled out of view. If the file fails, the poster stays and a short
 * Spanish note appears: a missing clip is never a blank frame.
 */
export function FilmPlayer({
  src,
  poster,
  alt,
  label,
  playLabel,
  errorLabel,
}: {
  src: string;
  poster: string;
  alt: string;
  label: string;
  playLabel: string;
  errorLabel: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const v = video.current;
    if (!v) return;
    v.play().catch(() => {});
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && !v.paused) v.pause();
      },
      { threshold: 0.2 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [playing]);

  return (
    <div className={clsx("film", playing && !failed && "is-playing")}>
      <div className="film__frame">
        <Image src={poster} alt={alt} fill sizes="(max-width: 860px) 100vw, 40vw" />
        <video
          ref={video}
          controls
          playsInline
          preload="none"
          poster={poster}
          aria-label={label}
          // Until the visitor starts it the element is invisible; keep it out of
          // the tab order so keyboard focus never lands on an unseen control.
          tabIndex={playing ? undefined : -1}
          aria-hidden={!playing}
          onError={() => {
            setFailed(true);
            setPlaying(false);
          }}
        >
          <source src={src} type="video/mp4" />
        </video>
        {!playing && !failed ? (
          <button type="button" className="film__play" onClick={() => setPlaying(true)} aria-label={playLabel}>
            <span className="film__play-disc" aria-hidden />
          </button>
        ) : null}
        <span className="film__label" aria-hidden>
          {label}
        </span>
      </div>
      {failed ? (
        <p className="film__desc" role="status">
          {errorLabel}
        </p>
      ) : null}
    </div>
  );
}

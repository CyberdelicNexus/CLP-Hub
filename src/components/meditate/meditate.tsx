"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import Link from "next/link";
import { Maximize, Minimize, Pause, Play, RotateCcw, SlidersHorizontal } from "lucide-react";
import { LanguageSwitch } from "@/components/landing/language-switch";
import { StarField } from "@/components/landing/star-field";
import { fill, type MeditateCopy } from "@/content/meditate";
import { breathLevel, PHASES, phaseAt, TIMER_MINUTES, toSearch, type MeditateSettings, type Phase } from "@/domain/breathing";
import type { PublicLocale } from "@/domain/locale";
import { MEDITATE_RETURN } from "@/domain/navigation";
import { BreathOrb } from "./breath-orb";
import { FacilitatorPanel } from "./facilitator-panel";
import { PALETTE_COLORS } from "./palettes";

/**
 * The breathing guide (D-120). One animation loop owns the clock: it works
 * out where in the breath the session is, eases the light towards that, and
 * writes the light's size straight to the DOM. React only re-renders when
 * something written on screen changes (the phase word, a second, a breath).
 *
 * The light grows on the in-breath and settles on the out-breath, like the
 * home page's (home.css), between the same two sizes at the default range.
 */
export const ROOT_ID = "meditate";
const COUNT_IN = 3;
/** The light's size at empty and at full, as on the home page (0.66 to 1.12). */
const ORB_FULL = 1.12;
const ORB_SWING = 0.46;
const HALO_FULL = 1.08;
const HALO_SWING = 0.34;
/** How long the controls stay after the last movement, once a session is running. */
const CALM_AFTER_MS = 3500;

type Status = "idle" | "countIn" | "running" | "paused" | "done";
interface Display {
  phase: Phase | "ready";
  remaining: number;
  cycle: number;
  /** Whole seconds of breathing so far. */
  elapsed: number;
}
const START: Display = { phase: "inhale", remaining: 0, cycle: 0, elapsed: 0 };

const TONES: Record<Phase, number> = { inhale: 528, holdIn: 440, exhale: 396, holdOut: 330 };
const VOICE_LANG: Record<PublicLocale, string> = { es: "es-ES", en: "en-GB", gl: "gl-ES" };
/** Galician voices are rare on devices; a Spanish one reads the Galician words well enough. */
const VOICE_FALLBACK: Record<PublicLocale, readonly string[]> = { es: ["es"], en: ["en"], gl: ["gl", "es"] };
/** The device's better voices, where it names them so. */
const GOOD_VOICE = /natural|neural|google|premium|enhanced|siri/i;

function pickVoice(locale: PublicLocale): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  for (const prefix of VOICE_FALLBACK[locale]) {
    const matching = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
    const best = matching.find((v) => GOOD_VOICE.test(v.name)) ?? matching[0];
    if (best) return best;
  }
  return undefined;
}

const noSubscription = () => () => {};
const subscribeMotion = (onChange: () => void) => {
  const q = window.matchMedia("(prefers-reduced-motion: reduce)");
  q.addEventListener("change", onChange);
  return () => q.removeEventListener("change", onChange);
};
const prefersReduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const subscribeFullscreen = (onChange: () => void) => {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
};
const isFullscreen = () => Boolean(document.fullscreenElement);
const canFullscreen = () => Boolean(document.fullscreenEnabled);

const patternChanged = (a: MeditateSettings, b: MeditateSettings) => PHASES.some((ph) => a.pattern[ph] !== b.pattern[ph]);

const clock = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function Meditate({ copy, locale, initial }: { copy: MeditateCopy; locale: PublicLocale; initial: MeditateSettings }) {
  const [settings, setSettings] = useState(initial);
  const [status, setStatus] = useState<Status>("idle");
  const [display, setDisplay] = useState<Display>(START);
  const [panelOpen, setPanelOpen] = useState(false);
  const [calm, setCalm] = useState(false);

  const reduced = useSyncExternalStore(subscribeMotion, prefersReduced, () => false);
  const fullscreen = useSyncExternalStore(subscribeFullscreen, isFullscreen, () => false);
  const fullscreenSupported = useSyncExternalStore(noSubscription, canFullscreen, () => false);

  const rootRef = useRef<HTMLDivElement>(null);
  const orbRef = useRef<HTMLSpanElement>(null);
  const haloRef = useRef<HTMLSpanElement>(null);
  const ambientRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);
  // A stable box the loop and the light's shader share; not React state, it changes every frame.
  const [level] = useState(() => ({ current: 0.3 }));

  // What the loop reads each frame.
  const live = useRef({ settings, status, reduced });
  useEffect(() => {
    live.current = { settings, status, reduced };
  });
  const clockRef = useRef({ elapsed: 0, origin: 0, countIn: 0, idle: 0, ended: 0, phaseKey: "" });
  /** A wave of light that leaves the orb when a session starts or ends; the key replays it. */
  const [wave, setWave] = useState<{ kind: "start" | "end"; n: number } | null>(null);
  const audio = useRef<AudioContext | null>(null);

  /* ------------------------------------------------------------ cues */
  const tone = useCallback((freq: number, delay = 0) => {
    const ctx = audio.current;
    if (!ctx) return;
    const volume = live.current.settings.volume;
    const t = ctx.currentTime + delay;
    for (const [mult, share] of [
      [1, 1],
      [2, 0.25],
    ] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq * mult;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.16 * volume * share, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 2.3);
    }
  }, []);

  const speak = useCallback(
    (word: string) => {
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(word);
      const voice = pickVoice(locale);
      u.voice = voice ?? null;
      u.lang = voice?.lang ?? VOICE_LANG[locale];
      u.rate = 0.8;
      u.pitch = 0.95;
      u.volume = live.current.settings.volume;
      window.speechSynthesis.speak(u);
    },
    [locale],
  );

  const cue = useCallback(
    (phase: Phase) => {
      const s = live.current.settings;
      if (s.tones) tone(TONES[phase]);
      if (s.voice) speak(copy.phases[phase]);
    },
    [copy, speak, tone],
  );

  /* ------------------------------------------------------------ the loop */
  useEffect(() => {
    let raf = 0;
    let last = 0;
    let shown = level.current;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      // Real time, so a slow or throttled screen keeps the rhythm and the timer
      // true; a longer gap than a second means the page was away (it pauses then).
      const dt = last ? Math.min((now - last) / 1000, 1) : 0;
      last = now;
      if (document.hidden) return;
      const { settings: s, status: st, reduced: still } = live.current;
      const c = clockRef.current;

      let target = shown;
      let progress = 0;
      let next: Display | null = null;

      if (st === "idle") {
        // Waiting: a slow, shallow breath so the page is alive before it starts.
        if (!still) c.idle += dt;
        target = 0.35 + 0.2 * Math.sin((c.idle / 10) * Math.PI * 2);
      } else if (st === "done") {
        // The ending: one slow, full breath of light, then it rests half open.
        c.ended += dt;
        target = c.ended < 2.8 ? 1 : 0.45;
      } else {
        if (st !== "paused") c.elapsed += dt;
        if (c.elapsed < c.countIn) {
          target = 0;
          progress = c.elapsed / c.countIn;
          next = { phase: "ready", remaining: Math.ceil(c.countIn - c.elapsed), cycle: 0, elapsed: 0 };
          c.phaseKey = "ready";
        } else {
          const at = phaseAt(s.pattern, c.elapsed - c.origin);
          target = breathLevel(at);
          progress = at.progress;
          const breathing = c.elapsed - c.countIn;
          next = { phase: at.phase, remaining: Math.ceil(at.remaining), cycle: at.cycle, elapsed: Math.floor(breathing) };
          const key = `${at.cycle}:${at.phase}`;
          if (key !== c.phaseKey && st === "running") {
            c.phaseKey = key;
            // Time is up: end once the breath is out, never in the middle of one.
            const timeUp = s.minutes > 0 && breathing >= s.minutes * 60;
            if (timeUp && (at.phase === "holdOut" || at.phase === "inhale")) {
              live.current.status = "done";
              c.ended = 0;
              setStatus("done");
              setWave((w) => ({ kind: "end", n: (w?.n ?? 0) + 1 }));
              if (s.tones || s.voice) {
                tone(528);
                tone(660, 0.6);
              }
            } else {
              cue(at.phase);
            }
          }
        }
      }

      // The ending moves at a third of the pace of a breath.
      if (st !== "paused") shown += (target - shown) * (1 - Math.exp(-dt * (st === "done" ? 1.6 : 9)));
      level.current = shown;

      const depth = s.depth * (still ? 0.35 : 1);
      const orb = orbRef.current;
      const halo = haloRef.current;
      if (orb) {
        orb.style.transform = `scale(${ORB_FULL - ORB_SWING * depth * (1 - shown)})`;
        orb.style.opacity = String(0.86 + 0.14 * shown);
      }
      if (halo) {
        halo.style.transform = `scale(${HALO_FULL - HALO_SWING * depth * (1 - shown)})`;
        halo.style.opacity = String(0.72 + 0.28 * shown);
      }
      if (ambientRef.current) ambientRef.current.style.opacity = String(0.7 + 0.3 * shown);
      if (lineRef.current) lineRef.current.style.transform = `scaleX(${progress})`;

      if (next) {
        setDisplay((d) =>
          d.phase === next.phase && d.remaining === next.remaining && d.cycle === next.cycle && d.elapsed === next.elapsed ? d : next,
        );
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cue, level, tone]);

  /* ------------------------------------------------------------ controls */
  const begin = useCallback(() => {
    if (!audio.current && typeof AudioContext !== "undefined") audio.current = new AudioContext();
    void audio.current?.resume();
    // Some browsers only list their voices once asked; ask before the first phase needs one.
    if ("speechSynthesis" in window) window.speechSynthesis.getVoices();
    const c = clockRef.current;
    c.countIn = live.current.settings.countIn ? COUNT_IN : 0;
    c.elapsed = 0;
    c.origin = c.countIn;
    c.phaseKey = "";
    setDisplay(START);
    setCalm(false);
    setWave((w) => ({ kind: "start", n: (w?.n ?? 0) + 1 }));
    setStatus(c.countIn ? "countIn" : "running");
  }, []);

  const toggle = useCallback(() => {
    setCalm(false);
    if (status === "idle" || status === "done") return begin();
    if (status === "paused") {
      void audio.current?.resume();
      return setStatus(clockRef.current.elapsed < clockRef.current.countIn ? "countIn" : "running");
    }
    window.speechSynthesis?.cancel();
    setStatus("paused");
  }, [begin, status]);

  const restart = useCallback(() => {
    window.speechSynthesis?.cancel();
    clockRef.current.idle = 0;
    setDisplay(START);
    setStatus("idle");
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.().catch(() => {});
  }, []);

  const update = useCallback((next: MeditateSettings) => {
    const c = clockRef.current;
    // A new rhythm mid-session starts from a fresh in-breath rather than jumping into the middle of one.
    if (patternChanged(live.current.settings, next) && c.elapsed >= c.countIn) {
      c.origin = c.elapsed;
      c.phaseKey = "";
    }
    setSettings(next);
  }, []);

  // The settings live in the address, so the link is the saved session (D-120).
  useEffect(() => {
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${toSearch(settings)}`);
  }, [settings]);

  // The screen stays on while the guide runs.
  const active = status === "running" || status === "countIn";
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    void navigator.wakeLock
      .request("screen")
      .then((l) => {
        if (cancelled) void l.release();
        else lock = l;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      void lock?.release();
    };
  }, [active]);

  // Leaving the page pauses the guide rather than breathing on unseen.
  useEffect(() => {
    if (!active) return;
    const onHide = () => {
      if (!document.hidden) return;
      window.speechSynthesis?.cancel();
      setStatus("paused");
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [active]);

  // While it runs, the controls fade after a moment without movement.
  useEffect(() => {
    if (!active || panelOpen) return;
    let timer = window.setTimeout(() => setCalm(true), CALM_AFTER_MS);
    const wake = () => {
      setCalm(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setCalm(true), CALM_AFTER_MS);
    };
    window.addEventListener("pointermove", wake);
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, [active, panelOpen]);

  // Space begins or pauses, F is full screen, Escape closes the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, select, textarea, button, summary, a, [contenteditable]")) {
        if (e.key === "Escape" && panelOpen) setPanelOpen(false);
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        toggle();
      } else if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      } else if (e.key === "Escape" && panelOpen) {
        setPanelOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen, toggle, toggleFullscreen]);

  // Stop speaking and close the sound when the page goes.
  useEffect(
    () => () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      void audio.current?.close();
    },
    [],
  );

  /* ------------------------------------------------------------ render */
  const palette = PALETTE_COLORS[settings.palette];
  const style = {
    "--m-a": palette.a,
    "--m-b": palette.b,
    "--m-size": settings.size,
    "--m-ambient": settings.ambient,
    "--m-glow": settings.glow,
  } as CSSProperties;

  const session = status !== "idle" && status !== "done";
  const timed = settings.minutes > 0;
  const readout = timed ? clock(settings.minutes * 60 - display.elapsed) : clock(display.elapsed);
  const word = display.phase === "ready" ? copy.phases.ready : copy.phases[display.phase];
  const primary = status === "idle" ? copy.start : status === "done" ? copy.again : status === "paused" ? copy.resume : copy.pause;

  return (
    <div
      id={ROOT_ID}
      ref={rootRef}
      className="meditate"
      style={style}
      data-status={status}
      data-calm={calm && active && !panelOpen ? "" : undefined}
      data-still={status === "paused" || reduced ? "" : undefined}
      data-panel={panelOpen ? "" : undefined}
    >
      {settings.stars ? <StarField rootId={ROOT_ID} /> : null}
      <div className="m-ambient" ref={ambientRef} aria-hidden />

      <header className="m-bar m-chrome">
        <Link href="/" className="bar__brand m-brand" title={copy.home}>
          Numadelic
        </Link>
        <div className="m-bar__end">
          <LanguageSwitch locale={locale} label={copy.language} from={MEDITATE_RETURN} />
          {fullscreenSupported ? (
            <button
              type="button"
              className="m-icon"
              onClick={toggleFullscreen}
              aria-label={fullscreen ? copy.fullscreen.exit : copy.fullscreen.enter}
              title={fullscreen ? copy.fullscreen.exit : copy.fullscreen.enter}
            >
              {fullscreen ? <Minimize size={16} aria-hidden /> : <Maximize size={16} aria-hidden />}
            </button>
          ) : null}
          <button
            type="button"
            className="cl-ghost m-facilitator"
            aria-pressed={panelOpen}
            aria-controls="m-panel"
            onClick={() => setPanelOpen((o) => !o)}
          >
            <SlidersHorizontal size={16} aria-hidden />
            <span>{copy.panel.open}</span>
          </button>
        </div>
      </header>

      <main className="m-stage">
        <div className="m-breath" aria-hidden>
          <span className="m-halo" ref={haloRef} />
          <span className="m-orb" ref={orbRef}>
            <span className="m-orb__core" />
            <BreathOrb colors={palette.orb} glow={settings.glow} drift={reduced ? 0 : settings.drift} still={status === "paused"} level={level} />
          </span>
          {wave && !reduced ? (
            <span key={`${wave.kind}${wave.n}`} className="m-waves" data-kind={wave.kind}>
              <span className="m-wave" />
              <span className="m-wave" />
            </span>
          ) : null}
        </div>

        <div className="m-guide">
          {status === "idle" ? (
            <div className="m-intro">
              <h1 className="cl-title m-title">{copy.title}</h1>
              <p className="m-lead">{copy.intro}</p>
            </div>
          ) : status === "done" ? (
            <div className="m-intro m-done" role="status">
              <h1 className="cl-title m-title">{copy.done.title}</h1>
              <p className="m-lead">{copy.done.body}</p>
            </div>
          ) : (
            <div className="m-cue">
              <h1 className="cl-sr">{copy.title}</h1>
              {settings.ring ? (
                <span className="m-line" aria-hidden>
                  <span ref={lineRef} className="m-line__fill" />
                </span>
              ) : null}
              {settings.guidance ? (
                <p className="m-word" aria-live="polite">
                  <span key={`${display.cycle}:${display.phase}`}>{word}</span>
                </p>
              ) : null}
              {settings.countdown ? (
                <p className="m-count" aria-hidden>
                  <span key={`${display.cycle}:${display.phase}:${display.remaining}`}>{display.remaining}</span>
                </p>
              ) : null}
              {settings.cycles && display.phase !== "ready" ? (
                <p className="m-cycles cl-mono">
                  {copy.breaths} · {display.cycle + 1}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </main>

      <footer className="m-dock m-chrome">
        <div className="m-dock__row">
          <button type="button" className="cl-btn m-primary" onClick={toggle}>
            {status === "running" || status === "countIn" ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
            <span>{primary}</span>
          </button>
          {session ? (
            <button type="button" className="m-icon m-icon--lg" onClick={restart} aria-label={copy.restart} title={copy.restart}>
              <RotateCcw size={18} aria-hidden />
            </button>
          ) : null}
        </div>
        <div className="m-dock__row m-dock__meta">
          <label className="m-timer">
            <span className="cl-sr">{copy.timer.label}</span>
            <select value={settings.minutes} onChange={(e) => update({ ...settings, minutes: Number(e.target.value) })}>
              {(TIMER_MINUTES as readonly number[]).includes(settings.minutes) ? null : (
                <option value={settings.minutes}>{fill(copy.timer.minutes, settings.minutes)}</option>
              )}
              {TIMER_MINUTES.map((m) => (
                <option key={m} value={m}>
                  {m === 0 ? copy.timer.open : fill(copy.timer.minutes, m)}
                </option>
              ))}
            </select>
          </label>
          {session ? (
            <span className="m-readout" aria-label={timed ? copy.timer.remaining : copy.timer.elapsed}>
              {readout}
            </span>
          ) : (
            <span className="m-keys">{copy.keys}</span>
          )}
        </div>
      </footer>

      <FacilitatorPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        copy={copy}
        locale={locale}
        settings={settings}
        onChange={update}
      />
    </div>
  );
}

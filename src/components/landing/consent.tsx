"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { LandingCopy } from "@/content/landing/clear-light";

/**
 * Consent for optional third-party content (D-052). The public site sets no
 * cookie of its own; the one optional item is the section 3 YouTube film. The
 * visitor's choice is kept in localStorage for 12 months (a technical,
 * necessary record of the choice itself) and can be changed from "Configurar
 * cookies" in the footer. Accept and reject carry equal weight, as the AEPD
 * guidance asks.
 */
const KEY = "cl-consent-v1";
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
const CHANGE = "cl-consent-change";
const OPEN = "cl-consent-open";

type Choice = { thirdParty: boolean; at: number };

function read(): Choice | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Choice;
    if (typeof c.thirdParty !== "boolean" || typeof c.at !== "number" || Date.now() - c.at > MAX_AGE_MS) return null;
    return c;
  } catch {
    return null;
  }
}

export function setThirdPartyConsent(thirdParty: boolean) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ thirdParty, at: Date.now() } satisfies Choice));
  } catch {
    // Storage blocked: the choice holds for this page view only.
  }
  window.dispatchEvent(new CustomEvent(CHANGE, { detail: thirdParty }));
}

/** "none" before a choice (or on the server), then the stored choice. */
type State = "unknown" | "none" | "accepted" | "rejected";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useThirdPartyConsent(): State {
  return useSyncExternalStore(
    subscribe,
    () => {
      const c = read();
      return c ? (c.thirdParty ? "accepted" : "rejected") : "none";
    },
    () => "unknown",
  );
}

export function CookieBanner({ copy: CONSENT }: { copy: LandingCopy["CONSENT"] }) {
  const state = useThirdPartyConsent();
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    const open = () => setReopened(true);
    window.addEventListener(OPEN, open);
    return () => window.removeEventListener(OPEN, open);
  }, []);

  if (state === "unknown" || (state !== "none" && !reopened)) return null;

  const choose = (thirdParty: boolean) => {
    setThirdPartyConsent(thirdParty);
    setReopened(false);
  };

  return (
    <section className="consent" role="region" aria-labelledby="consent-title">
      <div className="consent__text">
        <h2 id="consent-title" className="consent__title">
          {CONSENT.title}
        </h2>
        <p>
          {CONSENT.body}{" "}
          <a href="/cookies" className="cl-link">
            {CONSENT.policy}
          </a>
        </p>
      </div>
      <div className="consent__actions">
        <button type="button" className="cl-ghost consent__choice" onClick={() => choose(false)}>
          {CONSENT.reject}
        </button>
        <button type="button" className="cl-ghost consent__choice" onClick={() => choose(true)}>
          {CONSENT.accept}
        </button>
      </div>
    </section>
  );
}

export function CookieSettingsButton({ label }: { label: string }) {
  return (
    <button type="button" className="foot__button" onClick={() => window.dispatchEvent(new Event(OPEN))}>
      {label}
    </button>
  );
}

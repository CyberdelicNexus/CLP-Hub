"use client";

import { useState } from "react";
import clsx from "clsx";
import { setThirdPartyConsent, useThirdPartyConsent } from "@/components/landing/consent";
import type { LandingCopy } from "@/content/landing/clear-light";

/**
 * The Qualtrics questionnaire, framed inside the site (D-085). It follows the
 * film player's rule (D-052): nothing loads from Qualtrics until the visitor
 * asks for it, and only with consent to third-party content; without consent
 * the click asks for it in place. The iframe is sandboxed to what a survey
 * needs.
 *
 * This component renders no form control of its own: the questionnaire, and
 * every answer to it, live at Qualtrics (D-031). The link to open it in a new
 * tab is always there, since an embedded survey can be blocked by the
 * account's embedding settings, or just be awkward on a small screen, and a
 * link is not a load of third-party content.
 */
export function ApplyFrame({ url, apply: APPLY }: { url: string; apply: LandingCopy["APPLY"] }) {
  const [requested, setRequested] = useState(false);
  const consent = useThirdPartyConsent();
  const open = requested && consent === "accepted";
  const asking = requested && consent !== "accepted";
  const { frame } = APPLY;

  return (
    <div className="apply__frame-wrap">
      <div className={clsx("apply__frame", open && "is-open")}>
        {open ? (
          <iframe
            className="apply__embed"
            src={url}
            title={frame.title}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <div className="apply__gate" aria-live="polite">
            {asking ? (
              <>
                <p className="apply__gate-text">{frame.blocked}</p>
                <button type="button" className="cl-btn" onClick={() => setThirdPartyConsent(true)}>
                  {frame.accept}
                </button>
              </>
            ) : (
              <>
                <p className="apply__gate-text">{frame.note}</p>
                <button type="button" className="cl-btn" onClick={() => setRequested(true)}>
                  {frame.open}
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <p className="apply__trouble">
        {frame.trouble}{" "}
        <a href={url} className="cl-link" target="_blank" rel="external noopener noreferrer">
          {frame.newTab}
        </a>
      </p>
    </div>
  );
}

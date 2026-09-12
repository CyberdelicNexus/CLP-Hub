import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACTIONS,
  HERO,
  INVITATION,
  JOIN,
  NAV,
  SPLIT,
  STAGES,
  isMissing,
  missingContentList,
  visibleStrings,
} from "@/content/landing/clear-light";

/**
 * The landing page is recruitment material for a randomized trial. These
 * tests pin the rules that protect participants and the ones that keep the
 * page from quietly inventing protocol facts (docs/landing-page.md, D-042).
 */
describe("landing copy rules", () => {
  it("contains no em or en dashes in any visible string", () => {
    const offenders = visibleStrings().filter((s) => /[–—]/.test(s));
    expect(offenders).toEqual([]);
  });

  it("uses exactly one label for the recruitment intent", () => {
    // The primary CTA label is identical wherever the intent appears and no
    // synonym for it exists in the copy.
    const label = ACTIONS.primaryCta;
    expect(label).toBe("Comprobar si puedo participar");
    const synonyms = visibleStrings().filter(
      (s) => /comprobar (mi )?elegibilidad|solicitar participaci|inscribirme|apuntarme|reservar/i.test(s),
    );
    expect(synonyms).toEqual([]);
  });

  it("never promises an outcome or uses urgency", () => {
    const banned = /transforma tu|cura|sana|mejora tu salud|plazas limitadas|últimas plazas|sin riesgos|garantiz(a|amos) (un )?benefici/i;
    const offenders = visibleStrings().filter((s) => banned.test(s) && !/no se garantiz/i.test(s));
    expect(offenders).toEqual([]);
  });

  it("says that showing interest is not consent, and that benefit is not guaranteed", () => {
    expect(INVITATION.support).toMatch(/no equivale a dar consentimiento/);
    expect(JOIN.supporting).toMatch(/no te compromete a participar/);
    expect(visibleStrings().some((s) => /No se garantizan? (un )?beneficio/.test(s))).toBe(true);
  });

  it("identifies the page as a research study in the hero", () => {
    expect(HERO.eyebrow.toLowerCase()).toContain("estudio");
    expect(HERO.headline.trim().startsWith("¿")).toBe(true);
  });

  it("keeps the nav and hero recruitment links inside the page, after the two groups are explained", () => {
    // The only outbound Qualtrics link lives in the final invitation, which
    // follows the randomization section. Everything else anchors there.
    expect(NAV.every((n) => n.href.startsWith("#"))).toBe(true);
    const hero = readFileSync(join(process.cwd(), "src/components/landing/sections/hero.tsx"), "utf8");
    expect(hero).toContain('href="#invitacion"');
    expect(hero).not.toMatch(/qualtricsUrl/);
  });
});

describe("two randomized groups", () => {
  it("has exactly two branches, described by one shared shape", () => {
    expect(SPLIT.branches).toHaveLength(2);
    for (const b of SPLIT.branches) {
      expect(Object.keys(b).sort()).toEqual(["condition", "label"]);
      expect(isMissing(b.condition)).toBe(true);
    }
  });

  it("does not describe either group as preferable", () => {
    const text = [SPLIT.heading, SPLIT.body, SPLIT.supporting, ...SPLIT.branches.map((b) => b.label)].join(" ");
    expect(text).not.toMatch(/mejor|preferible|ventaja|beneficio/i);
    expect(SPLIT.supporting).toMatch(/misma importancia/);
  });

  it("renders both branches from the same component with only a direction token", () => {
    const source = readFileSync(join(process.cwd(), "src/components/landing/sections/split.tsx"), "utf8");
    expect(source).toMatch(/SPLIT\.branches\.map/);
    expect(source).not.toMatch(/branch--program|branch--control/);
  });
});

describe("programme stages", () => {
  it("lists S0 to S6 in order, each with a poster", () => {
    expect(STAGES.items.map((s) => s.code)).toEqual(["S0", "S1", "S2", "S3", "S4", "S5", "S6"]);
    for (const s of STAGES.items) {
      expect(s.media.poster).toMatch(/^\/landing\/media\/stage-s\d\.webp$/);
      expect(s.media.alt.length).toBeGreaterThan(10);
    }
  });

  it("keeps the onboarding steps separate from the programme stages", () => {
    const stageNames = STAGES.items.map((s) => s.name);
    for (const step of JOIN.steps) expect(stageNames).not.toContain(step.label);
    expect(JOIN.steps).toHaveLength(3);
  });
});

describe("missing approved content", () => {
  it("is listed, unique, and includes the Qualtrics URL until one is configured", () => {
    const list = missingContentList();
    const keys = list.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("URL_QUALTRICS");
    expect(keys).toContain("CRITERIOS");
    expect(missingContentList({ qualtricsUrl: "https://example.org/x" }).map((m) => m.key)).not.toContain(
      "URL_QUALTRICS",
    );
  });

  it("is documented in docs/landing-page.md, key by key", () => {
    const doc = readFileSync(join(process.cwd(), "docs/landing-page.md"), "utf8");
    for (const m of missingContentList()) expect(doc).toContain(m.key);
  });

  it("renders as nothing in production, so a marker can never be published", () => {
    const source = readFileSync(join(process.cwd(), "src/components/landing/missing.tsx"), "utf8");
    expect(source).toMatch(/if \(isProduction\(\)\) return null/);
    const page = readFileSync(join(process.cwd(), "src/app/(public)/page.tsx"), "utf8");
    expect(page).toMatch(/isProduction\(\) && missingContentList/);
  });
});

describe("the landing page collects nothing", () => {
  it("has no form, input or server action anywhere under the landing components", () => {
    const dir = join(process.cwd(), "src/components/landing");
    const files = [
      "clear-light-landing.tsx",
      "sections/hero.tsx",
      "sections/why-what.tsx",
      "sections/stages.tsx",
      "sections/join.tsx",
      "sections/split.tsx",
      "sections/eligibility.tsx",
      "sections/invitation.tsx",
    ];
    for (const f of files) {
      const source = readFileSync(join(dir, f), "utf8");
      expect(source, f).not.toMatch(/<form|<input|<textarea|"use server"/);
    }
  });
});

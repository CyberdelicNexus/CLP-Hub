import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LEGAL } from "@/content/landing/legal";
import {
  ACTIONS,
  CONTACT,
  ELIGIBILITY,
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
      expect(Object.keys(b).sort()).toEqual(["condition", "label", "lines"]);
      // Draft wording: the approval key keeps blocking publication.
      expect(isMissing(b.condition)).toBe(true);
    }
    expect(SPLIT.branches[0].lines).toHaveLength(SPLIT.branches[1].lines.length);
  });

  it("explains what a randomized controlled trial is before naming the groups", () => {
    const body = SPLIT.body.join(" ");
    expect(body).toMatch(/ensayo controlado aleatorizado/);
    expect(body).toMatch(/azar/);
  });

  it("does not describe either group as preferable", () => {
    const text = [
      SPLIT.heading,
      ...SPLIT.body,
      SPLIT.supporting,
      ...SPLIT.branches.flatMap((b) => [b.label, ...b.lines]),
    ].join(" ");
    expect(text).not.toMatch(/mejor|preferible|ventaja|beneficio/i);
    expect(SPLIT.supporting).toMatch(/misma importancia/);
  });

  it("renders both branches from the same component with only a direction token", () => {
    const source = readFileSync(join(process.cwd(), "src/components/landing/sections/split.tsx"), "utf8");
    expect(source).toMatch(/SPLIT\.branches\.map/);
    expect(source).not.toMatch(/branch--program|branch--control/);
    const stage = readFileSync(join(process.cwd(), "src/components/landing/split-stage.tsx"), "utf8");
    expect(stage).toMatch(/DIRS\.map\(\(dir\) => \(\s*<Signal/);
  });
});

describe("eligibility and questions", () => {
  it("answers every question with at least one statement", () => {
    for (const f of ELIGIBILITY.faq) expect(f.statements.length, f.id).toBeGreaterThan(0);
  });

  it("lists only the criteria the founder supplied, and remits the rest to the team", () => {
    expect(ELIGIBILITY.criteriaItems).toEqual(["Tener una enfermedad que amenaza la vida.", "Hablar castellano."]);
    expect(ELIGIBILITY.criteriaText).toMatch(/todos los criterios aprobados/);
    // The list is not yet the full approved protocol set (no exclusions), so it still gates publication.
    expect(missingContentList().map((m) => m.key)).toContain("CRITERIOS");
  });

  it("keeps telling the reader that the groups are assigned at random", () => {
    const grupos = ELIGIBILITY.faq.find((f) => f.id === "grupos");
    expect(grupos?.statements.join(" ")).toMatch(/al azar/);
  });
});

describe("programme stages", () => {
  it("lists S0 to S6 in order, each with its own image and size", () => {
    expect(STAGES.items.map((s) => s.code)).toEqual(["S0", "S1", "S2", "S3", "S4", "S5", "S6"]);
    STAGES.items.forEach((s, k) => {
      // A stage's image may carry a version suffix (etapa-s2-v2.webp) when a
      // replacement needs a fresh URL to dodge a stale cache (D-056); the
      // stage-index prefix must still match.
      expect(s.media.src).toMatch(new RegExp(`^/landing/media/etapa-s${k}(-v\\d+)?\\.webp$`));
      expect(s.media.width).toBeGreaterThan(0);
      expect(s.media.height).toBeGreaterThan(0);
      expect(s.media.alt.length).toBeGreaterThan(10);
    });
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

describe("footer, contact, consent and legal pages (D-052)", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("has no team access link on the public footer, but keeps a pause control", () => {
    const footer = read("src/components/landing/site-footer.tsx");
    expect(footer).not.toMatch(/TEAM_BASE_PATH|\/login/);
    expect(footer).toMatch(/<StillToggle/);
    expect(read("src/components/landing/still-toggle.tsx")).toMatch(/aria-label=\{label\}/);
  });

  it("links the three legal pages from the footer, and each route exists", () => {
    const hrefs = INVITATION.footer.groups.flatMap((g) => g.links.map((l) => l.href));
    for (const page of LEGAL.pages) {
      expect(hrefs).toContain(`/${page.slug}`);
      expect(read(`src/app/(public)/${page.slug}/page.tsx`)).toMatch(new RegExp(`slug="${page.slug}"`));
    }
  });

  it("keeps every legal fact the team has not supplied in the publication gate", () => {
    const keys = missingContentList().map((m) => m.key);
    for (const k of ["TITULAR_WEB", "RESPONSABLE_TRATAMIENTO", "DPO", "BASE_JURIDICA", "PLAZO_CONSERVACION", "ENCARGADOS_TRATAMIENTO", "REVISION_LEGAL", "CONTACTO_FORMULARIO", "PROTECCION_DATOS"]) {
      expect(keys).toContain(k);
    }
  });

  it("offers accept and reject with the same weight, and loads YouTube only with consent", () => {
    const consent = read("src/components/landing/consent.tsx");
    const choices = consent.match(/className="cl-ghost consent__choice"/g) ?? [];
    expect(choices).toHaveLength(2);
    const film = read("src/components/landing/film-player.tsx");
    expect(film).toMatch(/const playing = requested && consent === "accepted"/);
  });

  it("gives the contact form no destination: no action, request, storage or server code", () => {
    const dialog = read("src/components/landing/contact-dialog.tsx");
    expect(dialog).toMatch(/e\.preventDefault\(\)/);
    expect(dialog).not.toMatch(/action=|fetch\(|XMLHttpRequest|sendBeacon|localStorage|"use server"|mailto:/);
    expect(CONTACT.healthNote).toMatch(/no incluyas información sobre tu salud/);
  });

  it("carries the founder's benefits wording and a data protection answer", () => {
    const beneficios = ELIGIBILITY.faq.find((f) => f.id === "beneficios")?.statements.join(" ") ?? "";
    expect(beneficios).toMatch(/no será remunerada/);
    expect(ELIGIBILITY.faq.find((f) => f.id === "datos")?.statements.length).toBeGreaterThan(0);
  });
});

describe("mobile reading and the hero scroll lock (D-061)", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("never hides copy until the reading light's script is running", () => {
    // No-JS and pre-hydration readers must see finished copy, so the hidden
    // state is scoped to the attribute the component sets on mount.
    const css = read("src/components/landing/landing.css");
    expect(css).toMatch(/\.reading\[data-reading="live"\] \[data-reading-block\] \{/);
    expect(css).not.toMatch(/^\s*\[data-reading-block\] \{\s*$\n\s*opacity: 0/m);
    expect(read("src/components/landing/reading-light.tsx")).toMatch(/root\.dataset\.reading = "live"/);
  });

  it("lights a block once and leaves it lit", () => {
    const source = read("src/components/landing/reading-light.tsx");
    expect(source).toMatch(/if \(block\.dataset\.lit !== undefined\) continue/);
    expect(source).not.toMatch(/delete block\.dataset\.lit/);
  });

  it("keeps the engine's flow reveal readable without scripting", () => {
    expect(read("src/components/landing/landing.css")).toMatch(
      /html:not\(\.sc-ready\) \.cl :is\(\[data-sc-cue\], \[data-sc-in\], \[data-sc-stagger\] > \*\)/,
    );
  });

  it("holds the scroll only downward, and can always be escaped", () => {
    const source = read("src/components/landing/light-sequence.tsx");
    // Down blocks, up releases.
    expect(source).toMatch(/if \(e\.deltaY > 0\) e\.preventDefault\(\);\s*\n\s*else if \(e\.deltaY < 0\) release\(\)/);
    // Escape, moving focus, "Pausar animación", leaving the stage and a hard cap.
    expect(source).toMatch(/UP_KEYS\.has\(e\.key\)\) return release\(\)/);
    expect(source).toMatch(/UP_KEYS = new Set\(\[[^\]]*"Escape"/);
    expect(source).toMatch(/const onFocusIn = \(\) => release\(\)/);
    expect(source).toMatch(/now >= lockUntil \|\| leaving \|\| still\)\) release\(\)/);
    expect(source).toMatch(/hardUntil = performance\.now\(\) \+ LOCK_MAX_MS/);
    // Never on the stacked variant, reduced motion or a paused page.
    expect(source).toMatch(/if \(locked \|\| still \|\| !mq\.matches\) return/);
  });

  it("does not draw the stage marker, but still gates publication on it", () => {
    expect(read("src/components/landing/sections/stages.tsx")).not.toMatch(/<Missing/);
    expect(missingContentList().map((m) => m.key)).toContain("DESCRIPCION_ETAPAS");
  });
});

describe("the landing page collects nothing", () => {
  it("has no form, input or server action under the landing components, except the unsent contact dialog", () => {
    // contact-dialog.tsx renders a form that goes nowhere (D-052); the test above pins that.
    const dir = join(process.cwd(), "src/components/landing");
    const files = [
      "clear-light-landing.tsx",
      "site-footer.tsx",
      "consent.tsx",
      "legal-page.tsx",
      "sections/opening.tsx",
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

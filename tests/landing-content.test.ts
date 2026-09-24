import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { LANDING_COPY, LEGAL_COPY } from "@/content/landing/copy";
import { LEGAL, legalPage } from "@/content/landing/legal";
import { LOCALES, PUBLIC_LOCALES, parsePublicLocale } from "@/domain/locale";
import { LOCALE_COOKIE, PUBLIC_LOCALE_COOKIE } from "@/i18n/cookies";
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
    expect(visibleStrings().some((s) => /no se garantizan? (un )?beneficios?/i.test(s))).toBe(true);
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

describe("translated landing copy", () => {
  it("keeps the participant information aligned with the Spanish source", () => {
    const spanish = LANDING_COPY.es;
    for (const locale of ["en", "gl"] as const) {
      const copy = LANDING_COPY[locale];
      expect(copy.JOIN.steps.map((step) => step.numeral)).toEqual(spanish.JOIN.steps.map((step) => step.numeral));
      expect(copy.SPLIT.branches.map((branch) => branch.lines.length)).toEqual(
        spanish.SPLIT.branches.map((branch) => branch.lines.length),
      );
      expect(copy.ELIGIBILITY.faq.map((item) => [item.id, item.statements.length])).toEqual(
        spanish.ELIGIBILITY.faq.map((item) => [item.id, item.statements.length]),
      );
      expect(copy.STAGES.items.map((stage) => [stage.code, stage.media.src])).toEqual(
        spanish.STAGES.items.map((stage) => [stage.code, stage.media.src]),
      );
      const participantCopy = [
        ...copy.SPLIT.body,
        ...copy.SPLIT.branches.flatMap((branch) => branch.lines),
        ...copy.ELIGIBILITY.faq.flatMap((item) => item.statements),
      ].join(" ");
      expect(participantCopy).not.toMatch(/similar experience|experiencia similar|seven stages|sete etapas/i);
    }
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
    expect(ELIGIBILITY.criteriaItems).toEqual(["Tener una enfermedad grave o avanzada.", "Hablar castellano."]);
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
    for (const k of ["TITULAR_WEB", "RESPONSABLE_TRATAMIENTO", "BASE_JURIDICA", "PLAZO_CONSERVACION", "ENCARGADOS_TRATAMIENTO", "REVISION_LEGAL", "CONTACTO_FORMULARIO", "PROTECCION_DATOS"]) {
      expect(keys).toContain(k);
    }
    // DPO resolved (D-081): the CEImG-approved consent form gives its contact
    // verbatim, and a DPO's contact is a public fact GDPR requires publishing,
    // not a legal judgment call the way the other keys above are.
    expect(keys).not.toContain("DPO");
    expect(LEGAL.pages.find((pg) => pg.slug === "privacidad")?.sections[0]?.blocks[0]).toMatchObject({
      kind: "rows",
      rows: [{ label: "Responsable" }, { label: "Delegado de Protección de Datos", value: expect.stringContaining("dpd@usc.gal") }],
    });
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

describe("hero video-free; El porqué/El qué a video-free pinned crossfade (D-077 to D-079)", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("keeps the engine's flow reveal readable without scripting", () => {
    expect(read("src/components/landing/landing.css")).toMatch(
      /html:not\(\.sc-ready\) \.cl :is\(\[data-sc-cue\], \[data-sc-in\], \[data-sc-stagger\] > \*\)/,
    );
  });

  it("no longer ships the pinned opening sequence's scroll-jacking clip (D-077)", () => {
    // The team asked for the hero video and its scroll hold removed; nothing
    // under components/landing should reference the deleted controller.
    const dir = join(process.cwd(), "src/components/landing");
    for (const f of ["sections/opening.tsx", "sections/hero.tsx", "landing.css"]) {
      expect(readFileSync(join(dir, f), "utf8"), f).not.toMatch(/light-sequence|LightSequence|op__video|opening__act/);
    }
  });

  it("no longer ships the travelling reading light (D-078)", () => {
    const dir = join(process.cwd(), "src/components/landing");
    for (const f of ["sections/opening.tsx", "sections/why-what.tsx", "landing.css"]) {
      expect(readFileSync(join(dir, f), "utf8"), f).not.toMatch(/reading-light|ReadingLight|data-reading-block|data-reading=/);
    }
  });

  it("El porqué and El qué crossfade in place, opacity only, no video (D-079)", () => {
    // "instead of the second section text moving up and down, it should stay
    // put and only gets revealed and dissolved" — data-sc-rise="0" is the
    // vendored engine's own way to disable its default vertical drift.
    const source = read("src/components/landing/sections/why-what.tsx");
    expect(source).toMatch(/data-sc-act="pin"/);
    expect(source.match(/data-sc-cue=/g)?.length).toBe(2);
    expect(source.match(/data-sc-rise="0"/g)?.length).toBeGreaterThanOrEqual(2);
    expect(source).not.toMatch(/<video|youtubeId.*&&|light-sequence/i);
  });

  it("El porqué fades in place: not opaque at p = 0, no lift in the stacked variant (D-083)", () => {
    const source = read("src/components/landing/sections/why-what.tsx");
    expect(source).toMatch(/const FADE_IN = 0\.1/);
    expect(source).toMatch(/k === 0 \? FADE_IN \/ win/);
    const css = read("src/components/landing/landing.css");
    expect(css).toMatch(/\.porque__inner\[data-sc-in\]\s*\{\s*transform:\s*none/);
    expect(css).toMatch(/\.porque-que\s*\{\s*scroll-margin-top:\s*-12vh/);
  });

  it("has no seam light between El porqué and El qué (D-079)", () => {
    // "remove the light orb from the section with the video" — the Signal
    // that used to rest half in each section is gone, not relocated.
    const source = read("src/components/landing/sections/why-what.tsx");
    expect(source).not.toMatch(/porque__light|<Signal/);
    expect(read("src/components/landing/landing.css")).not.toMatch(/\.porque__light/);
  });

  it("reveals each block of the stacked (mobile/reduced-motion/no-JS) fallback with data-sc-in", () => {
    const source = read("src/components/landing/sections/why-what.tsx");
    expect(source.match(/data-sc-in/g)?.length).toBeGreaterThanOrEqual(3);
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
      "sections/partners.tsx",
      "sections/invitation.tsx",
      "language-switch.tsx",
    ];
    for (const f of files) {
      const source = readFileSync(join(dir, f), "utf8");
      expect(source, f).not.toMatch(/<form|<input|<textarea|"use server"/);
    }
  });
});

describe("the public site in Spanish, English and Galician (D-063)", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  const TRANSLATIONS = PUBLIC_LOCALES.filter((l) => l !== "es");
  /** Fields that identify, link or size something: identical in every language. */
  const FIXED = new Set(["href", "src", "width", "height", "code", "numeral", "id", "slug", "kind"]);

  /** Walks a translation against the Spanish source and lists every structural difference. */
  function differences(es: unknown, tr: unknown, path: string, out: string[]): string[] {
    if (isMissing(es)) {
      // The same marker object, so the gate cannot differ by language.
      if (tr !== es) out.push(`${path}: not the Spanish marker`);
    } else if (typeof es === "string") {
      if (typeof tr !== "string" || tr.trim() === "") out.push(`${path}: missing text`);
    } else if (Array.isArray(es)) {
      if (!Array.isArray(tr) || tr.length !== es.length) out.push(`${path}: length differs`);
      else es.forEach((v, i) => differences(v, tr[i], `${path}[${i}]`, out));
    } else if (es && typeof es === "object") {
      const t = tr as Record<string, unknown>;
      if (!t || typeof t !== "object") return [...out, `${path}: not an object`];
      const keys = Object.keys(es).sort();
      if (keys.join() !== Object.keys(t).sort().join()) out.push(`${path}: keys differ`);
      for (const k of keys) {
        const v = (es as Record<string, unknown>)[k];
        if (FIXED.has(k)) {
          if (t[k] !== v) out.push(`${path}.${k}: must equal the Spanish value`);
        } else differences(v, t[k], `${path}.${k}`, out);
      }
    } else if (tr !== es) out.push(`${path}: differs`);
    return out;
  }

  it("offers Spanish first, and keeps Galician out of the staff UI", () => {
    expect(PUBLIC_LOCALES[0]).toBe("es");
    expect([...PUBLIC_LOCALES].sort()).toEqual(["en", "es", "gl"]);
    expect(LOCALES).not.toContain("gl");
    expect(PUBLIC_LOCALE_COOKIE).not.toBe(LOCALE_COOKIE);
    expect(parsePublicLocale("fr")).toBe("es");
    expect(parsePublicLocale(undefined)).toBe("es");
  });

  it.each(TRANSLATIONS)("%s has the Spanish shape, links, media and markers", (locale) => {
    expect(differences(LANDING_COPY.es, LANDING_COPY[locale], "landing", [])).toEqual([]);
    expect(differences(LEGAL_COPY.es, LEGAL_COPY[locale], "legal", [])).toEqual([]);
  });

  it.each(PUBLIC_LOCALES)("%s has no em or en dashes", (locale) => {
    const offenders = visibleStrings(LANDING_COPY[locale], LEGAL_COPY[locale]).filter((s) => /[–—]/.test(s));
    expect(offenders).toEqual([]);
  });

  it.each(TRANSLATIONS)("%s still says interest is not consent, benefit is not guaranteed, and the groups are random", (locale) => {
    const c = LANDING_COPY[locale];
    const expected = {
      en: { consent: /not the same as giving consent/i, benefit: /not guaranteed/i, trial: /randomized controlled trial/i },
      gl: { consent: /non equivale a dar consentimento/i, benefit: /non se garanten/i, trial: /ensaio controlado aleatorizado/i },
    }[locale as "en" | "gl"];
    expect(c.INVITATION.support).toMatch(expected.consent);
    expect(c.ELIGIBILITY.faq.find((f) => f.id === "beneficios")?.statements.join(" ")).toMatch(expected.benefit);
    expect(c.SPLIT.body.join(" ")).toMatch(expected.trial);
    expect(c.SPLIT.branches[0].lines).toHaveLength(c.SPLIT.branches[1].lines.length);
  });

  it("gates publication on the Spanish markers alone", () => {
    // Every translation reuses them (checked above), so there is one list.
    const keys = missingContentList().map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(PUBLIC_LOCALES)("%s lists the language cookie in its cookie policy", (locale) => {
    const cookies = legalPage("cookies", LEGAL_COPY[locale]);
    const table = cookies.sections.flatMap((s) => s.blocks).find((b) => b.kind === "table");
    expect(table?.kind === "table" && table.rows.some((r) => r[0].includes(PUBLIC_LOCALE_COOKIE))).toBe(true);
  });

  it("renders every section from the visitor's copy, never from a Spanish constant", () => {
    const dir = "src/components/landing";
    for (const f of ["sections/hero.tsx", "sections/why-what.tsx", "sections/stages.tsx", "sections/join.tsx", "sections/split.tsx", "sections/eligibility.tsx", "sections/invitation.tsx", "site-footer.tsx", "consent.tsx", "contact-dialog.tsx", "film-player.tsx", "clear-light-landing.tsx", "legal-page.tsx"]) {
      const source = read(`${dir}/${f}`);
      expect(source, f).not.toMatch(/import \{[^}]*\b(ACTIONS|NAV|HERO|WHY|WHAT|STAGES|JOIN|SPLIT|ELIGIBILITY|INVITATION|CONTACT|CONSENT|META|LEGAL)\b[^}]*\} from "@\/content\/landing/);
      expect(source, f).not.toMatch(/lang="es"/);
    }
    expect(read("src/app/(public)/page.tsx")).not.toMatch(/lang="es"/);
  });

  it("switches language with a plain link that sets only the language cookie and returns to a public page", async () => {
    const { GET } = await import("@/app/(public)/idioma/[locale]/route");
    const call = (locale: string, query = "") =>
      GET(new NextRequest(`https://example.org/idioma/${locale}${query}`), { params: Promise.resolve({ locale }) });

    const ok = await call("gl", "?desde=%2Fprivacidad");
    expect(ok.status).toBe(303);
    expect(ok.headers.get("location")).toBe("https://example.org/privacidad");
    expect(ok.cookies.get(PUBLIC_LOCALE_COOKIE)?.value).toBe("gl");
    expect(ok.cookies.getAll()).toHaveLength(1);

    // Anything but a public page goes home: the link is not an open redirect.
    for (const from of ["https://evil.example", "//evil.example", "/equipo"]) {
      const res = await call("en", `?desde=${encodeURIComponent(from)}`);
      expect(res.headers.get("location")).toBe("https://example.org/");
    }

    const unknown = await call("fr");
    expect(unknown.status).toBe(404);
    expect(unknown.cookies.getAll()).toHaveLength(0);
  });
});

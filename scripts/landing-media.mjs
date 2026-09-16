#!/usr/bin/env node
/**
 * Landing-page media derivatives.
 *
 * Reads the ORIGINAL handoff media (tracked under claude-handoff-v3/) and
 * writes the web derivatives that the landing page actually ships under
 * public/landing/media. Originals are never modified; the derivatives are
 * regenerated from them.
 *
 *   node scripts/landing-media.mjs [--src <handoff assets dir>] [--only images|video]
 *
 * Default source: ./claude-handoff-v3/assets (the design handoff package).
 *
 * Rules applied here (docs/landing-page.md):
 * - Nothing is sharpened or upscaled beyond its source resolution. Images are
 *   written as full-resolution, high-quality masters; next/image resizes them.
 * - Every clip is silent; nothing on the page may depend on audio.
 * - A derivative whose content changes gets a new file name: next/image and
 *   browsers cache by URL.
 *
 * Requires ffmpeg on PATH. sharp comes with Next.js.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i > -1 && argv[i + 1] ? argv[i + 1] : fallback;
};
const SRC = resolve(arg("--src", "claude-handoff-v3/assets"));
const OUT = resolve("public/landing/media");
const ONLY = arg("--only", "all");

if (!existsSync(SRC)) {
  console.error(`Source directory not found: ${SRC}`);
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const src = (...p) => resolve(SRC, ...p);
const out = (name) => resolve(OUT, name);
const master = (file, name, quality = 92) =>
  sharp(src(file)).webp({ quality, smartSubsample: true, effort: 6 }).toFile(out(name));

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------
const HERO_LUMINOUS = "hero-reveal/Numadelic Circle Upscaled.png";
// D-059 then D-060: the founder's own re-renders of the physical layer
// photograph, at their own resolutions (D-059 was 5460x3072; D-060, "without
// the weird carpet issue", is 3360x1888). Only the hero's physical layer uses
// this; the section 3 poster (below) now has its own, unrelated source.
const HERO_PHYSICAL_V3 = "hero-reveal/hero-circle-humans-enhanced.png";

async function images() {
  // Hero layers: same source size (3344x1882), same crop, so they register.
  // A small or heavily compressed master is compressed twice by next/image and
  // bands visibly across these dark gradients on a retina screen.
  await master(HERO_LUMINOUS, "hero-luminous-hd.webp", 95);
  await master(HERO_PHYSICAL_V3, "hero-physical-v3.webp");

  // Section 3 film preview, 16:9, `object-fit: cover` in the page (no manual
  // pre-crop needed: this source's own aspect ratio, 2400x1372, is already
  // close to 16:9). D-060: the founder's single-participant reference photo,
  // replacing the circle-of-seven crop this used to be.
  await master("stock-images/physical-cloud-reveal-reference.png", "film-poster-v2.webp");

  // Section 4: one image per programme stage, S0 to S6. Mixed aspect ratios on
  // black; shown whole (never cropped) with a feathered edge in the page.
  // S2 went through several founder revisions (D-055 to D-058): an enhanced
  // version, a hand-edited portrait crop of `Etapas/S2.png`, then the same
  // file re-edited landscape (3632x2048, D-058). `etapa-s2.webp` is pinned by
  // tests/landing-content.test.ts's `etapa-s${k}.webp` pattern (a `-v<n>`
  // suffix is allowed); each revision gets a fresh derivative name so neither
  // the dev server's image cache nor a visitor's browser cache can keep
  // serving a stale one (D-056 hit this the hard way).
  const ETAPAS = { 2: ["Etapas/S2.png", "etapa-s2-v4.webp"] };
  for (let k = 0; k <= 6; k++) {
    const [file, name] = ETAPAS[k] ?? [`Etapas/S${k}.png`, `etapa-s${k}.webp`];
    await master(`stock-images/${file}`, name);
  }

  // Section 5: one photograph per onboarding step (1672x941, subject on the
  // right, dark on the left where the copy sits). The source file numbers do
  // not follow the step order; the mapping is by what each picture shows.
  // Step 1 (D-055): the founder's enhanced "responde" photo, under a new
  // derivative name (join-responde-v2.webp) since nothing pins the old one.
  await master("stock-images/02-responde-enhanced.jpeg", "join-responde-v2.webp");
  await master("stock-images/01-habla.png", "join-habla.webp");
  await master("stock-images/03-recibe.png", "join-recibe.webp");

  // Section 7: the documentary participant with the heart light. D-056
  // replaces D-053's photo with the founder's third "FAQ" version (2048x2720,
  // in fact a PNG). New file name again, same reasoning as above.
  await sharp(src("stock-images/FAQ-enhanced-image-3.jpeg"))
    .webp({ quality: 92 })
    .toFile(out("participant-heart-v3.webp"));

  // Section 8 (D-052): the founder's footer frame, six bodies in an arc with the
  // fire at its centre (3342x1882). The lower half is empty black, so only the
  // top 1040px ship.
  await sharp(src("stock-images/footer/footer.png"))
    .extract({ left: 0, top: 0, width: 3342, height: 1040 })
    .webp({ quality: 92 })
    .toFile(out("footer-arc.webp"));

  console.log("images written");
}

// ---------------------------------------------------------------------------
// Video
// ---------------------------------------------------------------------------
// The opening light sequence (light-sequence.tsx): seven bodies coalesce into
// one light (0 to 3.6s), it sinks to the bottom (rest at 5.25s), then rises to
// the top (rest at 7.9s). Played at its own rate, never scrubbed, so a normal
// GOP is right; keyframes are forced on the three rest times so a jump back to
// a rest seeks to an exact frame. Native 1280x720, no audio, low CRF because
// the whole frame is a dark gradient that bands easily.
const LIGHT_SEQUENCE = "hero-reveal/Numadelics_Gemini Omni Flash Reference to Video_2026-09-14_12-17-53.mp4";

function video() {
  execFileSync(
    "ffmpeg",
    [
      "-v", "error", "-y",
      "-i", src(LIGHT_SEQUENCE),
      "-vf", "format=yuv420p",
      "-an",
      "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", "17",
      "-g", "24", "-force_key_frames", "0,5.25,7.9",
      "-movflags", "+faststart",
      out("light-sequence.mp4"),
    ],
    { stdio: "inherit" },
  );
  console.log("video written");
}

if (ONLY === "all" || ONLY === "images") await images();
if (ONLY === "all" || ONLY === "video") video();

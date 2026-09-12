#!/usr/bin/env node
/**
 * Landing-page media derivatives.
 *
 * Reads the ORIGINAL handoff media (22 MB of source footage and 1.2-1.6 MB
 * PNGs, tracked under claude-handoff-v3/) and writes the web derivatives that
 * the landing page actually ships under public/landing/media. Originals are
 * never modified; the derivatives are regenerated from them.
 *
 *   node scripts/landing-media.mjs [--src <handoff assets dir>] [--only images|video]
 *
 * Default source: ./claude-handoff-v3/assets (the design handoff package).
 *
 * Rules applied here (docs/landing-page.md):
 * - Footage is soft and low resolution by design. It is cropped and scaled,
 *   never sharpened or upscaled beyond its content bounds.
 * - Every derivative is silent. The source clips carry only ambient audio and
 *   nothing on the page may depend on English audio.
 * - Every clip gets a poster from a representative frame.
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

function ffmpeg(args) {
  execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------
async function images() {
  // Hero layers: same source size (1672x941), same crop, so they register.
  for (const [file, name] of [
    ["hero-reveal/hero-luminous-soft-v3.png", "hero-luminous.webp"],
    ["hero-reveal/hero-physical-quest3-v3.png", "hero-physical.webp"],
  ]) {
    await sharp(src(file)).resize({ width: 1600 }).webp({ quality: 82 }).toFile(out(name));
  }

  // Section 7: the documentary participant with the heart light (1200x686).
  await sharp(src("source-media/images/physical-cloud-reveal-reference.png"))
    .webp({ quality: 84 })
    .toFile(out("participant-heart.webp"));

  // Section 8: the body arc is the top of "CL circle 2" (1136x806) and the
  // fire is a crop of the same frame. Both are authentic source frames.
  const circle2 = src("source-media/images/CL circle 2.png");
  await sharp(circle2)
    .extract({ left: 0, top: 0, width: 1136, height: 380 })
    .webp({ quality: 84 })
    .toFile(out("arc-top.webp"));
  await sharp(circle2)
    .extract({ left: 400, top: 320, width: 270, height: 270 })
    .resize({ width: 320 })
    .webp({ quality: 84 })
    .toFile(out("fire.webp"));

  console.log("images written");
}

// ---------------------------------------------------------------------------
// Video
// ---------------------------------------------------------------------------
// Content bounds measured with ffmpeg cropdetect: the two mp4 files are
// pillarboxed 1080x1080 content inside 1920x1080; the MOV files are 1024 square.
const CLIPS = {
  phase1: { file: "source-media/videos/short phase 1.mp4", crop: "1080:1080:420:0" },
  phase2: { file: "source-media/videos/short phase 2.MOV", crop: "1024:1024:0:0" },
  phase3: { file: "source-media/videos/short phase 3.MOV", crop: "1024:1024:0:0" },
  // The ring of lights occupies a small band; a tighter crop keeps it legible.
  phase4: { file: "source-media/videos/short phase 4 group.mp4", crop: "720:720:600:180" },
};

// Stage clips: 8-second loops. Which clip means what is art direction from
// docs/03_MEDIA_MOTION_DIRECTION.md, confirmed by inspecting the frames.
const STAGES = [
  { id: "s0", clip: "phase1", start: 1, still: true },
  { id: "s1", clip: "phase1", start: 14 },
  { id: "s2", clip: "phase1", start: 28 },
  { id: "s3", clip: "phase3", start: 12 },
  { id: "s4", clip: "phase2", start: 6 },
  { id: "s5", clip: "phase4", start: 8 },
  { id: "s6", clip: "phase3", start: 46 },
];

// Section 5 interim visuals (see docs/landing-page.md: documentary onboarding
// photos are still missing; these are quiet source frames used meanwhile).
const JOIN_STILLS = [
  { id: "join-1", clip: "phase2", at: 10 },
  { id: "join-2", clip: "phase3", at: 50 },
  { id: "join-3", clip: "phase4", at: 12 },
];

function poster(clip, at, name, size = 720) {
  const { file, crop } = CLIPS[clip];
  ffmpeg(["-ss", String(at), "-i", src(file), "-frames:v", "1", "-vf", `crop=${crop},scale=${size}:${size}`, out(`${name}.webp`)]);
}

function encode(clip, start, duration, name, crf) {
  const { file, crop } = CLIPS[clip];
  ffmpeg([
    "-ss", String(start), "-t", String(duration), "-i", src(file),
    "-vf", `crop=${crop},scale=720:720,fps=25`,
    "-an",
    "-c:v", "libx264", "-preset", "slow", "-crf", String(crf), "-pix_fmt", "yuv420p",
    "-g", "50", "-movflags", "+faststart",
    out(`${name}.mp4`),
  ]);
}

function video() {
  for (const s of STAGES) {
    poster(s.clip, s.start + 1, `stage-${s.id}`);
    if (!s.still) encode(s.clip, s.start, 8, `stage-${s.id}`, 28);
  }
  for (const j of JOIN_STILLS) poster(j.clip, j.at, j.id, 960);
  // Section 3 film: the whole of phase 1, silent.
  poster("phase1", 19, "film-poster");
  encode("phase1", 0, 60, "film", 26);
  console.log("video written");
}

if (ONLY === "all" || ONLY === "images") await images();
if (ONLY === "all" || ONLY === "video") video();

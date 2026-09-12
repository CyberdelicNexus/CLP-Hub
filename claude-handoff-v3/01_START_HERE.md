# Start here

This folder is the complete Claude Code handoff for the current aNUma Clear Light RCT landing-page direction.

## How to use it

1. Open Claude Code in the repository where the landing page should be built.
2. Confirm the Taste and Scroll Craft skills/plugins are installed and available.
3. Open `00_MASTER_PROMPT.md` from this folder.
4. Paste its full contents into Claude Code.
5. If the page is intended to publish immediately, replace the missing protocol values listed in `docs/09_MISSING_STUDY_CONTENT.md` first. For a prototype, Claude may use visibly blocked development placeholders.

The master prompt assumes the target repository is Claude's current working directory. It tells Claude to read this package through the absolute path:

`C:\Users\JEMA\Documents\Anuma\claude-handoff-v3`

## Important

- V3 is the only current visual direction.
- Do not provide Claude with the V1 or V2 concept folders in the same context.
- The eight images in `assets/section-references/` are layout references, not production screenshots.
- The two files in `assets/hero-reveal/` are candidate production layers for the pointer reveal.
- The original videos and Clear Light images are in `assets/source-media/`.
- The Qualtrics URL and several protocol facts are intentionally unresolved.

## Folder map

```text
claude-handoff-v3/
  00_MASTER_PROMPT.md
  01_START_HERE.md
  docs/
    01_STORYBOARD_V3_ES.md
    02_DESIGN_SYSTEM_RCT_ES.md
    03_MEDIA_MOTION_DIRECTION.md
    04_LIVING_SIGNAL_INTERACTION.md
    05_CLAUDE_WORKFLOW_REFERENCE.md
    06_BRAND_DESIGN_SYSTEM.md
    07_LOCKED_DECISIONS.md
    08_CONTENT_MODEL_ES.md
    09_MISSING_STUDY_CONTENT.md
    10_ASSET_MANIFEST.md
    11_ACCEPTANCE_CHECKLIST.md
    12_IMPLEMENTATION_ORDER.md
  assets/
    section-references/
    hero-reveal/
    source-media/videos/
    source-media/images/
    brand/
  references/
    brand-discovery/
```

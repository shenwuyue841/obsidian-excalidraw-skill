# Changelog

All notable changes to this skill are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-11-06

Initial public release. Everything below was derived from failures observed on
a real Obsidian vault while building formula boards for a maths notebook.

### Added

- **`SKILL.md`** — eleven golden rules, a five-step workflow, and the two
  layout schools (column grid vs. lines-as-structure) with a rule for choosing.
- **`references/file-format.md`** — the `.excalidraw.md` container: frontmatter,
  `## Text Elements` / `## Embedded Files` / `## Drawing`, and both encodings
  (`json` and `compressed-json` with LZString base64 wrapped at ~120 chars).
- **`references/element-schema.md`** — required fields per element type,
  bound-text contract, arrow bindings and routing (curved via
  `roundness: {type: 2}` + waypoints, `elbowed: true`), plus an inventory of
  what the Excalidraw schema actually allows (10 font families, 8 arrowheads,
  3 roundness algorithms, and which element types are safe to hand-author).
- **`references/latex.md`** — the `image` + `## Embedded Files` double-write
  contract, `\color` handling, sizing heuristics, and the failure signature of
  each of the three variants tested.
- **`references/theme-and-color.md`** — why a canvas opens white although the
  file says `theme: dark`, how `appState.theme` gets overwritten, and how to
  extract a palette from an existing note instead of inventing one.
- **`references/layout.md`** — geometry, spacing numbers calibrated against a
  second implementation, and three anti-patterns (labels bound to background
  zones, cross-zone arrows, equalising column heights for their own sake).
- **`references/design-metrics.md`** — nine auditable aesthetics metrics
  (container ratio ≤ 30 %, ≤ 4 font sizes, zero formula-height variance,
  zero unintended overlap …) and a three-layer validation procedure for
  environments without a renderer.
- **`references/troubleshooting.md`** — symptom → cause → fix for every failure
  seen so far, including broken formula images, literal `$` from a `$$$`
  double-wrap, and elements doubling when a canvas is regenerated while open.
- **`references/when-not-to-use.md`** — the boundary between `.excalidraw`,
  `.excalidraw.md` and `.canvas`.
- **`scripts/gen_canvas.mjs`** — config-driven generator with content-derived
  element ids and delete-before-write, so regeneration is idempotent.
- **`scripts/inspect_canvas.mjs`** — decompresses either encoding, then audits
  structure, typography and the aesthetics metrics; `--describe` prints an
  id/position/label/connection inventory, `--dump` prints raw scene JSON.
- **`scripts/render_preview.mjs`** — headless PNG preview (no browser) for
  judging layout before delivery.
- **`evals/evals.json`** — five regression prompts, one per failure mode.

### Known limitations

- LaTeX renders blank in the headless preview: MathJax lives in the Obsidian
  plugin, not in the renderer.
- The Obsidian plugin re-issues text-element ids when it saves, so stable ids
  protect lines, shapes and images but not text; delete-before-write is the
  load-bearing safeguard.

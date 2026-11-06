---
name: obsidian-excalidraw
description: Generate and edit Obsidian Excalidraw drawings stored as Markdown (.excalidraw.md) — knowledge maps, decision trees, formula boards, teaching canvases. This skill should be used when a request involves creating or fixing an Excalidraw canvas inside an Obsidian vault, especially when it contains LaTeX formulas, needs theme/color alignment with existing notes, or when a previously generated canvas renders blank/washed-out/broken.
agent_created: true
license: MIT
version: 1.0.0
---

# Obsidian Excalidraw Canvas Builder

Generate `.excalidraw.md` files that open correctly in the Obsidian Excalidraw plugin, including hand-written LaTeX blocks, bound arrows, and theme-correct colors.

## When to use

- Building a knowledge map / decision tree / formula board as an Excalidraw canvas in a vault
- Converting a Markdown outline or note into a visual canvas
- Fixing a canvas that renders with broken images, invisible text, huge formulas, or an unexpected white/dark background
- Matching a new canvas to the visual language of an existing canvas in the same vault

Do NOT use for standalone `.excalidraw` JSON handed to the web app, or for rendering PNG/SVG — see `references/when-not-to-use.md` if that distinction matters.

## Golden rules (learned the hard way)

1. **LaTeX is not text.** Formulas are `type: "image"` elements whose source lives in the `## Embedded Files` section as `<40-hex-id>: $$tex$$`. An image element without a matching Embedded Files entry renders as a broken image. See `references/latex.md`.
2. **Never hand-write `$$...$$` inside a text element** for this plugin — it shows the raw source. The plugin only renders equations that exist in Embedded Files.
3. **Scene theme is not authoritative.** The plugin overwrites `appState.theme` with the app-level theme. Canvas color therefore comes from `viewBackgroundColor`, but a light theme paints white regardless. See `references/theme-and-color.md`.
4. **Copy the palette from an existing canvas in the same vault** before inventing colors. Decompress one with `scripts/inspect_canvas.mjs`, read its stroke colors and font family, reuse them.
5. **Uniform formula height, length-based width.** A fixed large width stretches short formulas into giants. See `references/layout.md`.
6. **The plugin re-saves as `compressed-json`** (LZString base64, wrapped every ~120 chars). Regenerate the canvas from your generator script instead of patching the saved file. Reading it requires decompression — `scripts/inspect_canvas.mjs` does that.
7. **Verify before claiming success.** Run the inspect script and check: equation count equals image count, no dangling bindings, theme/background as intended.
8. **"Looks good" is measurable.** Container ratio ≤ 30%, ≤ 4 font sizes, formula height variance 0, overlap count 0. `scripts/inspect_canvas.mjs` now prints these as `aesthetic warnings`; treat any warning as a defect, not a preference. See `references/design-metrics.md`.
9. **Write once, with stable ids, by deleting first.** Element ids must be derived from content (hash of the text / TeX / label), never random. And unlink the target file before writing it. Without both, regenerating a canvas that is currently **open in Obsidian** merges the new elements into the live scene: everything doubles, and the plugin autosaves the doubled scene back to disk. See `references/troubleshooting.md` → "Elements double / triple".
10. **Render before you deliver.** `scripts/render_preview.mjs` rasterises the file headlessly (Node, no browser). Look at the PNG — JSON audits catch structure, only pixels catch "the spacing looks wrong". LaTeX comes out blank in that preview (MathJax lives in the Obsidian plugin, not the renderer), so judge layout there and formula correctness from `## Embedded Files`.
11. **One `$$` layer only.** TeX in the data model is bare (`A=\int…`); the delimiters are added only when emitting the `## Embedded Files` line. Any `$$$` in a generated file is a double-wrap bug that renders literal dollar signs.

## Two layout schools — pick one before drawing

| | Column grid (表格派) | Lines as structure (结构派) |
| --- | --- | --- |
| Shape | column boxes + row dividers | trunk line + drop lines + free-floating text |
| Container ratio | high (a box per column) | near 0 |
| Reads as | a lookup table, rigorous | lecture-board, light |
| Best for | many same-level rows you check cell by cell | branching, or columns that derive from each other |
| Failure mode | "looks like a slide template" | too many branches → crossing lines |

Rule of thumb: **sibling columns → column grid; one column derived from the others → structure lines.** Both examples exist in `design-metrics.md` with identical content (the 第十讲 canvas), so you can compare before choosing.

## Workflow

1. **Read the target vault conventions.** Find an existing `.excalidraw.md` the user likes, run `node scripts/inspect_canvas.mjs <file>` and note: theme, `viewBackgroundColor`, dominant stroke colors, `fontFamily`, `roughness`, typical font sizes.
2. **Design the content as columns or rows** (see `references/layout.md`) — one column per quantity/step family, one row per formula, and only group things that are actually the same quantity. Choose the layout school (column grid vs structure lines) per the table above.
3. **Write a generator script** modeled on `scripts/gen_canvas.mjs`: edit its `CONFIG` block (title, columns, rows) and run it. Do not hand-edit the 30 kB JSON. Keep the two safety mechanisms it ships with: content-derived ids, and `rmSync` before `writeFileSync`.
4. **Inspect the result** with `scripts/inspect_canvas.mjs`, fix counts/colors/bindings. Also assert no `$$$` in the file and that the element count equals what the generator printed (a multiple of it means the merge bug hit). Then **render it** with `scripts/render_preview.mjs` and actually look at the PNG; fix spacing/overlap/short lines before reporting back.
5. **Report** what the user must do in Obsidian (close and reopen the file, or use the "Decompress current Excalidraw file" command) — the plugin only re-reads a file when it is reopened.

## Reference map

| File | Contents |
| --- | --- |
| `references/file-format.md` | Exact `.excalidraw.md` skeleton, both encodings, section order, header comment |
| `references/element-schema.md` | Required fields per element type, bound text, arrow bindings, `index` ordering |
| `references/latex.md` | Embedded Files contract, `\color`, sizing, the three rendering variants tested, failure signatures |
| `references/theme-and-color.md` | Why canvases open white, `matchThemeAlways`, palette extraction, this vault's established colors |
| `references/layout.md` | Column/row geometry, formula sizing heuristics, what makes a canvas look unfinished |
| `references/design-metrics.md` | Quantified aesthetics: container ratio, font-level count, formula variance, whitespace, semantic color; two layout schools; how to validate without a renderer |
| `references/troubleshooting.md` | Symptom → cause → fix table for every failure seen so far |
| `scripts/gen_canvas.mjs` | Config-driven canvas generator (text, latex, rect, hline, arrow) |
| `scripts/inspect_canvas.mjs` | Decompress + audit: theme, counts, equation/image match, bindings, fonts, aesthetic metrics. `--describe` prints a compact id/position/label/connection inventory; `--dump` prints raw scene JSON |
| `scripts/render_preview.mjs` | Headless PNG preview via `mcp-excalidraw-server render` (no browser). LaTeX renders blank — layout only |
| `evals/evals.json` | Regression prompts: one per failure mode that has actually happened |

## Editing an existing canvas

1. Decompress it to understand the current state (`inspect_canvas.mjs --dump <file>` prints scene JSON).
2. Prefer regenerating from the generator script. If the user has made manual edits worth keeping, write a scoped transform (read scene → mutate specific elements → re-serialize uncompressed) rather than rewriting the whole canvas.
3. Never leave a canvas half-migrated: either every image has its equation, or none.

## Sizing and typography defaults for this vault

- Body text `fontFamily: 6`, `roughness: 0`, `strokeWidth: 1`.
- Title 28–30 px, column header 19–22 px, row label 15–16 px, formula image height 50–52 px.
- Row pitch 116–130 px; column width 320–340 px; gap 28–40 px.
- Canvas background `#ffffff`; ink `#1e1e1e`; muted `#868e96`; hairline `#e9ecef`.

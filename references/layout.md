# Layout

## Geometry that reads as "finished"

A canvas looks unfinished for three predictable reasons: empty boxes, inconsistent type size, and crossing connector bundles. Fix those three and it starts looking designed.

### Column grid

- Column width `320–340`, gap `28–40`. Five columns ≈ 1700 px wide.
- Header at the column x, `fontSize 19–22`, accent colour, followed by a short underline line (length ≈ 140–160 px) in the same accent.
- Row pitch `116–130`. Row content: label at row top (`15–16 px`, muted), formula image at `+26…30 px`.
- Hairline under each row (`#e9ecef`, 1 px, width = column width − 20) instead of a full-height box: a table reads finished, an empty card reads half-done.

### Do not equalise heights for the sake of it

Equal-height columns require equal row counts, which forces padding with filler. Either:

- give every column the same number of rows **with real content**, or
- let each column hug its own content and align tops.

Empty bottom space inside a column is the single strongest "半成品" signal.

### Split by quantity, not by convenience

Group rows by the *thing being computed*. 弧长 (a length) and 侧面积 (an area) must not share a column even though both use `ds` — different formulas, different question sentences. When in doubt: one quantity family per column; if the count exceeds five, use a second row of columns with its own header band.

### Connectors

- Avoid one source fanning four long diagonals across the top: use `fixedPoint` spread (0.18 / 0.5 / 0.82) or drop arrows entirely and rely on numbered headers (①②③④) plus colour.
- Bind arrows (`startBinding` / `endBinding`) so they follow boxes; unbound arrows detach as soon as the user moves a box.
- Arrowheads: `endArrowhead: "arrow"`, `startArrowhead: null`, `elbowed: false`.

## Formula sizing

See `references/latex.md` for the estimator. Two invariants:

1. **One height for all formulas** (50–52 px). Type size must not vary between rows.
2. **Width proportional to TeX length**, capped at column width − 32.

If a formula still overflows its column, shorten the notation (`\frac{1}{2}` → `\tfrac{1}{2}`, drop `\left(\right)`) before shrinking the font.

## Typography

| Role | Size | Colour |
| --- | --- | --- |
| Canvas title | 28–30 | ink |
| Subtitle / question line | 16 | muted |
| Column header | 19–22 | accent |
| Row label | 15–16 | muted |
| Body / hint sentence | 15–16 | ink |
| Legend / footnote | 14 | muted |

`fontFamily: 6` for this vault, `roughness: 0`, `strokeWidth: 1`. Resisting the hand-drawn default (`roughness: 1`) keeps a formula sheet legible.

## Vertical rhythm of a whole canvas

```
y=0     title (30 px)
y=56    subtitle
y=96    accent rule (full width)
y=118   column headers + accent underlines
y=176   first row
...     rows, pitch 116–130
+40     dashed rule
        section: 易混对照 (pairs, A — vs — B)
+40     dashed rule
        section: 信号词索引
+40     dashed rule
        section: 待解问题 (dashed box with 1–2 writing lines)
+140    legend / colour key
```

Dashed rules (`strokeStyle: "dashed"`, light grey) separate sections without adding chrome.

## Density

- Five columns × four rows of formulas is about the maximum that stays readable at 100 % zoom on a laptop.
- If the source material has 30 items, split into two canvases (e.g. "公式表" and "决策路径") rather than one 3000 px tall board.
- Leave 40 px padding around the content; the dark-background trick requires knowing the content bounds (`maxX`, `maxY`).

## Numbers that come from another implementation (mcp_excalidraw)

Borrowed from a production Excalidraw-MCP server, then checked against this vault:

| Quantity | Value | Note |
| --- | --- | --- |
| Shape min size | 160 × 60 (120 × 60 for short labels) | below this, bound labels clip |
| Shape width | `max(160, labelChars × 12)` | 12 px per character is calibrated for 16 px body text |
| Vertical gap between tiers | 80–120 | more when arrows must pass between tiers |
| Horizontal gap between siblings | 40–60 | 120+ when the arrow carries a label |
| Grid | align to 20 px | our numbers 60 / 196 / 306 / 402 are all multiples of 20 — keep it that way |
| Body / title font | ≥ 16 / ≥ 20 | formula blocks count as body |
| Zone padding | 50 around contained elements | |

## Anti-pattern: text bound to a big background zone

Putting `text` on a large rectangle (a "zone" or "panel") makes Excalidraw create a **bound text element centred in the middle of that rectangle** — right on top of every element you then place inside it. It cannot be moved independently.

**Fix:** keep the rectangle empty and put a separate free-floating text at its top-left corner (`x + 20, y + 16`). This is the same reason `references/design-metrics.md` pushes containers to ≤ 30 %: bound text is the mechanism by which boxes fight the content.

## Anti-pattern: cross-zone arrows

An arrow from a box in one zone to a box in a distant zone draws a long diagonal through everything between. Rules:

- keep arrows inside a zone or between adjacent tiers;
- to express a cross-zone relationship, put the zones edge-to-edge at that point, or use an annotation instead of a line;
- if a line must cross, give it waypoints (see `references/element-schema.md` → arrow routing) so it travels the perimeter.

## After the plugin saves the file

Once the note is opened and saved by the Obsidian plugin, two things change and they affect previews:

1. `## Drawing` becomes `compressed-json`, and
2. `## Text Elements` is filled with `<text> ^<id>` lines, and **text element ids are re-issued** by the plugin.

Consequence: render a preview from the **freshly generated** file, not from a copy the plugin has touched — the renderer draws the `## Text Elements` block as body text and it appears as a stray grey column on the right of the image.

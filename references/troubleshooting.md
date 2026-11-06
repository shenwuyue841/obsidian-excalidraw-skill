# Troubleshooting

Symptom → cause → fix. Every entry below was observed on a real vault; the fix is what actually worked.

## Formula is a blank/broken image

**Clicking it shows:** "请选择一个包含内部或外部链接的元素" (select an element with an internal/external link).

**Cause:** `image` element with `fileId` that has no matching `## Embedded Files` line.

**Fix:** add `<same-id>: $$tex$$` to `## Embedded Files`. Verify with `node scripts/inspect_canvas.mjs <file>` — it reports the mismatch count.

## Formula shows raw TeX instead of math

**Cause:** the `$$...$$` lives inside a `text` element.

**Fix:** convert to an `image` element + Embedded Files entry. Text-element math is not rendered by this plugin.

## Whole canvas looks "乱" / garbled / half-empty

**Cause (most common):** light text or white formulas on a light canvas — everything is invisible, so what remains looks like scattered debris. Not a layout bug.

**Check:** `inspect_canvas.mjs` → `viewBackgroundColor` and the stroke-colour histogram. White/very light ink with a `#ffffff` background confirms it.

**Fix:** make ink dark on light paper (or truly dark paper via a locked background rectangle). Then re-evaluate the layout.

## Canvas opens white although the file says dark

**Cause:** `matchThemeAlways` is off and the app theme is light; under light theme Excalidraw paints white regardless of `viewBackgroundColor`.

**Fix:** see `references/theme-and-color.md` — either accept white paper + dark ink (this vault's convention), or add a locked dark background rectangle, or enable `matchThemeAlways`.

## Text is huge / formulas stretched

**Cause:** every image got the same large width, or text elements have no width and `autoResize` is off.

**Fix:** constant `height ≈ 50` for formulas, width ∝ TeX length; for text keep `autoResize: true`.

## Text overflows its box

**Cause:** bound text (`containerId`) with an underestimated width, especially for CJK.

**Fix:** for headers and labels prefer unbound text positioned manually; if binding is required, overshoot the width estimate by ~15 % and let `autoResize` settle it.

## Arrows detached after moving a box

**Cause:** `startBinding`/`endBinding` written on the arrow, but the boxes' `boundElements` never updated (or the referenced ids do not exist).

**Fix:** push `{ type: "arrow", id: arrowId }` into both boxes and make sure the ids resolve. Dangling bindings are silently dropped.

## File shrank / turned into base64 gibberish after opening in Obsidian

**Expected.** The plugin re-saves as `compressed-json` (LZString base64, wrapped at ~120 chars). Regenerate from your generator script rather than patching the saved file.

Reading it requires decompression — `scripts/inspect_canvas.mjs` strips wrapping whitespace before decoding; feeding wrapped text straight into an LZString decoder yields `null`.

## Chinese inside a formula fails to render

**Cause:** MathJax without CJK support in `preamble.sty`.

**Fix:** move the Chinese into a neighbouring text element; keep TeX pure math.

## Editing a canvas loses the user's manual tweaks

**Cause:** the generator overwrote the whole file.

**Fix:** treat the note as user-owned. Read the current scene, mutate only the elements you were asked to change, write back. Never blanket-regenerate a canvas the user has hand-edited unless they ask.

## Hand-written JSON rejected (plugin shows empty canvas / error)

Checklist:

1. `excalidraw-plugin: parsed` present in frontmatter.
2. The drawing block is fenced as `json` (plain) or `compressed-json` (base64) — not both, not `javascript`.
3. `elements` is an array; each element has `id`, `type`, numeric `x/y/width/height`.
4. No duplicate ids.
5. `points` of line/arrow are relative offsets, and `width/height` equal the last point.

`inspect_canvas.mjs` validates 1–5 and prints the first offending element.

## Elements double / triple after regenerating the canvas

**Symptom:** you rewrite the `.excalidraw.md` from your generator and the open canvas now shows **two copies of everything**, slightly offset; regenerate again and it becomes three. `inspect_canvas.mjs` reports an element count that is a multiple of what you wrote (`elements: 354` for a 88-element design), while every `id` is still unique.

**Cause:** when a drawing is **open in Obsidian**, the plugin treats an on-disk change as new content to **merge into the live scene**, not as a replacement. Your generator emits fresh random ids on every run, so nothing collides and the union simply grows. The plugin then autosaves that grown scene back over your file — the duplication is now persisted.

Note the tell: element ids are all unique but the *text content* repeats 3–4×. If ids repeated too, it would be a different bug (a merge keyed by id).

**Fix (both, in this order):**

1. **Unlink before writing.** A delete + create cycle makes the vault treat the file as a new document; an in-place `writeFileSync` is what triggers the merge.
   ```js
   if (existsSync(out)) rmSync(out, { force: true });
   writeFileSync(out, md, 'utf8');
   ```
2. **Derive ids from content**, never from `Math.random()`/a counter. `idFor(key)` = short hash of the element's semantic key (`text:<text>`, `latex:<tex>`, `rect:<label>`), with an occurrence counter for repeated keys. Also hash the **equation fileId** from its TeX — a random fileId leaves the old image element pointing at a formula that no longer exists in Embedded Files.

With content ids, a regeneration that only moves things around is idempotent: same id → same slot, and any surviving duplicate is dropped by the plugin's own id matching.

**If the file is already doubled:** regenerate once with the fixed script (it deletes first), or delete the note in Obsidian and let the generator recreate it. Editing the JSON by hand is not worth it — the plugin will merge your edits back in.

**Prevention:** closing the note in Obsidian before regenerating removes the race entirely, but the two fixes above make that unnecessary.

## Formulas render with literal `$` on both sides

**Symptom:** every formula shows as `$A=…$` with visible dollar glyphs — the maths inside is typeset correctly, but the delimiters are printed.

**Cause:** the TeX stored in `## Embedded Files` already contained `$…$`, and the writer wrapped it again: `fileId: $$$A=…$$$`. MathJax receives `$A=…$` as the TeX source and, since `$` is not a delimiter inside math mode, prints it as an ordinary character.

**Fix:** store **bare TeX** in the data model (`A=\int_a^b…`), and let exactly one layer add the `$$…$$`: the Embedded Files line. Check with:

```bash
grep -o '\$\$\$' file.excalidraw.md | wc -l   # must be 0
```

Rule of thumb: any triple dollar anywhere in a generated canvas is a double-wrap bug, never intentional.

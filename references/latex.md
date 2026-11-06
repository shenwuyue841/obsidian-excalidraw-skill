# LaTeX formulas in the Obsidian Excalidraw plugin

## The contract

A formula is **two things that must agree**:

1. an `image` element whose `fileId` is a 40-hex id and whose `customData.latex` holds the TeX;
2. a line in the `## Embedded Files` section of the same file: `<same-40-hex-id>: $$<tex>$$`.

```markdown
## Embedded Files
5532c379eaf6ab5d02eaefd38800784c05e2d79f: $$\color{black} A=\int_{a}^{b}\left[f(x)-g(x)\right]dx$$
```

```js
{
  type: "image", x: 16, y: 210, width: 240, height: 50,
  fileId: "5532c379eaf6ab5d02eaefd38800784c05e2d79f",
  scale: [1, 1], status: "pending", crop: null,
  customData: { latex: "\\color{black} A=\\int_{a}^{b}\\left[f(x)-g(x)\\right]dx" }
}
```

`files` stays `{}`. The plugin renders the TeX through the **Excalidraw Extras** plugin's MathJax (`tex2dataURL`) and stores the resulting SVG in memory; nothing is written back to the note.

### Failure signature

Image element without an Embedded Files entry → a blank/broken image placeholder, and clicking it shows *"请选择一个包含内部或外部链接的元素"* (select an element containing an internal or external link). Cause: the plugin treats an unresolvable `fileId` as a missing embed.

## What does NOT work

| Attempt | Result |
| --- | --- |
| `$$\n\dots\n$$` inside a `text` element | shows the raw TeX source; the plugin does not run KaTeX on text |
| Inline `$...$` inside a text element | same — raw text |
| `image` element with `customData.latex` but no `## Embedded Files` line | broken image placeholder |
| `image` element whose `fileId` length ≠ 40 hex | treated as missing file |

Only the image + Embedded Files pair renders.

## Colouring

Colour is part of the TeX, not the element:

```latex
\color{black}  A=\int_a^b f(x)\,dx
\color{white}  v = \frac{s}{t}
\textcolor{red}{\int_0^1 x^2\,dx}
```

`strokeColor` on the image element is ignored for LaTeX. Match the canvas: dark ink on white paper, `\color{white}` on a dark canvas. Mixed Chinese inside TeX must be wrapped: `\text{交点处分段}` — and MathJax CJK support depends on the user's `preamble.sty`; prefer putting Chinese in a separate text element instead of inside TeX.

## Sizing

The rendered SVG is fitted to the element's `width` × `height`, so a wrong aspect stretches the formula.

Rule that works:

```js
const plain = tex.replace(/\\color\{[^}]*\}/g, '')
                 .replace(/\\[a-zA-Z]+/g, 'x')
                 .replace(/[{}\\]/g, '');
const width  = Math.min(maxWidth, Math.max(118, Math.round(plain.length * 11)));
const height = 50;   // keep constant across a canvas
```

Constant height + proportional width = consistent type size across long and short formulas. A fixed 300 px width turns `r=|x-a|` into a billboard.

Vertical stack of fractions/sqrt renders taller than the box; give rows ≥ 116 px pitch and place the image ~26 px below its label so it cannot collide with the next row.

## The `preamble.sty`

Plugin setting `latexPreambleLocation` (default `preamble.sty`) points at a vault file whose contents prepend every formula. Add `\usepackage{amsmath}`, custom macros, or CJK support there rather than inside each formula.

## Deleting or moving a formula

Edit the TeX in **both** places (element `customData.latex` and the Embedded Files line). Removing only the element leaves an orphan equation; removing only the line breaks the image.

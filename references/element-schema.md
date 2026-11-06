# Element schema

Every element needs the same ~20 fields. Copy the block below as a base and override what the element type adds.

## Common base

```js
{
  id: "ml0abc",                 // unique string; any generator-safe id works
  type: "rectangle",
  x: 0, y: 0, width: 320, height: 120,
  angle: 0,
  strokeColor: "#1e1e1e",
  backgroundColor: "transparent",
  fillStyle: "solid",
  strokeWidth: 1,
  strokeStyle: "solid",         // "solid" | "dashed" | "dotted"
  roughness: 0,                 // 0 = architect (plain), 1 = artist (hand-drawn), 2 = cartoonist
  opacity: 100,
  groupIds: [],
  frameId: null,
  roundness: { type: 3 },       // null for sharp corners / text / arrows(type 2)
  seed: 123456,
  version: 1,
  versionNonce: 654321,
  isDeleted: false,
  boundElements: [],            // filled in for bindings
  updated: 1700000000000,
  link: null,
  locked: false,
  hasTextLink: false,
  created: null,
  index: "a3"                   // ordering key; "a0", "a1", ... ascending
}
```

`index` is a fractional-index string. Sequential `a0, a1, a2 …` is accepted and keeps z-order predictable (later = on top). Put a background rectangle first.

## Rectangle

Adds nothing. For a filled card use `backgroundColor: "#e7f5ff"`, `fillStyle: "solid"`, `roundness: { type: 3 }`.

## Text

```js
{
  type: "text",
  text: "列头\n第二行",          // \n real newline
  rawText: "列头\n第二行",
  originalText: "列头\n第二行",
  fontSize: 20,
  fontFamily: 6,                // see table below
  textAlign: "left",            // "left" | "center" | "right"
  verticalAlign: "top",         // "top" | "middle"
  containerId: null,            // set to a rectangle id to bind into that box
  autoResize: true,
  lineHeight: 1.35,
  labelPosition: null,
  baseFontSize: null,
  strokeColor: "#1e1e1e",       // text colour lives here
  roundness: null
}
```

Font families — authoritative list from the Excalidraw source (`packages/common/src/constants.ts`, `FONT_FAMILY`):

| id | Name | Look |
| --- | --- | --- |
| `1` | Virgil | hand-drawn |
| `2` | Helvetica | normal / neutral |
| `3` | Cascadia | code / monospace |
| `5` | Excalifont | the modern hand-drawn default |
| `6` | **Nunito** | rounded sans — this vault's notes use `6` |
| `7` | Lilita One | display, heavy |
| `8` | Comic Shanns | casual monospace |
| `9` | Liberation Sans | plain sans |
| `10` | Assistant | light sans |

Use `6` for CJK-heavy study canvases (Nunito's CJK fallback is the system sans and stays readable). Use `3` only for pure-ASCII technical boards — CJK in Cascadia falls back to the system font mid-string and the mix looks broken.

**Bound text** (a label that lives inside a box and reflows with it):

```js
// rectangle
boundElements: [{ type: "text", id: "text-id" }]
// text
containerId: "rect-id"
```

Bound text position is `x + (w - textW)/2` etc. Because LaTeX and CJK width estimates are unreliable, **prefer unbound text placed by hand** for headers and labels; bind only when the user will resize boxes interactively.

## Line

```js
{
  type: "line",
  points: [[0,0],[600,0]],      // relative to x,y
  lastCommittedPoint: null,
  roundness: null,
  startBinding: null, endBinding: null,
  startArrowhead: null, endArrowhead: null
}
```

`width`/`height` must equal the last point offsets (horizontal line → `height: 0`).

## Arrow

```js
{
  type: "arrow",
  points: [[0,0],[dx,dy]],
  lastCommittedPoint: null,
  startBinding: { elementId: "from-id", focus: 0, gap: 3, mode: "orbit", fixedPoint: [0.5, 1] },
  endBinding:   { elementId: "to-id",   focus: 0, gap: 3, mode: "orbit", fixedPoint: [0.5, 0] },
  startArrowhead: null,
  endArrowhead: "arrow",
  elbowed: false,
  roundness: { type: 2 }
}
```

`fixedPoint` is normalised `[fx, fy]` inside the target box: `[0.5,1]` bottom-centre, `[0.5,0]` top-centre, `[0.2,0]` = 20 % from the left of the top edge. Use different `fx` per arrow leaving the same box to avoid a bundle of crossing diagonals.

Binding also requires reciprocal entries: push `{ type: "arrow", id: arrowId }` into both boxes' `boundElements`. A dangling `elementId` makes the plugin drop the binding (arrow stays but stops following).

## Image (including LaTeX and pasted pictures)

```js
{
  type: "image",
  x: 0, y: 0, width: 240, height: 52,
  fileId: "40-hex-id",          // must match an ## Embedded Files entry (LaTeX) or files[] key (raster)
  scale: [1, 1],
  status: "pending",            // let the plugin render/refresh the SVG
  crop: null,
  customData: { latex: "\\color{black} A=\\int_a^b f(x)\\,dx" }
}
```

`status: "pending"` is what triggers re-render on load. Omit `customData.latex` only for real images.

## Frame

```js
{ type: "frame", name: "① 决策树" }
```

Frames group elements and export separately; they also clip children. Optional — most canvases read fine with plain headers and spacing.

## Deleted elements

Never emit `isDeleted: true` placeholders; drop them. The plugin filters them out but they inflate the file and confuse audits.

## Capability inventory (read from the Excalidraw source)

Source of truth: `packages/element/src/types.ts` + `packages/common/src/constants.ts`.

**Element types** (`ExcalidrawElement` union):

| type | Hand-generate? | Note |
| --- | --- | --- |
| `rectangle` / `ellipse` / `diamond` | ✅ | "generic" elements; `roundness: {type: 3}` for rounded rects |
| `text` | ✅ | needs `text` / `rawText` / `originalText` all equal |
| `line` / `arrow` | ✅ | `points` is relative to the element's own `x`,`y` |
| `image` | ✅ | the LaTeX carrier; see `latex.md` |
| `frame` / `magicframe` | ⚠️ | clips children by containment — easy to lose content when moving things |
| `freedraw` | ❌ | hundreds of pressure points, meaningless to author |
| `embeddable` / `iframe` | ❌ | Obsidian sandbox usually blocks them; they render as a card |

**Arrowheads** — `startArrowhead` / `endArrowhead` accept: `arrow`, `bar`, `circle`, `circle_outline`, `triangle`, `triangle_outline`, `diamond`, `diamond_outline`. Legacy ER-diagram names (`crowfoot_one`, `crowfoot_many`, `crowfoot_one_or_many`, `dot`) are still parsed. Leave `null` for a plain line.

**Roundness** (`ROUNDNESS`): `{type: 1}` legacy proportional, `{type: 2}` proportional (linear elements, diamonds), `{type: 3}` adaptive fixed radius — this is what the editor applies to rectangles. Use `null` for sharp corners.

**Text alignment**: `textAlign` is `left | center | right`; `verticalAlign` is `top | middle` only — there is no `bottom`.

**Stroke styles**: `solid | dashed | dotted`. Dashed is the conventional signal for "derived / pending", keep that meaning consistent inside one canvas.

## Arrow routing (curves and elbows)

Straight arrows cross whatever sits between their endpoints. Two supported routings:

**Curved** — 3+ points plus `roundness: {type: 2}` (proportional radius); the middle point acts as a control point:

```js
{
  type: "arrow", x: 100, y: 100,
  points: [[0, 0], [50, -40], [200, 0]],   // waypoint lifts the line over an obstacle
  roundness: { type: 2 }
}
```

**Elbowed** — right-angle routing; Excalidraw computes the corners itself:

```js
{ type: "arrow", x: 100, y: 100, points: [[0, 0], [200, 0]], elbowed: true }
```

Use curved for fan-out from one node (spread the waypoints so the arcs don't overlap), elbowed for lane-to-lane hops. Rule: **if the line would pass through an unrelated element, it needs a waypoint** — never let it cut through a box.

When arrows are bound (`startBinding` / `endBinding`), moving or resizing an endpoint re-routes them automatically; you only need to re-issue the `points` if you want to change the *shape* of the route.

## Editing an existing canvas without regenerating it

Regenerating from the generator is the default. When the user has made manual edits worth keeping, prefer a scoped patch over a rewrite:

1. `inspect_canvas.mjs --describe <file>` → ids, positions, labels, connections.
2. Address elements **by id**, never by coordinates (they shift).
3. Apply `{ set: {...} }` style changes (move / resize / recolor / retext), then re-inspect.
4. Only then decide whether a full regeneration is still worth it — a rewrite throws away the user's manual work *and* re-triggers the merge-on-open behaviour.

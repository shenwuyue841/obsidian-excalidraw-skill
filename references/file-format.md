# `.excalidraw.md` file format

An Excalidraw drawing inside an Obsidian vault is a **Markdown file with four zones**. The plugin reads zones 2–4; zone 1 is YAML frontmatter Obsidian itself uses.

## Skeleton

```markdown
---
excalidraw-plugin: parsed
tags: [excalidraw]

---
==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠== You can decompress Drawing data with the command palette: 'Decompress current Excalidraw file'. For more info check in plugin settings under 'Saving'


# Excalidraw Data

## Text Elements
<one line per text element, usually: text ^blockid>
(optional; may be left empty — the plugin rebuilds it)

## Embedded Files
<40-hex-id>: $$<latex>$$
(one entry per LaTeX equation; blank line between entries)

%%
## Drawing
```json
{ "type": "excalidraw", "version": 2, "source": "...", "elements": [...], "appState": {...}, "files": {} }
```
%%
```

Notes:

- `excalidraw-plugin: parsed` is what makes Obsidian render the file as a canvas instead of plain text. `parsed` vs `uncompressed` etc. are accepted tokens; `parsed` is safe.
- The warning comment is cosmetic but harmless; keep it so humans see the toggle hint.
- `## Text Elements` may be empty. It is a derived index, not the source of truth for text.
- `## Element Links` may be omitted entirely. If present, it holds `id: [[link]]` lines.
- Only one `%%`-fenced block is required: the one wrapping `## Drawing`.

## Two encodings of the drawing block

**Plain JSON** — hand-authored files usually start here:

````markdown
## Drawing
```json
{
	"type": "excalidraw",
	"version": 2,
	"source": "https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/2.29.1",
	"elements": [ ... ],
	"appState": { ... },
	"files": {}
}
```
````

**Compressed** — what the plugin writes after any edit:

````markdown
## Drawing
```compressed-json
N4KAkARALgngDgUwgLgAQQQDwMYEMA2AlgCYBOuA7hADTgQBuCpAzoQPYB2K
...232 wrapped lines...
L1oJgC/rT6+bgnrE0Ol2rLBYHADmQRoGYCYbc8TnKv8COQmu+EyUEAA=
```
````

The compressed payload is **LZString `compressToBase64` output, hard-wrapped at ~120 chars**. To decode: strip all whitespace, then LZString-decompress with the standard base64 alphabet
`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=`.

`scripts/inspect_canvas.mjs` contains a dependency-free decompressor; do not reimplement it from memory, subtle off-by-one bugs produce `null`.

## Choosing encoding

| Situation | Write |
| --- | --- |
| Generating a canvas from a script | Plain JSON (readable, diffable, easy to regenerate) |
| Delivering to a user who will edit it | Plain JSON — the plugin compresses on first save anyway |
| Patching a file the plugin already saved | Decompress, mutate the scene object, write back plain JSON |

Because the plugin re-serialises on save, **the file you generated will not stay byte-identical**. Treat the generator script as the source of truth, not the `.md`.

## appState fields that matter

```json
"appState": {
  "theme": "dark",                    // requested theme; may be overridden by the app
  "viewBackgroundColor": "#ffffff",   // canvas paper colour (scene-level, survives reload)
  "gridSize": 20, "gridStep": 5, "gridModeEnabled": false,
  "scrollX": 0, "scrollY": 0, "zoom": { "value": 0.75 },
  "currentItemFontFamily": 6, "currentItemRoughness": 0
}
```

The plugin merges this with its own defaults and rewrites ~37 keys on save. Providing only the keys above is enough for a first paint; missing ones get defaulted.

`files` stays `{}` for vector content (LaTeX images included). It only holds raster data when a real image file is embedded.

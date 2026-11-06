# The Excalidraw script engine

The Obsidian Excalidraw plugin is not only a file format — it also runs **JavaScript inside Obsidian itself**. That is a second, complementary way to put things on a canvas. Know when to use which.

## Two ways to get elements onto a canvas

| | File-level generating (this skill's default) | In-app script |
| --- | --- | --- |
| Runs where | Node / your agent, headless | Inside Obsidian, on the open drawing |
| Input | Markdown, CSV, vault notes, anything | The current selection, the vault, prompts |
| Output | `.excalidraw.md` written to disk | Elements added to the live scene |
| Best for | bulk content, reproducible layouts, LaTeX tables | one-off edits, reacting to selection, tools you will press repeatedly |
| Weakness | cannot see what is already on the canvas | cannot run outside Obsidian, no CI |

The two compose: generate the skeleton with this skill's scripts, then use an in-app script for the finishing touches a human would otherwise do by hand.

## Where scripts live

- Folder: the plugin setting **Excalidraw 自动化脚本所在文件夹** — default `Excalidraw/Scripts` (vault-relative). Scripts downloaded from the store land in `Excalidraw/Scripts/Downloaded`.
- Each script is a Markdown (or `.js`/`.md`) file whose first line is `/*`; the plugin reads the code block inside.
- Installing from the store: open a drawing → pane menu → **“Install or update Excalidraw Scripts”** → pick → *Install this script* → restart Obsidian.

Relevant settings keys in the plugin's `data.json` (all verified on plugin 2.29.x):

| Key | Meaning |
| --- | --- |
| `scriptFolderPath` | where scripts are read from |
| `pinnedScripts` | scripts pinned as buttons in the Excalidraw toolbar |
| `autostartScripts` / `enableOnloadScripts` | run scripts when Obsidian starts |
| `startupScriptPath` | a single script that runs on every drawing load |
| `scriptEngineSettings` | per-script settings blobs |

Any installed script is also exposed as an Obsidian command, so it can take a hotkey like any other command.

## What scripts can actually do

Roughly four buckets, all seen in the official library (`zsviczian/obsidian-excalidraw-plugin` → `ea-scripts/`):

**1. Batch geometry / layout** — the library's centre of gravity. `Fixed spacing`, `Fixed vertical distance`, `Fixed inner distance`, `Uniform size`, `Expand rectangles horizontally/vertically`, `Grid Selected Images`, `Auto Layout`.

**2. Style and colour, applied to a selection** — `Darken/Lighten background color`, `Modify background color opacity`, `Set Font Family`, `Set Stroke Width`, `Copy Selected Element Styles to Global`, `Color Scheme Manager`, `Palette loader`.

**3. Content generation** — `Full-Year Calendar Generator`, `Linear Calendar Generator`, `VoronoiDiagramGenerator`, `Mindmap Builder`, `Repeat Elements`, `Repeat Texts`, `Printable Layout Wizard`, and `ExcaliAI` (prompt → drawing).

**4. Vault integration** — `Add Link to Existing File and Open`, `Create new markdown file and embed into active drawing`, `Capture Note`, `TheBrain-navigation` (Dataview-driven graph), `OCR`.

Two of these matter for formula boards specifically:

- **`Reset LaTeX Size`** — resets embedded LaTeX to its default size. This is the sanctioned fix for the "the plugin wrote my formula back at a weird scale" problem; our generators size formula boxes heuristically, and this script normalises them after the fact.
- **`ExcaliMath`** — a **side panel** (not a one-shot command): CodeMirror LaTeX editor with live SVG preview, a graph tab that plots `f(x)` / polynomial / Gaussian / Poisson as **native `line` elements** (editable points, no raster), and a saved-formula library. Select an existing LaTeX image and it switches to update-in-place mode. Requires the Extras MathJax feature and plugin ≥ 2.25.3; it opens via `ea.createSidepanelTab()`, which is the pattern for any script that needs a persistent UI.

Note on wording: earlier drafts described ExcaliMath as "text → LaTeX". That is a different, much simpler script. ExcaliMath is the full editor panel above.

## The script API, briefly

Scripts talk to the scene through `ExcalidrawAutomate` (EA). Confirmed present in plugin 2.29.x:

```js
const ea = ExcalidrawAutomate;               // global injected by the plugin

ea.addRect(x, y, w, h, options)              // → element id
ea.addEllipse(x, y, w, h, options)
ea.addDiamond(x, y, w, h, options)
ea.addText(x, y, text, options)
ea.addLine([[x1,y1],[x2,y2]], options)
ea.addArrow([[x1,y1],[x2,y2]], options)
ea.addLaTex(x, y, tex, scale)                // the correct LaTeX path
ea.addImage(...)

ea.getViewElements()                         // what is already on the canvas
ea.getViewSelectedElements()                 // the current selection
ea.targetView                                // the live Excalidraw view

ea.addElementsToView()                       // commit the queued elements
```

A script is therefore just: read state → `ea.add*()` a few times → `ea.addElementsToView()`. Styling goes through `ea.style` (colour, stroke width, roughness, font) so you do not repeat the same options per element.

## Can it make a table?

There is **no native table element** in Excalidraw — no HTML-like table, and no merged cells. Three ways to get one:

1. **Grid of rectangles + text** (what everyone does): one `addRect` per row for fills, `addLine` for the grid, one `addText` per cell. `examples/ea-table-sidepanel.md` does exactly this behind a live-preview side panel; `examples/ea-table.md` is the minimal one-shot version.
2. **A script that reads a Markdown/CSV table from the vault** and lays it out — same grid, data from outside. Good when the table already exists as text.
3. **Generate it offline** with this skill's generator and write it straight into `.excalidraw.md`. Best when the table is part of a larger board and you want exact coordinates, reproducible output, and LaTeX cells.

Rule of thumb: **a table that will be edited by hand → script; a table that is a snapshot of data → generate the file.**

### The side-panel pattern (worth copying)

`examples/ea-table-sidepanel.md` (ExcaliTable) is a compact reference for any script that needs a persistent UI:

```js
const tab = await ea.createSidepanelTab("ExcaliTable", true, true); // persist, reveal
tab.contentEl            // your DOM root
tab.onOpen / onFocus / onClose
ea.onSceneChangeHook = { appStateKeys: ["selectedElementIds"], callback }
```

Live preview without touching the canvas: build the elements into the EA workbench (`ea.clear()` → `ea.add*()`), export them with `ea.createSVG(...)`, then `ea.clear()` again. The canvas is never modified until `ea.addElementsToView()`.

Round-trip: stamp `element.customData.excaliTable = { src, style }` on every generated element and group them; when the user selects one, read that back into the panel and offer *update in place*. That is how a script becomes a tool instead of a one-shot command.

Note: its UI strings are Chinese — the pattern is what to borrow.

## Limits worth knowing

- Scripts only run inside Obsidian. Anything you need in CI, or without opening the app, must be file-level.
- A script sees the *open* canvas; the file may have been re-saved by the plugin (compressed Drawing, re-issued text ids). Do not assume the file on disk matches what the script wrote a second ago.
- Script errors surface as a Notice, and a broken autostart script can fire on every drawing load — keep `enableOnloadScripts` off unless you are testing one.
- The script API is not versioned separately from the plugin; a call that works on 2.29 may not exist on older versions. Check the plugin version before shipping a script to someone else.

# When NOT to use this skill

This skill targets **Obsidian Excalidraw notes** (`.excalidraw.md`) that are opened by the Obsidian Excalidraw plugin. Several adjacent tasks look identical but need different tooling.

| Task | Right tool |
| --- | --- |
| Standalone `.excalidraw` JSON for the web app / excalidraw.com | the `excalidraw-diagram` skill (JSON + renderer), not this one |
| Rendering a canvas to PNG/SVG | the plugin's own export, or the `excalidraw-diagram` renderer |
| Drawing a chart/diagram for chat output | the visualizer (`show_widget`), not a canvas file |
| Mermaid flowchart inside a note | plain Markdown `` ```mermaid `` — no Excalidraw involved |
| Obsidian Bases / Canvas (`.canvas`) files | different format entirely, not JSON elements |

## Differences that bite

- **`.excalidraw` (web)** is pure JSON with an `elements` array and no Markdown wrapper; LaTeX lives in `customData.latex` **with** a rendered SVG in `files`. There are no `## Embedded Files` lines. Copying a `.excalidraw` file into a vault does not produce a working note.
- **`.excalidraw.md` (plugin)** wraps the same scene in Markdown, stores LaTeX source in the `## Embedded Files` section, and may compress the drawing block. Hand-written `.excalidraw` JSON pasted into a note renders nothing useful.
- **`.canvas` (Obsidian core)** is a nodes/edges JSON with `nodes`, `edges`, `x/y/width/height` per node — completely different schema; do not reuse element code.

If the user says "my diagram doesn't render" first ask **which of the three** they have; the fix paths diverge immediately.

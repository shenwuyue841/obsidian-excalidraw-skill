# Theme, canvas colour, and palette

## Why a canvas opens white even though the file says dark

The plugin does not trust `appState.theme` from the file. On load it reconciles theme with the app instance and, when `matchThemeAlways` is enabled, with Obsidian's appearance:

```js
// simplified from the plugin source
scene.appState.theme = settings.matchThemeAlways
  ? (isObsidianThemeDark() ? 'dark' : 'light')
  : apiTheme;   // app-level theme, defaults to light when no theme setting exists
```

Consequences:

- `theme: "dark"` written into a file can be silently replaced by `light`.
- Under **light theme, Excalidraw paints the canvas white regardless of `viewBackgroundColor`**. That is why a canvas with `viewBackgroundColor: "#141414"` still looked white.
- Under **dark theme, `viewBackgroundColor` is honoured** — that is how a white-canvas drawing survives in a dark UI.

So `viewBackgroundColor` is only reliable when the effective theme is dark.

## The three ways to get the background you want

| Goal | Do |
| --- | --- |
| Match a normal Obsidian-Excalidraw setup (dark UI, white paper) | `theme: "dark"`, `viewBackgroundColor: "#ffffff"`, dark ink. Exactly what this vault's existing notes use. |
| Guarantee dark paper in any theme | `theme: "dark"` **and** a locked background rectangle (`locked: true`, `backgroundColor` dark, `strokeWidth: 0`) as the first element, covering the content bounds |
| Make every canvas follow Obsidian's mode | Set the plugin setting `matchThemeAlways: true` in `.obsidian/plugins/obsidian-excalidraw-plugin/data.json` (back the file up first) |

Never rely on `appState.theme` alone. Never assume `viewBackgroundColor` beats a light theme.

## Extracting the palette of an existing canvas

```bash
node scripts/inspect_canvas.mjs "path/to/SomeCanvas.excalidraw.md"
```

It prints theme, background, element-type counts, the stroke-colour histogram, the fill histogram, `fontFamily` distribution, and `roughness` distribution. Reuse those exact hex strings — inventing "pretty" colours is the fastest way to get "颜色还是不对".

Typical Excalidraw stock palette found in this vault:

| Role | Hex |
| --- | --- |
| ink / body text | `#1e1e1e` |
| black text & images | `#000000` |
| muted / secondary | `#868e96` (`#bbb` for very light) |
| hairline / separator | `#e9ecef` / `#ced4da` |
| blue (accent 1) | `#1971c2` |
| green (accent 2) | `#2f9e44` |
| orange (accent 3) | `#f08c00` |
| red (warning / accent 4) | `#e03131` |
| purple (accent 5) | `#6741d9` |

Dark-canvas variants (only when the paper is genuinely dark): blue `#4dabf7`, green `#51cf66`, orange `#ffa94d`, red `#ff8787`, teal `#3bc9db`, ink `#e9ecef`.

## Plugin settings worth knowing

`data.json` keys that change rendering or storage:

| Key | Effect |
| --- | --- |
| `matchThemeAlways` | Scene theme follows Obsidian appearance on every load |
| `matchTheme` / `matchThemeTrigger` | Follow theme only for new drawings / on trigger |
| `iframeMatchExcalidrawTheme` | Sync embedded frames |
| `exportWithTheme` | Whether PNG/SVG export uses the current theme |
| `latexPreambleLocation` | Vault path of `preamble.sty` (default `preamble.sty`) |
| `compress` / `decompress` family | Whether saved drawings are stored as `compressed-json` |

Back up `data.json` before editing it (e.g. `data.json.bak-<HHMM>`) and tell the user exactly which key changed.

## Dark canvases, if really needed

If the user insists on dark paper, do all three: `theme: "dark"`, a locked dark background rectangle, and light ink + light formulas (`\color{white}`). Without the rectangle, a light-theme session will still show white and the light text becomes invisible — the classic "整个文件是乱的" report, which is really "everything is invisible".

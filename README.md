# Obsidian Excalidraw Skill

**English** · [简体中文](#简体中文)

[![version](https://img.shields.io/badge/version-1.0.0-blue.svg)](CHANGELOG.md)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![platform](https://img.shields.io/badge/platform-Obsidian%20%C2%B7%20Excalidraw%20plugin-6741d9.svg)](https://github.com/zsviczian/obsidian-excalidraw-plugin)

An agent skill for writing **`.excalidraw.md`** canvases that actually open correctly in the Obsidian Excalidraw plugin — LaTeX formulas included.

Most Excalidraw tooling assumes the web app's plain `.excalidraw` JSON. Obsidian uses a different container: a Markdown file with a compressed-or-plain drawing block, and formulas that live in a separate `## Embedded Files` section. Getting that wrong produces broken images, literal `$` signs, or a canvas that duplicates itself every time you regenerate it. This skill encodes the working contract, plus a set of measurable layout rules so the result looks finished rather than assembled.

### Why LaTeX is the part that breaks

Three ways a formula fails in this container — all three happened before the rule was written down:

| What you see | What actually happened |
| --- | --- |
| A blank box; clicking it says *"select an element with an internal or external link"* | An `image` element with no matching line in `## Embedded Files` |
| `$A=\int…$` printed with visible dollar signs | The TeX was wrapped twice: `fileId: $$$…$$$` — MathJax prints `$` as an ordinary character |
| `A=\int…` sitting in the canvas as plain text | The maths was written into a `text` element; this plugin only renders equations from Embedded Files |

The whole contract is one sentence: **the formula is an `image` element, its TeX is a single `<40-hex-id>: $$tex$$` line in `## Embedded Files`, the id must match, and `$$` goes on exactly once.**

---

## What makes it different

| Common approach | This skill |
| --- | --- |
| Emit `.excalidraw` JSON | Emits `.excalidraw.md` — the plugin's native container |
| Inline `$…$` in text elements | Formulas as `image` elements + a matching `## Embedded Files` line |
| Invent a palette | Reads the palette out of an existing canvas in the same vault |
| "Looks fine to me" | Nine auditable metrics: container ratio, font levels, formula variance, overlap, duplication |
| Regenerate and hope | Content-derived ids + delete-before-write, so regenerating an open canvas does not double it |
| Judge from JSON | Headless PNG render, so layout is checked with eyes, not imagination |

Every rule in `references/` came from a failure that happened on a real vault. The troubleshooting file is a log of scars, not a guess.

## Features

- **Correct LaTeX pipeline** — `image` element with `customData.latex` + one `<40-hex>: $$tex$$` line in `## Embedded Files`. Nothing else renders.
- **Theme fidelity** — explains why `appState.theme` is overridden by the app, and how to match an existing note's paper, ink and accent colours.
- **Design metrics** — container ratio ≤ 30 %, ≤ 4 font sizes, zero formula-height variance, zero unintended overlap, all machine-checked.
- **Two layout schools** — column grid (lookup-table feel) and lines-as-structure (lecture-board feel), with a rule for choosing between them.
- **Scene audit** — one script decompresses either encoding, then reports structure *and* aesthetics; `--describe` prints an id/position/connection inventory for surgical edits.
- **Visual preview** — a headless PNG renderer wrapper, no browser required.
- **Regression evals** — `evals/evals.json` holds one prompt per failure mode that has already been hit.

## Install

The skill is a directory with a `SKILL.md` entry point. Drop it into your agent's skills root:

```bash
git clone https://github.com/shenwuyue841/obsidian-excalidraw-skill.git \
  ~/.workbuddy/skills/obsidian-excalidraw
```

For Claude Code, use `.claude/skills/obsidian-excalidraw` (project) or `~/.claude/skills/obsidian-excalidraw` (user). Any agent that loads `SKILL.md` plus its `references/` on demand will work.

Requirements: Node.js ≥ 18. The preview script shells out to `npx -y mcp-excalidraw-server render` on first use; nothing else has dependencies.

## Usage

Ask for a canvas; the skill picks the layout school, generates from a script, audits, renders, and only then reports back.

```
Make a formula board for lecture 10 — four columns (area, volume, arc length,
surface area), LaTeX in every cell, dark theme matching my existing notes.
```

Typical agent loop:

```bash
node scripts/gen_canvas.mjs                       # 1. generate from the CONFIG block
node scripts/inspect_canvas.mjs out.excalidraw.md # 2. structural + aesthetic audit
node scripts/render_preview.mjs out.excalidraw.md # 3. look at the PNG
```

Auditing an existing canvas, or editing without redrawing it:

```bash
node scripts/inspect_canvas.mjs note.excalidraw.md             # summary
node scripts/inspect_canvas.mjs note.excalidraw.md --describe  # ids, positions, labels
node scripts/inspect_canvas.mjs note.excalidraw.md --dump      # raw scene JSON
```

## Repository layout

```
SKILL.md                     entry point: golden rules, workflow, layout schools
references/
  file-format.md             the .excalidraw.md container, both encodings
  element-schema.md          fields per element type, bindings, arrow routing
  latex.md                   Embedded Files contract and its failure signatures
  theme-and-color.md         theme override, palette extraction
  layout.md                  geometry, spacing numbers, layout anti-patterns
  design-metrics.md          quantified aesthetics + how to validate without a renderer
  troubleshooting.md         symptom → cause → fix, all observed in the wild
  when-not-to-use.md         .excalidraw vs .excalidraw.md vs .canvas
scripts/
  gen_canvas.mjs             config-driven generator (stable ids, safe write)
  inspect_canvas.mjs         decompress + audit + --describe / --dump
  render_preview.mjs         headless PNG preview
evals/evals.json             regression prompts
```

## Known limitations

- The preview renderer draws **LaTeX as blank space** — MathJax lives in the Obsidian plugin, not in the renderer. Use the preview for layout, and `## Embedded Files` checks for formula correctness.
- Font families `5`–`10` depend on the Excalidraw version bundled with your plugin; `6` (Nunito) is the safe default for CJK.
- If a note is open in Obsidian while you rewrite it, the plugin merges instead of replacing. The generator deletes the file first to avoid this; close the note if you still see doubling.

## Contributing

Issues and pull requests are welcome. If you hit a rendering or layout failure that is not in `references/troubleshooting.md`, a reproduction (the `.excalidraw.md` plus the Obsidian plugin version) is the most useful thing you can attach.

## License

[MIT](LICENSE) © 2026 shenwuyue841

---

## 简体中文

[English](#obsidian-excalidraw-skill) · **简体中文**

[![version](https://img.shields.io/badge/version-1.0.0-blue.svg)](CHANGELOG.md)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

一个用于生成 **`.excalidraw.md`** 画布的 Agent 技能，目标是让文件在 Obsidian Excalidraw 插件里**打开就是对的**——包括公式。

市面上的 Excalidraw 工具大多面向网页版的 `.excalidraw` JSON。Obsidian 用的是另一套容器：Markdown 文件里放一段（可压缩的）绘图块，公式则单独存在 `## Embedded Files` 段。这里错一步，结果就是断图、公式两边多出 `$`，或者每次重新生成画布就叠一层。本技能把可用的事实固化下来，并给出一组**可度量**的版式规则，让成品看起来是做完的，而不是拼起来的。

### 公式为什么最容易坏

在这个容器里，公式有三种坏法，都是在把规则写下来之前真踩过的：

| 你看到的 | 实际发生了什么 |
| --- | --- |
| 一个空白框，点它提示"请选择一个包含内部或外部链接的元素" | `image` 元素在 `## Embedded Files` 里找不到对应行 |
| `$A=\int…$` 两边带着美元符号 | TeX 被包了两层：`fileId: $$$…$$$`，MathJax 把 `$` 当普通字符印出来 |
| `A=\int…` 以纯文本形式躺在画布上 | 公式被写进了 `text` 元素；这个插件只渲染 Embedded Files 里的公式 |

整条链路一句话：**公式是 `image` 元素，TeX 是 `## Embedded Files` 里唯一的一行 `<40 位 id>: $$tex$$`，id 必须对齐，`$$` 只能加一次。**

### 它和别的做法有什么不同

| 常见做法 | 本技能 |
| --- | --- |
| 输出 `.excalidraw` JSON | 输出 `.excalidraw.md`（插件原生容器） |
| 把 `$…$` 写进文本元素 | 公式是 `image` 元素 + `## Embedded Files` 里一一对应的那一行 |
| 自己拍一套配色 | 从同一库里**已有画布**读出配色再复用 |
| "我觉得还行" | 九项可审计指标：容器比例、字号级数、公式尺寸方差、重叠、重复 |
| 重新生成，听天由命 | 内容派生的稳定 id + 先删后写，打开状态下重生成也不叠加 |
| 对着 JSON 想象 | 无头 PNG 渲染，用眼睛检查版式 |

`references/` 里的每条规则都来自一次真实踩坑，排障文档记录的是伤疤，不是猜测。

### 特性

- **正确的公式链路**：`image` 元素携带 `customData.latex`，并在 `## Embedded Files` 写入唯一一行 `<40 位 id>: $$tex$$`，少一半就是断图。
- **主题保真**：解释 `appState.theme` 为什么会被应用主题覆盖，以及如何对齐已有笔记的纸色、墨色与强调色。
- **设计指标**：容器占比 ≤ 30%、字号 ≤ 4 级、公式高度零方差、意外重叠为零，全部由脚本检查。
- **两种版式**：表格派（列框 + 行线，像速查表）与结构派（主干线 + 落线 + 悬空文字，像板书），附选择依据。
- **场景审计**：一个脚本解压两种编码，同时报告结构与审美指标；`--describe` 输出 id / 坐标 / 连接清单，便于按 id 局部修改。
- **视觉预览**：封装无头渲染，无需浏览器。
- **回归用例**：`evals/evals.json` 一条对应一个已经踩过的坑。

### 安装

技能就是一个入口为 `SKILL.md` 的目录，放进 Agent 的 skills 根目录即可：

```bash
git clone https://github.com/shenwuyue841/obsidian-excalidraw-skill.git \
  ~/.workbuddy/skills/obsidian-excalidraw
```

Claude Code 放在 `.claude/skills/obsidian-excalidraw`（项目级）或 `~/.claude/skills/obsidian-excalidraw`（用户级）。任何会按需加载 `SKILL.md` 与 `references/` 的 Agent 都适用。

环境要求：Node.js ≥ 18。预览脚本首次运行会通过 `npx -y mcp-excalidraw-server render` 拉取渲染器，其余脚本无依赖。

### 用法

```
给我做一张第十讲的公式板：四列（面积、体积、弧长、侧面积），每格用 LaTeX，
深色主题，和我库里已有画布风格一致。
```

典型执行链路：

```bash
node scripts/gen_canvas.mjs                       # 1. 改 CONFIG 后生成
node scripts/inspect_canvas.mjs out.excalidraw.md # 2. 结构 + 审美审计
node scripts/render_preview.mjs out.excalidraw.md # 3. 看图
```

审计或局部修改已有画布：

```bash
node scripts/inspect_canvas.mjs note.excalidraw.md             # 摘要
node scripts/inspect_canvas.mjs note.excalidraw.md --describe  # id / 坐标 / 标签
node scripts/inspect_canvas.mjs note.excalidraw.md --dump      # 原始场景 JSON
```

### 目录结构

```
SKILL.md                     入口：铁律、工作流、两种版式
references/                  格式 / 元素 / 公式 / 主题 / 版式 / 指标 / 排障 / 边界
scripts/                     生成器、审计器、无头预览
evals/evals.json             回归用例
```

### 已知限制

- 预览渲染器里 **LaTeX 是空白**——MathJax 只在 Obsidian 插件侧。预览用来验版式，公式正确性看 `## Embedded Files`。
- 字体 `5`–`10` 依赖插件内置的 Excalidraw 版本；中文场景建议默认 `6`（Nunito）。
- 若笔记正在 Obsidian 中打开时被外部重写，插件会**合并**而不是替换。生成器已改为先删后写；若仍出现叠层，请先关闭该笔记。

### 参与贡献

欢迎提 issue 与 PR。若你遇到 `references/troubleshooting.md` 里没有的渲染或版式问题，附上复现文件（`.excalidraw.md`）与插件版本最有帮助。

### 许可证

[MIT](LICENSE) © 2026 shenwuyue841

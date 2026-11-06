#!/usr/bin/env node
// Config-driven Obsidian Excalidraw canvas generator.
//
// Usage:  node gen_canvas.mjs [outPath]
//         Edit CONFIG below, run, reopen the note in Obsidian.
//
// Output is plain-JSON `.excalidraw.md` (the plugin re-saves it compressed later).
// LaTeX formulas are emitted as image elements + `## Embedded Files` entries —
// both halves are required, see references/latex.md.
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';

// ---------------------------------------------------------------- CONFIG
const CONFIG = {
	out: 'F:/path/to/vault/Canvas.excalidraw.md',

	title: '画布标题',
	subtitle: '副标题 / 中心问题',

	// 'light' = white paper + dark ink (this vault's convention)
	// 'dark'  = dark paper + light ink + locked background rectangle
	paper: 'light',

	colWidth: 320,
	colGap: 28,
	rowPitch: 122,
	formulaHeight: 50,
	fontFamily: 6, // 1 Virgil, 2 Helvetica, 3 Cascadia, 5/6 Excalifont-family
	roughness: 0, // 0 plain, 1 hand-drawn

	columns: [
		{
			title: '① 第一列',
			accent: '#1971c2',
			rows: [
				{ label: '直角坐标', tex: 'A=\\int_{a}^{b} f(x)\\,dx' },
				{ label: '极坐标', tex: 'A=\\frac{1}{2}\\int_{\\alpha}^{\\beta} r^{2}\\,d\\theta' },
				{ label: '提示', text: '交点处分段' },
			],
		},
		{
			title: '② 第二列',
			accent: '#2f9e44',
			rows: [
				{ label: '绕 x 轴', tex: 'V=\\pi\\int_{a}^{b} y^{2}\\,dx' },
				{ label: '绕 y 轴', tex: 'V=2\\pi\\int_{a}^{b} x\\,|y|\\,dx' },
			],
		},
	],

	sections: [
		{
			heading: '易混对照',
			accent: '#e03131',
			pairs: [
				['体积用 dx（薄片厚度）', '侧面积用 ds（弧长）'],
				['圆盘法：垂直于轴切片', '柱壳法：平行于轴卷筒'],
			],
		},
		{
			heading: '信号词索引',
			accent: '#6741d9',
			pairs: [
				['「绕 y 轴」→ 柱壳，或换 x = x(y)', '「侧面积」→ 必须用 ds'],
			],
		},
	],

	questionBox: '待解问题（做题卡点写这里）',
	legend: '颜色约定：蓝 / 绿 / 橙 / 红 / 紫 各代表一类量',
};

// ---------------------------------------------------------------- palette
const PAPER = {
	light: { bg: '#ffffff', ink: '#1e1e1e', muted: '#868e96', line: '#e9ecef', dash: '#ced4da', math: '\\color{black}' },
	dark: { bg: '#141414', ink: '#e9ecef', muted: '#9aa0a6', line: '#2b2f33', dash: '#343a40', math: '\\color{white}' },
}[CONFIG.paper];

// ---------------------------------------------------------------- helpers
// IDs are DERIVED FROM CONTENT, not random. Two reasons:
//   1. regenerating a canvas that is currently open in Obsidian does not
//      accumulate a second copy of every element (same id → same slot);
//   2. equation fileIds stay attached to the same image element, so the
//      plugin never keeps an orphaned image pointing at a vanished formula.
const seen = new Map();
const idFor = (key) => {
	const n = seen.get(key) ?? 0;
	seen.set(key, n + 1);
	return 'ml' + createHash('sha1').update(`${key}#${n}`).digest('hex').slice(0, 10);
};
const hex40 = (tex) => createHash('sha1').update(tex).digest('hex');
const rnd = () => Math.floor(Math.random() * 1e9);
const now = Date.now();

const elements = [];
const equations = [];

const base = (extra = {}) => ({
	angle: 0,
	strokeColor: PAPER.ink,
	backgroundColor: 'transparent',
	fillStyle: 'solid',
	strokeWidth: 1,
	strokeStyle: 'solid',
	roughness: CONFIG.roughness,
	opacity: 100,
	groupIds: [],
	frameId: null,
	roundness: null,
	seed: rnd(),
	version: 1,
	versionNonce: rnd(),
	isDeleted: false,
	boundElements: [],
	updated: now,
	link: null,
	locked: false,
	hasTextLink: false,
	created: null,
	...extra,
});

function text(x, y, t, { fs = 16, color = PAPER.ink } = {}) {
	const lines = t.split('\n');
	let w = 0;
	for (const line of lines) {
		let lw = 0;
		for (const ch of line) lw += /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/.test(ch) ? fs : fs * 0.55;
		w = Math.max(w, lw);
	}
	elements.push(
		base({
			id: idFor(`text:${t}`),
			type: 'text',
			x,
			y,
			width: Math.max(10, w),
			height: lines.length * fs * 1.35,
			strokeColor: color,
			index: `a${elements.length}`,
			text: t,
			rawText: t,
			fontSize: fs,
			fontFamily: CONFIG.fontFamily,
			textAlign: 'left',
			verticalAlign: 'top',
			containerId: null,
			originalText: t,
			autoResize: true,
			lineHeight: 1.35,
			labelPosition: null,
			baseFontSize: null,
		}),
	);
}

function latex(x, y, tex, maxWidth) {
	const plain = tex.replace(/\\color\{[^}]*\}/g, '').replace(/\\[a-zA-Z]+/g, 'x').replace(/[{}\\]/g, '');
	const width = Math.min(maxWidth, Math.max(118, Math.round(plain.length * 11)));
	const full = `${PAPER.math} ${tex}`;
	const fileId = hex40(full);
	equations.push({ fileId, tex: full });
	elements.push(
		base({
			id: idFor(`latex:${full}`),
			type: 'image',
			x,
			y,
			width,
			height: CONFIG.formulaHeight,
			index: `a${elements.length}`,
			fileId,
			scale: [1, 1],
			status: 'pending',
			crop: null,
			customData: { latex: full },
		}),
	);
}

function rect(x, y, w, h, { stroke = PAPER.dash, dash = false, fill = 'transparent', locked = false, key } = {}) {
	elements.push(
		base({
			id: key ? idFor('rect:' + key) : idFor(`rect:${x},${y},${w},${h}`),
			type: 'rectangle',
			x,
			y,
			width: w,
			height: h,
			strokeColor: stroke,
			backgroundColor: fill,
			strokeStyle: dash ? 'dashed' : 'solid',
			roundness: { type: 3 },
			locked,
			index: `a${elements.length}`,
		}),
	);
}

function hline(x1, x2, y, { color = PAPER.line, dash = false, key } = {}) {
	elements.push(
		base({
			id: key ? idFor('line:' + key) : idFor(`line:${x1},${x2},${y}`),
			type: 'line',
			x: x1,
			y,
			width: x2 - x1,
			height: 0,
			strokeColor: color,
			strokeStyle: dash ? 'dashed' : 'solid',
			index: `a${elements.length}`,
			points: [
				[0, 0],
				[x2 - x1, 0],
			],
			lastCommittedPoint: null,
			startBinding: null,
			endBinding: null,
			startArrowhead: null,
			endArrowhead: null,
		}),
	);
}

// ---------------------------------------------------------------- build
const COL = CONFIG.columns.map((_, i) => i * (CONFIG.colWidth + CONFIG.colGap));
const RIGHT = COL[COL.length - 1] + CONFIG.colWidth;

text(0, 14, CONFIG.title, { fs: 30 });
if (CONFIG.subtitle) text(0, 58, CONFIG.subtitle, { fs: 15, color: PAPER.muted });
hline(0, RIGHT, 98, { color: CONFIG.columns[0].accent });

const HEADER_Y = 118;
const ROW_TOP = 176;

CONFIG.columns.forEach((col, ci) => {
	const x = COL[ci];
	text(x, HEADER_Y, col.title, { fs: 20, color: col.accent });
	hline(x, x + 150, HEADER_Y + 30, { color: col.accent });

	col.rows.forEach((row, ri) => {
		const y = ROW_TOP + ri * CONFIG.rowPitch;
		text(x, y, row.label, { fs: 15, color: PAPER.muted });
		if (row.tex) latex(x, y + 28, row.tex, CONFIG.colWidth - 8);
		else if (row.text) text(x, y + 27, row.text, { fs: 15 });
		hline(x, x + CONFIG.colWidth - 20, y + CONFIG.rowPitch - 28, { color: PAPER.line });
	});
});

const maxRows = Math.max(...CONFIG.columns.map((c) => c.rows.length));
let y = ROW_TOP + maxRows * CONFIG.rowPitch + 40;

for (const sec of CONFIG.sections || []) {
	hline(0, RIGHT, y - 20, { dash: true });
	text(0, y, sec.heading, { fs: 20, color: sec.accent });
	y += 44;
	for (const [a, b] of sec.pairs) {
		text(2, y, a, { fs: 15 });
		text(470, y, 'vs', { fs: 15, color: PAPER.muted });
		text(512, y, b, { fs: 15, color: sec.accent });
		y += 36;
	}
	y += 18;
}

if (CONFIG.questionBox) {
	hline(0, RIGHT, y - 14, { dash: true });
	text(0, y, CONFIG.questionBox, { fs: 20, color: '#6741d9' });
	y += 44;
	rect(0, y, RIGHT, 120, { stroke: '#6741d9', dash: true });
	[40, 80].forEach((dy) => hline(16, RIGHT - 16, y + dy, { dash: true }));
	y += 138;
}

if (CONFIG.legend) text(0, y, CONFIG.legend, { fs: 12, color: PAPER.muted });

// dark paper: locked background rectangle behind everything
if (CONFIG.paper === 'dark') {
	const maxX = Math.max(...elements.map((e) => e.x + (e.width || 0)));
	const maxY = Math.max(...elements.map((e) => e.y + (e.height || 0)));
	elements.unshift(
		base({
			id: key ? idFor('rect:' + key) : idFor(`rect:${x},${y},${w},${h}`),
			type: 'rectangle',
			x: -40,
			y: -40,
			width: maxX + 80,
			height: maxY + 80,
			strokeColor: PAPER.bg,
			backgroundColor: PAPER.bg,
			strokeWidth: 0,
			roundness: null,
			locked: true,
			index: 'a0',
		}),
	);
}

// ---------------------------------------------------------------- write
const drawing = {
	type: 'excalidraw',
	version: 2,
	source: 'https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/2.29.1',
	elements,
	appState: {
		theme: CONFIG.paper === 'dark' ? 'dark' : 'dark',
		viewBackgroundColor: PAPER.bg,
		gridSize: 20,
		gridStep: 5,
		gridModeEnabled: false,
		scrollX: 0,
		scrollY: 0,
		zoom: { value: 0.75 },
		currentItemFontFamily: CONFIG.fontFamily,
		currentItemRoughness: CONFIG.roughness,
	},
	files: {},
};

const md = `---
excalidraw-plugin: parsed
tags: [excalidraw]

---
==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠== You can decompress Drawing data with the command palette: 'Decompress current Excalidraw file'. For more info check in plugin settings under 'Saving'


# Excalidraw Data

## Text Elements


## Embedded Files
${equations.map((e) => `${e.fileId}: $$${e.tex}$$`).join('\n\n')}

%%
## Drawing
\`\`\`json
${JSON.stringify(drawing, null, '\t')}
\`\`\`
%%
`;

mkdirSync(dirname(CONFIG.out), { recursive: true });
// Unlink first: the Obsidian plugin merges elements into the *open* view when a
// file changes on disk, which duplicates everything. A delete + create cycle
// makes the vault treat it as a new document instead of an in-place edit.
if (existsSync(CONFIG.out)) {
	rmSync(CONFIG.out, { force: true });
}
writeFileSync(CONFIG.out, md, 'utf8');
console.log(`wrote ${elements.length} elements / ${equations.length} equations → ${CONFIG.out}`);
console.log('next: node inspect_canvas.mjs "' + CONFIG.out + '"');

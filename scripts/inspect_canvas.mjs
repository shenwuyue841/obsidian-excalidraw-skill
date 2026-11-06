#!/usr/bin/env node
// Inspect an Obsidian Excalidraw note: decode either encoding, audit structure.
//
// Usage:
//   node inspect_canvas.mjs <file.excalidraw.md>          # audit summary
//   node inspect_canvas.mjs <file.excalidraw.md> --dump   # print scene JSON
//
// Handles both `json` and `compressed-json` Drawing blocks. The compressed
// payload is LZString compressToBase64 hard-wrapped at ~120 chars — whitespace
// MUST be stripped before decoding, otherwise the decode returns null.
import { readFileSync } from 'node:fs';

// ---------------------------------------------------------------- LZString
const keyStrBase64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
const baseReverseDic = {};

function getBaseValue(alphabet, character) {
	if (!baseReverseDic[alphabet]) {
		baseReverseDic[alphabet] = {};
		for (let i = 0; i < alphabet.length; i++) baseReverseDic[alphabet][alphabet.charAt(i)] = i;
	}
	return baseReverseDic[alphabet][character];
}

function decompress(input) {
	const length = input.length;
	let resetValue = 32;
	const getNextValue = (index) => getBaseValue(keyStrBase64, input.charAt(index));

	const dictionary = [];
	let enlargeIn = 4;
	let dictSize = 4;
	let numBits = 3;
	let entry = '';
	const result = [];
	let i;
	let w;
	let bits, resb, maxpower, power;
	let c;
	const data = { val: getNextValue(0), position: resetValue, index: 1 };

	for (i = 0; i < 3; i += 1) dictionary[i] = i;

	const readBits = (n) => {
		let v = 0;
		let p = 1;
		const max = Math.pow(2, n);
		while (p !== max) {
			resb = data.val & data.position;
			data.position >>= 1;
			if (data.position === 0) {
				data.position = resetValue;
				data.val = getNextValue(data.index++);
			}
			v |= (resb > 0 ? 1 : 0) * p;
			p <<= 1;
		}
		return v;
	};

	switch (readBits(2)) {
		case 0:
			c = String.fromCharCode(readBits(8));
			break;
		case 1:
			c = String.fromCharCode(readBits(16));
			break;
		case 2:
			return '';
	}
	dictionary[3] = c;
	w = c;
	result.push(c);

	while (true) {
		if (data.index > length) return '';
		c = readBits(numBits);
		if (c === 0) {
			dictionary[dictSize++] = String.fromCharCode(readBits(8));
			c = dictSize - 1;
			enlargeIn -= 1;
		} else if (c === 1) {
			dictionary[dictSize++] = String.fromCharCode(readBits(16));
			c = dictSize - 1;
			enlargeIn -= 1;
		} else if (c === 2) {
			return result.join('');
		}
		if (enlargeIn === 0) {
			enlargeIn = Math.pow(2, numBits);
			numBits++;
		}
		if (dictionary[c]) entry = dictionary[c];
		else if (c === dictSize) entry = w + w.charAt(0);
		else return null;
		result.push(entry);
		dictionary[dictSize++] = w + entry.charAt(0);
		enlargeIn -= 1;
		w = entry;
		if (enlargeIn === 0) {
			enlargeIn = Math.pow(2, numBits);
			numBits++;
		}
	}
}

// ---------------------------------------------------------------- load
const file = process.argv[2];
if (!file) {
	console.error('usage: node inspect_canvas.mjs <file.excalidraw.md> [--dump]');
	process.exit(2);
}
const raw = readFileSync(file, 'utf8');
const block = raw.match(/## Drawing\s*\n```(json|compressed-json)\n([\s\S]*?)\n```/);
if (!block) {
	console.error('✗ no ## Drawing block with a json / compressed-json fence');
	process.exit(1);
}
const encoding = block[1];
const body = block[2];
let scene;
if (encoding === 'json') {
	scene = JSON.parse(body.trim());
} else {
	const flat = body.replace(/\s+/g, '');
	scene = JSON.parse(decompress(flat));
	if (!scene) {
		console.error('✗ decompression returned null (check whitespace stripping)');
		process.exit(1);
	}
}

if (process.argv.includes('--dump')) {
	console.log(JSON.stringify(scene, null, 2));
	process.exit(0);
}

// --describe: compact, human/AI-readable inventory — what is on this canvas,
// where, and what connects to what. Meant to be read before editing, so you
// address elements by id instead of by coordinates.
if (process.argv.includes('--describe')) {
	const els = (scene.elements || []).filter((e) => !e.isDeleted);
	const byId = new Map(els.map((e) => [e.id, e]));
	console.log(`# ${file}`);
	console.log(`# theme=${scene.appState?.theme} bg=${scene.appState?.viewBackgroundColor} elements=${els.length}`);
	const textOf = (e) => (e.text || e.label?.text || '').replace(/\n/g, ' ⏎ ');
	for (const e of els) {
		const pos = `${Math.round(e.x)},${Math.round(e.y)} ${Math.round(e.width || 0)}x${Math.round(e.height || 0)}`;
		if (e.type === 'text') {
			console.log(`text   ${e.id}  @${pos}  "${textOf(e).slice(0, 60)}"`);
		} else if (e.type === 'image') {
			const tex = e.customData?.latex ? ` latex: ${String(e.customData.latex).slice(0, 60)}` : '';
			console.log(`image  ${e.id}  @${pos}${tex}`);
		} else if (e.type === 'arrow' || e.type === 'line') {
			const a = e.startBinding ? byId.get(e.startBinding.elementId)?.id ?? e.startBinding.elementId : '·';
			const b = e.endBinding ? byId.get(e.endBinding.elementId)?.id ?? e.endBinding.elementId : '·';
			const pts = (e.points || []).length;
			console.log(`${e.type.padEnd(6)} ${e.id}  @${pos}  ${a} → ${b}  points=${pts}`);
		} else {
			console.log(`${e.type.padEnd(6)} ${e.id}  @${pos}  fill=${e.backgroundColor}${e.text ? `  "${textOf(e).slice(0, 40)}"` : ''}`);
		}
	}
	process.exit(0);
}

// ---------------------------------------------------------------- audit
const issues = [];
const el = scene.elements || [];

console.log(`file       : ${file}`);
console.log(`encoding   : ${encoding}`);
console.log(`theme      : ${scene.appState?.theme}   bg: ${scene.appState?.viewBackgroundColor}`);
console.log(`elements   : ${el.length}`);

const types = {};
for (const e of el) types[e.type] = (types[e.type] || 0) + 1;
console.log(`types      : ${JSON.stringify(types)}`);

// equations ↔ images
const embedded = [...raw.matchAll(/^([0-9a-f]{40}): \$\$([\s\S]*?)\$\$/gm)].map((m) => ({ id: m[1], tex: m[2] }));
const images = el.filter((e) => e.type === 'image');
const embIds = new Set(embedded.map((e) => e.id));
const missingEq = images.filter((e) => !embIds.has(e.fileId));
const orphanEq = embedded.filter((e) => !images.some((i) => i.fileId === e.id));
console.log(`equations  : ${embedded.length}   images: ${images.length}`);
if (missingEq.length) issues.push(`${missingEq.length} image(s) without an Embedded Files equation → they render broken`);
if (orphanEq.length) issues.push(`${orphanEq.length} orphan equation line(s) with no image element`);
if (raw.includes('$$$')) issues.push('found "$$$" — TeX was double-wrapped, the $ signs will be printed literally');
const dupTex = embedded.length - new Set(embedded.map((e) => e.tex)).size;
if (dupTex > 0) issues.push(`${dupTex} duplicated equation(s) — the merge-on-regenerate bug has already run on this file`);

// ids / bindings
const ids = new Set(el.map((e) => e.id));
if (ids.size !== el.length) issues.push('duplicate element ids');
for (const e of el) {
	for (const b of [e.startBinding, e.endBinding]) {
		if (b && !ids.has(b.elementId)) issues.push(`dangling binding on ${e.id} → ${b.elementId}`);
	}
	for (const b of e.boundElements || []) {
		if (!ids.has(b.id)) issues.push(`boundElements points to missing ${b.id} (from ${e.id})`);
	}
}

// typography
const fonts = {};
const rough = {};
const strokes = {};
for (const e of el) {
	if (e.type === 'text') fonts[e.fontFamily] = (fonts[e.fontFamily] || 0) + 1;
	rough[e.roughness] = (rough[e.roughness] || 0) + 1;
	if (e.type !== 'image') strokes[e.strokeColor] = (strokes[e.strokeColor] || 0) + 1;
}
console.log(`fontFamily : ${JSON.stringify(fonts)}`);
console.log(`roughness  : ${JSON.stringify(rough)}`);
console.log(`strokeColor: ${JSON.stringify(Object.entries(strokes).sort((a, b) => b[1] - a[1]).slice(0, 8))}`);

// geometry
const maxX = Math.max(...el.map((e) => e.x + (e.width || 0)));
const maxY = Math.max(...el.map((e) => e.y + (e.height || 0)));
const minX = Math.min(...el.map((e) => e.x));
const minY = Math.min(...el.map((e) => e.y));
console.log(`bounds     : ${Math.round(maxX - minX)} × ${Math.round(maxY - minY)}   (origin ${Math.round(minX)}, ${Math.round(minY)})`);

// ---------------------------------------------------------------- aesthetics
// Metrics from references/design-metrics.md. Advisory: these print warnings
// instead of failing, since a deliberately dense canvas can be legitimate.
const texts = el.filter((e) => e.type === 'text');
const rects = el.filter((e) => e.type === 'rectangle');
const warns = [];

// 1) container ratio — text bound inside a shape
const boundText = texts.filter((e) => e.containerId).length;
const ratio = texts.length ? boundText / texts.length : 0;
console.log(
	`containers : ${rects.length} rect / ${texts.length} text   bound-text ratio ${(ratio * 100).toFixed(0)}%`,
);
if (ratio > 0.3) warns.push(`bound-text ratio ${(ratio * 100).toFixed(0)}% > 30% → reads as a table of boxes, not a diagram`);

// 2) font size levels — more than 4 distinct sizes feels noisy
const sizes = [...new Set(texts.map((e) => e.fontSize))].sort((a, b) => a - b);
console.log(`font sizes : ${sizes.join(', ')}  (${sizes.length} levels)`);
if (sizes.length > 4) warns.push(`${sizes.length} distinct font sizes — collapse to 4 levels (hero / section / body / detail)`);

// 3) formula size variance
if (images.length) {
	const hs = images.map((e) => e.height);
	const ws = images.map((e) => e.width);
	const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
	const sd = (a) => {
		const m = mean(a);
		return Math.sqrt(mean(a.map((v) => (v - m) ** 2)));
	};
	const hSd = sd(hs);
	const wCv = sd(ws) / mean(ws);
	console.log(
		`formula    : h ${Math.round(Math.min(...hs))}–${Math.round(Math.max(...hs))} (sd ${hSd.toFixed(1)})   w ${Math.round(Math.min(...ws))}–${Math.round(Math.max(...ws))} (cv ${wCv.toFixed(2)})`,
	);
	if (hSd > 2) warns.push(`formula heights vary (sd ${hSd.toFixed(1)}) — fix the height, vary only the width`);
	if (wCv > 0.45) warns.push(`formula width cv ${wCv.toFixed(2)} > 0.45 — short formulas are probably stretched`);
}

// 4) accidental overlap among text / image / rect boxes
const boxed = el.filter((e) => ['text', 'image', 'rectangle'].includes(e.type));
const pairs = [];
for (let i = 0; i < boxed.length; i++) {
	for (let j = i + 1; j < boxed.length; j++) {
		const a = boxed[i];
		const b = boxed[j];
		const ox = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
		const oy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
		if (ox <= 4 || oy <= 4) continue;
		// text sitting inside a rectangle is intentional (container)
		if (b.type === 'rectangle' && a.type === 'text' && a.x >= b.x && a.y >= b.y) continue;
		if (a.type === 'rectangle' && b.type === 'text' && b.x >= a.x && b.y >= a.y) continue;
		pairs.push(`${a.type}@${Math.round(a.x)},${Math.round(a.y)} ∩ ${b.type}@${Math.round(b.x)},${Math.round(b.y)}  ${Math.round(ox)}×${Math.round(oy)}`);
	}
}
console.log(`overlaps   : ${pairs.length}`);
if (pairs.length) {
	warns.push(`${pairs.length} overlapping box pair(s) — check text clipping / stacked formulas`);
	for (const p of pairs.slice(0, 6)) console.log(`   · ${p}`);
}

// 5) margin from origin
if (minX < 0 || minY < 0) warns.push(`negative origin (${Math.round(minX)}, ${Math.round(minY)}) — content starts off-canvas`);

// 6) duplicated content = the "regenerate while open" merge bug
// A couple of repeated labels ("直角坐标" in two columns, "vs") are normal, so
// only flag it when a large share of all distinct strings is duplicated.
const textCount = new Map();
for (const t of texts) textCount.set(t.text, (textCount.get(t.text) || 0) + 1);
const dupTexts = [...textCount.entries()].filter(([, n]) => n > 1);
const dupShare = textCount.size ? dupTexts.length / textCount.size : 0;
if (dupShare > 0.4) {
	warns.push(
		`${Math.round(dupShare * 100)}% of distinct texts are duplicated (max ×${Math.max(...dupTexts.map((d) => d[1]))}) — the merge-on-regenerate bug, see troubleshooting.md`,
	);
	for (const [t, n] of dupTexts.slice(0, 3)) console.log(`   · "${t.slice(0, 24)}" ×${n}`);
}

if (issues.length) {
	console.log('\nissues:');
	for (const i of issues) console.log(` - ${i}`);
	process.exitCode = 1;
} else {
	console.log('\nOK — no structural issues found');
}

if (warns.length) {
	console.log('\naesthetic warnings (advisory):');
	for (const w of warns) console.log(` ~ ${w}`);
}


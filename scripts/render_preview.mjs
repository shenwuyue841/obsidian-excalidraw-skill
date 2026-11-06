#!/usr/bin/env node
// Render an Obsidian `.excalidraw.md` (or plain `.excalidraw`) to PNG without a
// browser, so you can actually LOOK at the layout before handing it over.
//
//   node render_preview.mjs <file.excalidraw.md> [--out preview.png] [--scale 2] [--dark]
//
// Why this exists: the Obsidian plugin cannot be driven headlessly, and judging a
// canvas from JSON alone is guesswork ("text overlaps", "spacing looks off").
// mcp-excalidraw-server ships a Node renderer that reads both encodings of the
// Obsidian format and rasterises with Excalidraw's own renderer.
//
// KNOWN LIMITATION — LaTeX comes out BLANK. Formula images carry a fileId that
// only the Obsidian plugin + Excalidraw Extras can resolve (MathJax lives there,
// not in the renderer). So this preview verifies *layout*: alignment, spacing,
// overlap, text clipping, line routing. Never concluded from a blank box that a
// formula is broken — check `## Embedded Files` with inspect_canvas.mjs instead.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('--'));
if (!file) {
	console.error('usage: node render_preview.mjs <file.excalidraw.md> [--out png] [--scale 2] [--dark]');
	process.exit(2);
}
const abs = resolve(file);
if (!existsSync(abs)) {
	console.error(`✗ not found: ${abs}`);
	process.exit(2);
}

const flag = (name) => argv.includes(name);
const value = (name) => {
	const i = argv.indexOf(name);
	return i >= 0 ? argv[i + 1] : undefined;
};

const out = value('--out') ?? join(dirname(abs), `${basename(abs).replace(/\.excalidraw\.md$|\.excalidraw$/, '')}.png`);
mkdirSync(dirname(out), { recursive: true });

// npm's global cache is read-only on some machines (EPERM on install); point it
// at a private cache so `npx -y` can unpack without touching the system one.
const cache = join(tmpdir(), 'mcp-excalidraw-cache');
mkdirSync(cache, { recursive: true });

const args = ['-y', 'mcp-excalidraw-server', 'render', abs, '--out', out];
if (value('--scale')) args.push('--scale', value('--scale'));
if (flag('--dark')) args.push('--dark');
if (value('--padding')) args.push('--padding', value('--padding'));

const res = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
	encoding: 'utf8',
	env: { ...process.env, npm_config_cache: cache },
	shell: process.platform === 'win32',
	timeout: 300000,
});

const stdout = (res.stdout || '').trim();
const stderr = (res.stderr || '').trim();

if (!existsSync(out)) {
	console.error('✗ render failed');
	if (stdout) console.error(stdout.slice(-1200));
	if (stderr) console.error(stderr.slice(-1200));
	process.exit(1);
}

const kb = Math.round(statSync(out).size / 1024);
console.log(`rendered → ${out}  (${kb} kB)`);
console.log('note: LaTeX blocks are blank in this preview — layout only.');
const warn = stdout.match(/"warnings"\s*:\s*\[[^\]]*\]/);
if (warn) console.log(`renderer warnings: ${warn[0]}`);

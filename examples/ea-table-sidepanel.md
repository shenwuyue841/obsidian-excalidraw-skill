/*
 * ExcaliTable: Markdown ↔ Excalidraw table side panel
 *
 * 1. 粘贴 Markdown 表格（或从当前笔记读取），实时解析
 * 2. 侧栏里调字号 / 行高 / 列宽 / 网格 / 表头底色 / 斑马纹 / 配色，预览即时刷新
 * 3. 插入到画布；选中已生成的表格会回到编辑态，改参数后「更新已选」就地重排
 *
 * 支持的 Markdown 表格：
 *   | 列 A | 列 B |
 *   | :--- | ---: |
 *   | 1    | 2    |
 * 首尾竖线可省略；`:---` / `:--:` / `---:` 决定左 / 中 / 右对齐；`\|` 表示字面竖线。
 ```js*/

if (!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("2.25.3")) {
  new Notice("ExcaliTable 需要 Excalidraw 插件 2.25.3 或更新版本。");
  return;
}

const SAMPLE = `| 量 | 公式 | 备注 |
| :--- | :---: | ---: |
| 面积 | A=\\int f(x)dx | 上减下 |
| 体积 | V=\\pi\\int y^2dx | 绕 x 轴 |
| 弧长 | s=\\int\\sqrt{1+y'^2}dx | 三式同源 |`;

const DEFAULTS = {
  fontSize: 16,
  rowH: 44,
  colMode: "auto", // auto | equal | manual
  colWidth: 160,
  pad: 12,
  grid: "full", // full | horizontal | box | none
  headerFill: true,
  zebra: false,
  headerBg: "#f1f3f5",
  zebraBg: "#f8f9fa",
  lineColor: "#ced4da",
  textColor: "#1e1e1e",
  headerTextColor: "#1e1e1e",
  strokeWidth: 1,
  fontFamily: 6,
};

let state = { src: SAMPLE, style: { ...DEFAULTS } };
let editIds = [];
let contentEl = null;
let previewBox = null;
let debounceTimer = null;

// ---------------------------------------------------------------- parse
function splitRow(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const out = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\" && s[i + 1] === "|") {
      cur += "|";
      i++;
    } else if (ch === "|") {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out.map((c) => c.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`(.+?)`/g, "$1"));
}

function parseTable(src) {
  const lines = src.split(/\r?\n/).filter((l) => l.trim().includes("|"));
  if (lines.length === 0) return { rows: [], aligns: [] };
  const rows = [];
  let aligns = null;
  for (const line of lines) {
    const cells = splitRow(line);
    const isSep = cells.every((c) => /^:?-{1,}:?$/.test(c.replace(/\s/g, "")));
    if (isSep) {
      aligns = cells.map((c) => {
        const t = c.replace(/\s/g, "");
        if (t.startsWith(":") && t.endsWith(":")) return "center";
        if (t.endsWith(":")) return "right";
        return "left";
      });
      continue;
    }
    rows.push(cells);
  }
  const cols = Math.max(0, ...rows.map((r) => r.length));
  const norm = rows.map((r) => {
    const out = r.slice(0, cols);
    while (out.length < cols) out.push("");
    return out;
  });
  const al = [];
  for (let i = 0; i < cols; i++) al.push(aligns?.[i] ?? "left");
  return { rows: norm, aligns: al };
}

// ---------------------------------------------------------------- build
function styleHeader(s) {
  ea.style.fontFamily = s.fontFamily;
  ea.style.fontSize = s.fontSize;
  ea.style.roughness = 0;
  ea.style.strokeWidth = s.strokeWidth;
  ea.style.strokeStyle = "solid";
  ea.style.fillStyle = "solid";
  ea.style.opacity = 100;
}

function columnWidths(table, s) {
  const cols = table.rows[0]?.length ?? 0;
  if (s.colMode === "manual") return new Array(cols).fill(s.colWidth);
  styleHeader(s);
  const w = [];
  for (let c = 0; c < cols; c++) {
    let max = 0;
    for (const row of table.rows) max = Math.max(max, ea.measureText(row[c] ?? "").width);
    w.push(Math.min(420, Math.max(88, Math.ceil(max + s.pad * 2))));
  }
  if (s.colMode === "equal") {
    const m = Math.max(...w);
    return w.map(() => m);
  }
  return w;
}

// 生成表格元素并放进 EA workbench；返回 ids（未提交到画布）
function buildTable(table, s) {
  ea.clear();
  if (!table.rows.length) return [];
  const widths = columnWidths(table, s);
  const totalW = widths.reduce((a, b) => a + b, 0);
  const rowH = s.rowH;
  const totalH = rowH * table.rows.length;
  const ids = [];

  styleHeader(s);

  // 1) 底色：表头 + 斑马纹
  const fills = [];
  for (let r = 0; r < table.rows.length; r++) {
    const isHeader = r === 0 && s.headerFill;
    const isZebra = s.zebra && r > 0 && r % 2 === 0;
    if (!isHeader && !isZebra) continue;
    ea.style.backgroundColor = isHeader ? s.headerBg : s.zebraBg;
    ea.style.strokeColor = "transparent";
    ea.style.strokeWidth = 0;
    const id = ea.addRect(0, r * rowH, totalW, rowH);
    ids.push(id);
    fills.push(id);
  }

  // 2) 网格：full = 全网格；horizontal = 只画横线；box = 外框 + 横线；none = 不画
  if (s.grid !== "none") {
    ea.style.strokeColor = s.lineColor;
    ea.style.backgroundColor = "transparent";
    ea.style.strokeWidth = s.strokeWidth;

    // 横线：每条行边界一条，首尾都画
    for (let r = 0; r <= table.rows.length; r++) {
      const y = r * rowH;
      ids.push(ea.addLine([[0, y], [totalW, y]]));
    }

    // 竖线：只有 full 需要内部竖线；box 只要左右两条
    if (s.grid === "full" || s.grid === "box") {
      const xs = [0];
      let acc = 0;
      for (const w of widths) {
        acc += w;
        xs.push(acc);
      }
      const drawXs = s.grid === "full" ? xs : [0, totalW];
      for (const x of drawXs) ids.push(ea.addLine([[x, 0], [x, totalH]]));
    }
  }

  // 3) 文字
  let x = 0;
  for (let c = 0; c < widths.length; c++) {
    const w = widths[c];
    const align = table.aligns[c] ?? "left";
    for (let r = 0; r < table.rows.length; r++) {
      const text = table.rows[r][c] ?? "";
      if (!text) continue;
      const isHeader = r === 0;
      ea.style.strokeColor = isHeader ? s.headerTextColor : s.textColor;
      const id = ea.addText(x + s.pad, r * rowH + s.pad / 2, text, {
        width: w - s.pad * 2,
        height: rowH - s.pad,
        textAlign: align,
        textVerticalAlign: "middle",
        autoResize: false,
      });
      ids.push(id);
    }
    x += w;
  }

  const els = ea.getElements();
  const bbox = ea.getBoundingBox(els);
  els.forEach((e) => {
    e.x -= bbox.topX;
    e.y -= bbox.topY;
    e.customData = { ...(e.customData || {}), excaliTable: { v: 1, src: state.src, style: { ...s } } };
  });
  return ids;
}

// ---------------------------------------------------------------- preview
function applyPreviewTheme(el) {
  const st = ea.getExcalidrawAPI()?.getAppState();
  const isDark = st?.theme === "dark";
  el.style.backgroundColor = st?.viewBackgroundColor || "#ffffff";
  el.style.filter = isDark ? "invert(93%) hue-rotate(180deg) saturate(1.25)" : "none";
}

async function renderPreview() {
  if (!previewBox) return;
  previewBox.empty();
  const table = parseTable(state.src);
  if (!table.rows.length) {
    previewBox.createEl("div", { text: "没有解析到表格。粘贴一个 Markdown 表格试试。", cls: "excalitable-hint" });
    return;
  }
  try {
    buildTable(table, state.style);
    const svg = await ea.createSVG(null, false, { withBackground: false, withTheme: false }, undefined, "light", 12);
    ea.clear();
    if (svg) {
      svg.style.width = "100%";
      svg.style.height = "100%";
      svg.style.objectFit = "contain";
      previewBox.appendChild(svg);
    }
  } catch (e) {
    ea.clear();
    previewBox.createEl("div", { text: "预览失败：" + e.message, cls: "excalitable-hint" });
  }
}

function schedulePreview() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => renderPreview(), 250);
}

// ---------------------------------------------------------------- actions
async function insertTable() {
  const table = parseTable(state.src);
  if (!table.rows.length) {
    new Notice("没有可插入的表格。");
    return;
  }

  let centerX = ea.getViewCenterPosition().x;
  let centerY = ea.getViewCenterPosition().y;

  if (editIds.length) {
    const old = ea.getViewElements().filter((e) => editIds.includes(e.id));
    if (old.length) {
      const bb = ea.getBoundingBox(old);
      centerX = bb.topX + bb.width / 2;
      centerY = bb.topY + bb.height / 2;
      // 先提交删除，再重建；否则 buildTable() 里的 ea.clear() 会把删除动作一起清掉
      ea.copyViewElementsToEAforEditing(old);
      ea.getElements().forEach((e) => (e.isDeleted = true));
      await ea.addElementsToView(false, false);
      ea.clear();
    }
  }

  const ids = buildTable(table, state.style);
  const els = ea.getElements();
  const bb = ea.getBoundingBox(els);
  const dx = centerX - (bb.topX + bb.width / 2);
  const dy = centerY - (bb.topY + bb.height / 2);
  els.forEach((e) => {
    e.x += dx;
    e.y += dy;
  });
  ea.addToGroup(ids);
  await ea.addElementsToView(false, false, true);
  const committed = ea.getViewElements().filter((e) => ids.includes(e.id));
  if (committed.length) ea.selectElementsInView(committed);
  editIds = ids;
  new Notice(`已插入表格：${table.rows.length - 1} 行 × ${table.rows[0].length} 列`);
}

async function loadFromActiveNote() {
  const file = app.workspace.getActiveFile();
  if (!file) {
    new Notice("没有活动笔记。");
    return;
  }
  const text = await app.vault.read(file);
  const m = text.match(/(^|\n)(\|[^\n]*\|[^\n]*\n\|[\s:|-]+\|[^\n]*(\n\|[^\n]*\|[^\n]*)*)/);
  if (!m) {
    new Notice("这篇笔记里没找到 Markdown 表格。");
    return;
  }
  state.src = m[2].trim();
  saveState();
  renderAll();
  new Notice("已读取当前笔记中的表格。");
}

// ---------------------------------------------------------------- persist
async function loadState() {
  try {
    const s = ea.getScriptSettings();
    if (s["ExcaliTable"]) {
      const saved = JSON.parse(s["ExcaliTable"].value);
      state = { ...state, ...saved, style: { ...DEFAULTS, ...(saved.style || {}) } };
    }
  } catch (e) {}
}

async function saveState() {
  const s = ea.getScriptSettings();
  s["ExcaliTable"] = { value: JSON.stringify(state) };
  await ea.setScriptSettings(s);
}

// ---------------------------------------------------------------- UI
function injectCSS(el) {
  el.createEl("style", {
    text: `
    .excalitable-panel { display:flex; flex-direction:column; gap:10px; height:100%; padding:10px; overflow-y:auto; }
    .excalitable-head { display:flex; align-items:center; gap:8px; border-bottom:1px solid var(--background-modifier-border); padding-bottom:8px; }
    .excalitable-head h2 { margin:0; font-size:1.1em; }
    .excalitable-src textarea { width:100%; height:110px; font-family:var(--font-monospace); font-size:0.85em; }
    .excalitable-preview { flex:0 0 auto; min-height:200px; border:1px solid var(--background-modifier-border); border-radius:8px; display:flex; align-items:center; justify-content:center; padding:8px; overflow:hidden; }
    .excalitable-preview svg { width:100%; height:100%; }
    .excalitable-hint { color:var(--text-muted); font-size:0.85em; padding:12px; text-align:center; }
    .excalitable-actions { display:flex; gap:8px; margin-top:auto; padding-top:10px; border-top:1px solid var(--background-modifier-border); }
    .excalitable-actions button { flex:1; }
    .excalitable-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    .excalitable-setting { padding:4px 0 !important; border:none !important; }
    .excalitable-setting .setting-item-info { flex:1; }
    .excalitable-setting .setting-item-control { flex:1; justify-content:flex-end; }
  `,
  });
}

function setting(parent, name) {
  const s = new ea.obsidian.Setting(parent).setName(name).setClass("excalitable-setting");
  return s;
}

function colorRow(parent, name, key) {
  let textInput, picker;
  const s = setting(parent, name);
  s.addText((t) => {
    textInput = t;
    t.setValue(state.style[key]).onChange((v) => {
      state.style[key] = v;
      picker?.setValue(v);
      saveState();
      schedulePreview();
    });
    t.inputEl.style.width = "90px";
  });
  s.addColorPicker((p) => {
    picker = p;
    p.setValue(state.style[key]).onChange((v) => {
      state.style[key] = v;
      textInput?.setValue(v);
      saveState();
      schedulePreview();
    });
  });
  s.addButton((b) =>
    b.setIcon("swatch-book").onClick(async () => {
      const c = await ea.showColorPicker(b.buttonEl, "elementStroke");
      if (!c) return;
      state.style[key] = c;
      textInput?.setValue(c);
      picker?.setValue(c);
      saveState();
      schedulePreview();
    }),
  );
}

function renderAll() {
  if (!contentEl) return;
  contentEl.empty();
  contentEl.addClass("excalitable-panel");
  injectCSS(contentEl);

  const head = contentEl.createDiv({ cls: "excalitable-head" });
  head.innerHTML = `<h2>${ea.obsidian.getIcon("table").outerHTML} ExcaliTable</h2>`;

  // 数据源
  const srcWrap = contentEl.createDiv({ cls: "excalitable-src" });
  setting(srcWrap, "Markdown 表格").addTextArea((t) => {
    t.setValue(state.src);
    t.onChange((v) => {
      state.src = v;
      saveState();
      schedulePreview();
    });
  });
  const srcBtns = srcWrap.createDiv({ cls: "excalitable-grid2" });
  srcBtns.createEl("button", { text: "读取当前笔记" }).onclick = () => loadFromActiveNote();
  srcBtns.createEl("button", { text: "清空" }).onclick = () => {
    state.src = "";
    saveState();
    renderAll();
  };

  // 字号
  setting(contentEl, "字号").addDropdown((d) =>
    d
      .addOption("12", "12")
      .addOption("14", "14")
      .addOption("16", "16")
      .addOption("20", "20")
      .setValue(String(state.style.fontSize))
      .onChange((v) => {
        state.style.fontSize = Number(v);
        saveState();
        schedulePreview();
      }),
  );

  // 行高
  setting(contentEl, "行高").addSlider((s) =>
    s
      .setLimits(28, 80, 2)
      .setValue(state.style.rowH)
      .onChange((v) => {
        state.style.rowH = v;
        saveState();
        schedulePreview();
      }),
  );

  // 列宽
  setting(contentEl, "列宽").addDropdown((d) =>
    d
      .addOption("auto", "按内容")
      .addOption("equal", "等宽")
      .addOption("manual", "固定")
      .setValue(state.style.colMode)
      .onChange((v) => {
        state.style.colMode = v;
        saveState();
        renderAll();
      }),
  );
  if (state.style.colMode === "manual") {
    setting(contentEl, "固定列宽").addSlider((s) =>
      s
        .setLimits(80, 400, 10)
        .setValue(state.style.colWidth)
        .onChange((v) => {
          state.style.colWidth = v;
          saveState();
          schedulePreview();
        }),
    );
  }

  // 内边距
  setting(contentEl, "内边距").addSlider((s) =>
    s
      .setLimits(4, 28, 2)
      .setValue(state.style.pad)
      .onChange((v) => {
        state.style.pad = v;
        saveState();
        schedulePreview();
      }),
  );

  // 网格
  setting(contentEl, "网格线").addDropdown((d) =>
    d
      .addOption("full", "全网格")
      .addOption("horizontal", "仅横线")
      .addOption("box", "仅外框 + 横线")
      .addOption("none", "无线")
      .setValue(state.style.grid)
      .onChange((v) => {
        state.style.grid = v;
        saveState();
        schedulePreview();
      }),
  );

  setting(contentEl, "表头底色").addToggle((t) =>
    t.setValue(state.style.headerFill).onChange((v) => {
      state.style.headerFill = v;
      saveState();
      schedulePreview();
    }),
  );
  setting(contentEl, "斑马纹").addToggle((t) =>
    t.setValue(state.style.zebra).onChange((v) => {
      state.style.zebra = v;
      saveState();
      schedulePreview();
    }),
  );

  colorRow(contentEl, "线条颜色", "lineColor");
  colorRow(contentEl, "正文颜色", "textColor");
  colorRow(contentEl, "表头文字", "headerTextColor");
  if (state.style.headerFill) colorRow(contentEl, "表头底色值", "headerBg");
  if (state.style.zebra) colorRow(contentEl, "斑马纹底色", "zebraBg");

  // 预览
  previewBox = contentEl.createDiv({ cls: "excalitable-preview" });
  applyPreviewTheme(previewBox);

  // 动作
  const actions = contentEl.createDiv({ cls: "excalitable-actions" });
  const insertBtn = actions.createEl("button", { cls: "mod-cta" });
  insertBtn.innerHTML = `${ea.obsidian.getIcon(editIds.length ? "refresh-cw" : "plus-circle").outerHTML} ${
    editIds.length ? "更新已选" : "插入表格"
  }`;
  insertBtn.onclick = () => insertTable();

  renderPreview();
}

// ---------------------------------------------------------------- hooks
async function main() {
  const existing = ea.checkForActiveSidepanelTabForScript();
  if (existing) {
    const host = existing.getHostEA();
    if (host && host !== ea) {
      host.setView(ea.targetView);
      existing.open();
      return;
    }
  }

  await loadState();
  const tab = await ea.createSidepanelTab("ExcaliTable", true, true);
  if (!tab) return;
  contentEl = tab.contentEl;

  tab.onOpen = () => {
    editIds = [];
    renderAll();
  };
  tab.onFocus = (view) => {
    if (view && view !== ea.targetView) {
      ea.setView(view);
      ea.clear();
    }
    applyPreviewTheme(previewBox);
  };
  tab.onClose = () => {
    ea.onSceneChangeHook = null;
    saveState();
  };

  // 选中已生成的表格 → 回到编辑态
  ea.onSceneChangeHook = {
    appStateKeys: ["selectedElementIds"],
    trackElements: false,
    triggerWhenInvisible: false,
    callback: (elements, appState, files, view, hookEA) => {
      if (view && view !== ea.targetView) {
        ea.setView(view);
        ea.clear();
      }
      const sel = ea.getViewSelectedElements();
      const hit = sel.find((e) => e.customData?.excaliTable);
      if (hit) {
        const meta = hit.customData.excaliTable;
        const gid = hit.groupIds?.[0];
        editIds = gid
          ? ea.getViewElements().filter((e) => e.groupIds.includes(gid)).map((e) => e.id)
          : [hit.id];
        if (meta.src && meta.src !== state.src) {
          state.src = meta.src;
          state.style = { ...DEFAULTS, ...(meta.style || {}) };
          renderAll();
        }
      } else if (editIds.length) {
        editIds = [];
        renderAll();
      }
    },
  };

  tab.open();
}

main();

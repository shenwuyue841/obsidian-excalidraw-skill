/*

# 表格生成器 / Table builder

在 Excalidraw 画布上生成一个 `行 × 列` 的网格，每格一个矩形 + 一个居中文字。

用法：把本文件放到 `Excalidraw/Scripts`，重启 Obsidian，在画布中打开命令面板 →
「表格生成器 / Table builder」，按提示输入行数与列数。

说明：Excalidraw 没有原生表格元素，本脚本用「矩形网格 + 文字」模拟。
生成后每个单元格仍是独立元素，可以单独改文字、改颜色、合并视觉上的边界。

```javascript
*/
const rowsIn = await utils.inputPrompt({ header: "行数（不含表头）", value: "3" });
const colsIn = await utils.inputPrompt({ header: "列数", value: "4" });

const rows = Math.max(0, parseInt(rowsIn) || 0);
const cols = Math.max(0, parseInt(colsIn) || 0);
if (!rows || !cols) return;

const CW = 200; // 列宽
const RH = 56; // 行高

ea.style.strokeColor = "#1e1e1e";
ea.style.backgroundColor = "transparent";
ea.style.strokeWidth = 1;
ea.style.strokeStyle = "solid";
ea.style.roughness = 0;
ea.style.fontFamily = 6;
ea.style.fontSize = 16;

for (let r = 0; r <= rows; r++) {
  for (let c = 0; c < cols; c++) {
    const x = c * CW;
    const y = r * RH;
    ea.addRect(x, y, CW, RH);
    ea.addText(x + 8, y + RH / 2 - 10, r === 0 ? `标题 ${c + 1}` : `单元格 ${r}-${c + 1}`, {
      width: CW - 16,
      height: 20,
      textAlign: "center",
      autoResize: false,
    });
  }
}

await ea.addElementsToView(false, false);

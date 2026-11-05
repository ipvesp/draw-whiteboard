import type { BoardElement } from "@collab/shared";
import { penDrawOptions, strokeDisplayColor } from "@collab/shared";
import { renderBoard } from "./draw";

const MAX_EXPORT_PX = 8192;

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** SVG öznitelik değerleri (stroke/fill vb.) — tırnak ve açı parantez kaçışı */
function escapeSvgAttr(s: string): string {
  return escapeXml(s).replace(/\r|\n|\t/g, " ");
}

function numAttr(n: number, fallback = 0): string {
  if (!Number.isFinite(n)) return String(fallback);
  const x = Math.round(n);
  if (Math.abs(x) > 1e9) return String(fallback);
  return String(x);
}

export function exportBoardPng(
  elements: BoardElement[],
  boardBg: string,
  padding = 40
): void {
  const canvas = document.createElement("canvas");
  let minX = 0,
    minY = 0,
    maxX = 800,
    maxY = 600;
  for (const el of elements) {
    if (el.type === "stroke") {
      for (const p of el.points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
    } else if ("x" in el) {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + (el.width ?? 100));
      maxY = Math.max(maxY, el.y + (el.height ?? 100));
    }
  }
  let w = Math.ceil(maxX - minX + padding * 2);
  let h = Math.ceil(maxY - minY + padding * 2);
  if (w < 1 || h < 1) {
    w = 800;
    h = 600;
  }
  let scale = 1;
  if (w > MAX_EXPORT_PX || h > MAX_EXPORT_PX) {
    scale = Math.min(MAX_EXPORT_PX / w, MAX_EXPORT_PX / h);
  }
  canvas.width = Math.max(1, Math.floor(w * scale));
  canvas.height = Math.max(1, Math.floor(h * scale));
  const ctx = canvas.getContext("2d")!;
  if (scale !== 1) ctx.scale(scale, scale);
  const shifted = elements.map((el) => {
    if (el.type === "stroke") {
      return {
        ...el,
        points: el.points.map((p) => ({
          x: p.x - minX + padding,
          y: p.y - minY + padding,
        })),
      };
    }
    if ("x" in el) {
      return { ...el, x: el.x - minX + padding, y: el.y - minY + padding };
    }
    return el;
  });
  renderBoard(ctx, w, h, { x: 0, y: 0 }, 1, shifted, [], null, boardBg);
  const a = document.createElement("a");
  a.download = `board-${Date.now()}.png`;
  a.href = canvas.toDataURL("image/png");
  a.click();
}

function boundsOf(elements: BoardElement[], padding: number) {
  let minX = 0,
    minY = 0,
    maxX = 800,
    maxY = 600;
  for (const el of elements) {
    if (el.type === "stroke") {
      for (const p of el.points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
    } else if ("x" in el) {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + (el.width ?? 100));
      maxY = Math.max(maxY, el.y + (el.height ?? 100));
    }
  }
  const w = Math.ceil(maxX - minX + padding * 2);
  const h = Math.ceil(maxY - minY + padding * 2);
  return { minX, minY, w, h, padding };
}

export function exportBoardSvg(elements: BoardElement[], boardBg: string) {
  const { minX, minY, w, h, padding } = boundsOf(elements, 40);
  const ox = -minX + padding;
  const oy = -minY + padding;

  const parts: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${numAttr(w, 800)}" height="${numAttr(h, 600)}" viewBox="0 0 ${numAttr(w, 800)} ${numAttr(h, 600)}">`,
    `<rect width="100%" height="100%" fill="${escapeSvgAttr(boardBg)}"/>`,
  ];

  for (const el of elements) {
    if (el.type === "stroke" && el.points.length > 1) {
      const pts = el.points
        .map((p) => `${numAttr(p.x + ox)},${numAttr(p.y + oy)}`)
        .join(" ");
      const { opacity } = penDrawOptions(el.penKind ?? "pen");
      const opacityAttr =
        opacity < 1 && opacity > 0
          ? ` stroke-opacity="${String(opacity)}"`
          : "";
      const stroke = escapeSvgAttr(strokeDisplayColor(el, boardBg));
      parts.push(
        `<polyline fill="none" stroke="${stroke}" stroke-width="${numAttr(el.width, 2)}"${opacityAttr} stroke-linecap="round" stroke-linejoin="round" points="${pts}"/>`
      );
    } else if (el.type === "rectangle") {
      parts.push(
        `<rect x="${numAttr(el.x + ox)}" y="${numAttr(el.y + oy)}" width="${numAttr(el.width)}" height="${numAttr(el.height)}" stroke="${escapeSvgAttr(el.color)}" stroke-width="${numAttr(el.strokeWidth, 2)}" fill="${el.fill == null ? "none" : escapeSvgAttr(el.fill)}"/>`
      );
    } else if (el.type === "text") {
      parts.push(
        `<text x="${numAttr(el.x + ox)}" y="${numAttr(el.y + oy + el.fontSize)}" fill="${escapeSvgAttr(el.color)}" font-size="${numAttr(el.fontSize, 16)}">${escapeXml(el.content)}</text>`
      );
    } else if (el.type === "sticky") {
      parts.push(
        `<rect x="${numAttr(el.x + ox)}" y="${numAttr(el.y + oy)}" width="${numAttr(el.width)}" height="${numAttr(el.height)}" fill="${escapeSvgAttr(el.color)}" rx="6"/>`,
        `<text x="${numAttr(el.x + ox + 10)}" y="${numAttr(el.y + oy + 24)}" font-size="14" fill="#1c1917">${escapeXml(el.content)}</text>`
      );
    }
  }

  parts.push("</svg>");
  const blob = new Blob([parts.join("\n")], { type: "image/svg+xml" });
  const a = document.createElement("a");
  a.download = `board-${Date.now()}.svg`;
  a.href = URL.createObjectURL(blob);
  a.click();
  URL.revokeObjectURL(a.href);
}

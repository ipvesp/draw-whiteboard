import type { BoardElement, Point } from "@collab/shared";
import { penDrawOptions, strokeDisplayColor } from "@collab/shared";
import type { LiveStroke } from "../store/boardStore";
import { drawSmoothStroke } from "./stroke.js";

export function worldToScreen(p: Point, pan: Point, zoom: number): Point {
  return { x: (p.x + pan.x) * zoom, y: (p.y + pan.y) * zoom };
}

export function screenToWorld(p: Point, pan: Point, zoom: number): Point {
  return { x: p.x / zoom - pan.x, y: p.y / zoom - pan.y };
}

export function snapToGrid(p: Point, grid = 20): Point {
  return {
    x: Math.round(p.x / grid) * grid,
    y: Math.round(p.y / grid) * grid,
  };
}

export function drawElement(
  ctx: CanvasRenderingContext2D,
  el: BoardElement,
  boardBg = "#faf7f2"
) {
  switch (el.type) {
    case "stroke": {
      const opts = penDrawOptions(el.penKind ?? "pen");
      const color = strokeDisplayColor(el, boardBg);
      drawSmoothStroke(ctx, el.points, color, el.width, opts);
      break;
    }
    case "rectangle":
    case "ellipse":
    case "line":
    case "arrow": {
      ctx.strokeStyle = el.color;
      ctx.lineWidth = el.strokeWidth;
      ctx.lineCap = "round";
      if (el.fill) ctx.fillStyle = el.fill;
      const { x, y, width: w, height: h } = el;
      if (el.type === "rectangle") {
        if (el.fill) ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
      } else if (el.type === "ellipse") {
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
        if (el.fill) ctx.fill();
        ctx.stroke();
      } else if (el.type === "line") {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y + h);
        ctx.stroke();
      } else {
        const x2 = x + w;
        const y2 = y + h;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        const angle = Math.atan2(h, w);
        const head = 12 + el.strokeWidth;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }
      break;
    }
    case "text": {
      const w = el.width ?? 240;
      const h = el.height ?? el.fontSize * 3;
      ctx.fillStyle = el.color;
      ctx.font = `${el.fontSize}px "Plus Jakarta Sans", sans-serif`;
      ctx.textBaseline = "top";
      el.content.split("\n").forEach((line, i) => {
        ctx.fillText(line, el.x, el.y + i * el.fontSize * 1.25);
      });
      void w;
      void h;
      break;
    }
    case "sticky": {
      const pad = 10;
      ctx.fillStyle = el.color;
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.lineWidth = 1;
      roundRect(ctx, el.x, el.y, el.width, el.height, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#1c1917";
      ctx.font = `14px "Plus Jakarta Sans", sans-serif`;
      ctx.textBaseline = "top";
      wrapText(ctx, el.content, el.x + pad, el.y + pad, el.width - pad * 2, 18);
      break;
    }
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number
) {
  const words = text.split(/\s+/);
  let line = "";
  let cy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, cy);
      line = w;
      cy += lineH;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, cy);
}

export function drawSnapGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pan: Point,
  zoom: number,
  dark: boolean,
  gridSize = 20
) {
  const step = gridSize * zoom;
  const ox = (((pan.x * zoom) % step) + step) % step;
  const oy = (((pan.y * zoom) % step) + step) % step;
  ctx.strokeStyle = dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = ox; x <= width; x += step) {
    ctx.moveTo(Math.floor(x) + 0.5, 0);
    ctx.lineTo(Math.floor(x) + 0.5, height);
  }
  for (let y = oy; y <= height; y += step) {
    ctx.moveTo(0, Math.floor(y) + 0.5);
    ctx.lineTo(width, Math.floor(y) + 0.5);
  }
  ctx.stroke();
}

export function renderBoard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pan: Point,
  zoom: number,
  elements: BoardElement[],
  liveStrokes: LiveStroke[],
  preview: BoardElement | null,
  boardBg = "#faf7f2",
  laserDots: { x: number; y: number; color: string }[] = [],
  showGrid = false,
  darkGrid = false
) {
  ctx.save();
  ctx.fillStyle = boardBg;
  ctx.fillRect(0, 0, width, height);
  if (showGrid) drawSnapGrid(ctx, width, height, pan, zoom, darkGrid);
  ctx.translate(pan.x * zoom, pan.y * zoom);
  ctx.scale(zoom, zoom);

  const sorted = [...elements].sort(
    (a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0) || a.createdAt - b.createdAt
  );
  for (const el of sorted) drawElement(ctx, el, boardBg);
  for (const ls of liveStrokes) {
    const opts = penDrawOptions(ls.penKind ?? "pen");
    const color = strokeDisplayColor(ls, boardBg);
    drawSmoothStroke(ctx, ls.points, color, ls.width, opts);
  }
  if (preview) {
    ctx.globalAlpha = 0.85;
    drawElement(ctx, preview, boardBg);
    ctx.globalAlpha = 1;
  }
  for (const dot of laserDots) {
    ctx.fillStyle = dot.color;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function elementBounds(el: BoardElement): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (el.type === "stroke") {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of el.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return { x: minX, y: minY, width: maxX - minX || 1, height: maxY - minY || 1 };
  }
  if (el.type === "text") {
    return {
      x: el.x,
      y: el.y,
      width: el.width ?? 240,
      height: el.height ?? el.fontSize * 3,
    };
  }
  return { x: el.x, y: el.y, width: el.width, height: el.height };
}

export function hitTestElement(el: BoardElement, p: Point, tolerance = 8): boolean {
  const b = elementBounds(el);
  const x1 = Math.min(b.x, b.x + b.width) - tolerance;
  const x2 = Math.max(b.x, b.x + b.width) + tolerance;
  const y1 = Math.min(b.y, b.y + b.height) - tolerance;
  const y2 = Math.max(b.y, b.y + b.height) + tolerance;
  if (el.type === "stroke") {
    for (const pt of el.points) {
      const dx = pt.x - p.x;
      const dy = pt.y - p.y;
      if (dx * dx + dy * dy < tolerance * tolerance * 4) return true;
    }
    return false;
  }
  return p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2;
}

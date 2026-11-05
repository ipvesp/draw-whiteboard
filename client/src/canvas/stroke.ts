import type { Point } from "@collab/shared";

/** Yumuşak serbest çizgi — midpoint quadratic bezier */
export interface StrokeDrawStyle {
  opacity?: number;
  composite?: GlobalCompositeOperation;
}

export function drawSmoothStroke(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  width: number,
  style: StrokeDrawStyle = {}
) {
  if (points.length === 0) return;

  ctx.save();
  if (style.opacity != null) ctx.globalAlpha = style.opacity;
  if (style.composite) ctx.globalCompositeOperation = style.composite;

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
  }

  const last = points[points.length - 1];
  ctx.quadraticCurveTo(last.x, last.y, last.x, last.y);
  ctx.stroke();
  ctx.restore();
}

/** Canlı uzak çizim: örtüşen paketleri birleştir, tekrarlayan noktaları at */
export function appendStrokePoints(
  prev: Point[],
  incoming: Point[],
  minDist = 1.2
): Point[] {
  if (incoming.length === 0) return prev;
  if (prev.length === 0) return [...incoming];

  const minDistSq = minDist * minDist;
  let start = 0;
  if (prev.length > 0) {
    const anchor = prev[prev.length - 1];
    while (start < incoming.length - 1) {
      const dx = incoming[start].x - anchor.x;
      const dy = incoming[start].y - anchor.y;
      if (dx * dx + dy * dy < minDistSq * 4) start += 1;
      else break;
    }
  }

  const out = [...prev];
  for (let i = start; i < incoming.length; i++) {
    const p = incoming[i];
    const last = out[out.length - 1];
    const dx = p.x - last.x;
    const dy = p.y - last.y;
    if (dx * dx + dy * dy >= minDistSq) out.push(p);
  }

  const tail = incoming[incoming.length - 1];
  const last = out[out.length - 1];
  if (
    tail &&
    last &&
    (tail.x !== last.x || tail.y !== last.y) &&
    (tail.x - last.x) ** 2 + (tail.y - last.y) ** 2 >= minDistSq * 0.25
  ) {
    out.push(tail);
  }
  return out;
}

/** Çok yakın noktaları birleştir (gürültü azaltma) */
export function filterStrokePoints(
  points: Point[],
  minDist = 1.5
): Point[] {
  if (points.length <= 2) return points;
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = out[out.length - 1];
    const dx = points[i].x - prev.x;
    const dy = points[i].y - prev.y;
    if (dx * dx + dy * dy >= minDist * minDist) {
      out.push(points[i]);
    }
  }
  const tail = points[points.length - 1];
  const last = out[out.length - 1];
  if (last.x !== tail.x || last.y !== tail.y) out.push(tail);
  return out;
}

import type { BoardElement, Point, Tool } from "@collab/shared";
import { PEN_KINDS } from "@collab/shared";

export const MAX_WS_BYTES = 256_000;
/** Tek canlı çizim mesajındaki nokta üst sınırı (DoS koruması) */
export const MAX_POINTS_PER_MSG = 512;
export const MAX_STROKE_POINTS = 12_000;
export const MAX_CONTENT_LEN = 8_000;
export const MAX_PATCH_KEYS = 24;
export const MAX_USER_NAME_LEN = 24;
export const MAX_COORD_ABS = 5_000_000;
export const MAX_DIM_ABS = 50_000;
export const MAX_LASER_POINTS = 24;
export const MAX_SYNC_BATCH = 2_500;
/** lastSeq sunucu seq'sinden bu kadar ilerideyse boş batch (DoS) */
export const MAX_SYNC_SEQ_GAP = 500_000;

const FINITE = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n);

const PEN_KIND_SET = new Set<string>(Object.keys(PEN_KINDS));

const TOOL_SET = new Set<Tool>([
  "select",
  "hand",
  "pen",
  "eraser",
  "rectangle",
  "ellipse",
  "line",
  "arrow",
  "text",
  "sticky",
  "laser",
]);

/** Renk alanında XSS / injection riskini azaltır (CSS alt kümesi) */
const BAD_COLOR_CHARS = /[<>'"\n\r;\\{}()]/g;

const SHAPE_TYPES = new Set<string>([
  "rectangle",
  "ellipse",
  "line",
  "arrow",
]);
type ShapeCommitType = "rectangle" | "ellipse" | "line" | "arrow";

function finitePoints(points: Point[]): Point[] {
  return points
    .filter((p) => FINITE(p.x) && FINITE(p.y))
    .map((p) => ({ x: p.x, y: p.y }));
}

export function sanitizeUserName(raw: string): string {
  const s = String(raw)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, MAX_USER_NAME_LEN);
  return s || "Guest";
}

export function sanitizeCssColor(input: unknown, fallback = "#111827"): string {
  if (typeof input !== "string") return fallback;
  const s = input.replace(BAD_COLOR_CHARS, "").trim().slice(0, 48);
  if (!s) return fallback;
  return s;
}

export function sanitizeStrokeWidth(w: unknown, fallback = 3): number {
  if (!FINITE(w)) return fallback;
  return Math.min(96, Math.max(0.25, w));
}

export function sanitizePenKind(
  k: unknown
): keyof typeof PEN_KINDS | undefined {
  if (typeof k !== "string") return undefined;
  return PEN_KIND_SET.has(k) ? (k as keyof typeof PEN_KINDS) : undefined;
}

export function sanitizeTool(t: unknown): Tool | null {
  if (typeof t !== "string") return null;
  return TOOL_SET.has(t as Tool) ? (t as Tool) : null;
}

export function clampCoord(n: unknown): number {
  if (!FINITE(n)) return 0;
  return Math.max(-MAX_COORD_ABS, Math.min(MAX_COORD_ABS, n));
}

export function clampDim(n: unknown, min: number, max: number, fb: number): number {
  if (!FINITE(n)) return fb;
  return Math.min(max, Math.max(min, n));
}

export function sanitizeElementId(id: unknown): string | null {
  if (typeof id !== "string" || id.length === 0 || id.length > 120) return null;
  if (!/^[\w-]+$/.test(id)) return null;
  return id;
}

export function sanitizeSyncLastSeq(seq: unknown, serverSeq: number): number {
  if (!FINITE(seq)) return 0;
  const n = Math.floor(seq);
  if (n < 0) return 0;
  if (n > serverSeq + MAX_SYNC_SEQ_GAP) return serverSeq + 1;
  return n;
}

/** stroke.points — yalnızca bir paket; aşırı büyük mesajları kısalt */
export function sanitizeIncrementalStrokePoints(points: Point[]): Point[] {
  const cleaned = finitePoints(points).map((p) => ({
    x: clampCoord(p.x),
    y: clampCoord(p.y),
  }));
  if (cleaned.length <= MAX_POINTS_PER_MSG) return cleaned;
  return cleaned.slice(-MAX_POINTS_PER_MSG);
}

/** stroke.end ve tam çizgi yamaları — tüm noktaları koru (üst sınır MAX_STROKE_POINTS) */
export function sanitizeCommitStrokePoints(points: Point[]): Point[] {
  return finitePoints(points)
    .map((p) => ({ x: clampCoord(p.x), y: clampCoord(p.y) }))
    .slice(0, MAX_STROKE_POINTS);
}

export function sanitizeContent(s: string): string {
  return String(s).slice(0, MAX_CONTENT_LEN);
}

export function sanitizeLaserPoints(points: Point[]): Point[] {
  const cleaned = finitePoints(points).map((p) => ({
    x: clampCoord(p.x),
    y: clampCoord(p.y),
  }));
  if (cleaned.length <= MAX_LASER_POINTS) return cleaned;
  return cleaned.slice(-MAX_LASER_POINTS);
}

const ALLOWED_PATCH_KEYS = new Set([
  "x",
  "y",
  "width",
  "height",
  "points",
  "color",
  "strokeWidth",
  "fill",
  "content",
  "fontSize",
  "zIndex",
  "updatedAt",
  "penKind",
  "eraser",
]);

export function sanitizeElementPatch(
  existing: BoardElement,
  patch: Partial<BoardElement>
): Partial<BoardElement> | null {
  const keys = Object.keys(patch);
  if (keys.length > MAX_PATCH_KEYS) return null;

  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (!ALLOWED_PATCH_KEYS.has(key)) continue;
    const v = (patch as Record<string, unknown>)[key];
    if (v === undefined) continue;

    switch (key) {
      case "x":
      case "y":
        if (!FINITE(v)) return null;
        out[key] = clampCoord(v);
        break;
      case "width":
      case "height":
        if (!FINITE(v)) return null;
        out[key] = clampDim(v, 1, MAX_DIM_ABS, 100);
        break;
      case "strokeWidth":
      case "fontSize":
        if (!FINITE(v)) return null;
        out[key] =
          key === "fontSize"
            ? clampDim(v, 6, 240, 16)
            : clampDim(v, 0.25, 96, 2);
        break;
      case "zIndex":
        if (!FINITE(v)) return null;
        out[key] = clampDim(v, 0, 50_000_000, 0);
        break;
      case "color":
      case "fill":
        if (typeof v !== "string") return null;
        out[key] = key === "fill" && v === "none" ? "none" : sanitizeCssColor(v);
        break;
      case "content":
        if (typeof v !== "string") return null;
        out[key] = sanitizeContent(v);
        break;
      case "points":
        if (!Array.isArray(v)) return null;
        out[key] = sanitizeCommitStrokePoints(v as Point[]);
        break;
      case "penKind": {
        const pk = sanitizePenKind(v);
        if (pk) out[key] = pk;
        break;
      }
      case "eraser":
        out[key] = !!v;
        break;
      default:
        break;
    }
  }

  if (existing.type === "stroke" && "type" in patch && patch.type !== "stroke") {
    return null;
  }

  return out as Partial<BoardElement>;
}

export function requireTempId(id: string): boolean {
  return id.startsWith("temp_") && id.length <= 48;
}

export interface SanitizedStrokeStyle {
  color: string;
  width: number;
  penKind?: keyof typeof PEN_KINDS;
  eraser: boolean;
}

export function sanitizeStrokeStyle(
  color: unknown,
  width: unknown,
  penKind: unknown,
  eraser: unknown
): SanitizedStrokeStyle {
  const er = !!eraser;
  return {
    color: sanitizeCssColor(color),
    width: sanitizeStrokeWidth(width),
    penKind: er ? undefined : sanitizePenKind(penKind),
    eraser: er,
  };
}

export function sanitizeShapeCommit(msg: {
  shapeType: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
  fill: string | null;
}): {
  shapeType: ShapeCommitType;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
  fill: string | null;
} | null {
  if (!SHAPE_TYPES.has(msg.shapeType)) return null;
  const w = clampDim(msg.width, 1, MAX_DIM_ABS, 1);
  const h = clampDim(msg.height, 1, MAX_DIM_ABS, 1);
  return {
    shapeType: msg.shapeType as ShapeCommitType,
    x: clampCoord(msg.x),
    y: clampCoord(msg.y),
    width: w,
    height: h,
    color: sanitizeCssColor(msg.color),
    strokeWidth: clampDim(msg.strokeWidth, 0.25, 96, 2),
    fill:
      msg.fill == null
        ? null
        : msg.fill === "none"
          ? "none"
          : sanitizeCssColor(msg.fill, "none"),
  };
}

export function sanitizeTextCommit(msg: {
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  color: string;
  fontSize: number;
}): {
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  color: string;
  fontSize: number;
} {
  return {
    x: clampCoord(msg.x),
    y: clampCoord(msg.y),
    width: clampDim(msg.width, 8, MAX_DIM_ABS, 120),
    height: clampDim(msg.height, 8, MAX_DIM_ABS, 40),
    content: sanitizeContent(msg.content),
    color: sanitizeCssColor(msg.color),
    fontSize: clampDim(msg.fontSize, 6, 240, 16),
  };
}

export function sanitizeStickyCommit(msg: {
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  color: string;
}): {
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  color: string;
} {
  return {
    x: clampCoord(msg.x),
    y: clampCoord(msg.y),
    width: clampDim(msg.width, 24, MAX_DIM_ABS, 200),
    height: clampDim(msg.height, 24, MAX_DIM_ABS, 200),
    content: sanitizeContent(msg.content),
    color: sanitizeCssColor(msg.color, "#fef08a"),
  };
}

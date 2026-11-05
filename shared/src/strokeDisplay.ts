/** Tuval arka plan renkleri — eski silgi vuruşlarını tanımak için */
const CANVAS_BG_COLORS = new Set(["#000000", "#faf7f2"]);

export const ERASER_STROKE_WIDTH = 28;

export function isEraserStroke(stroke: {
  eraser?: boolean;
  color: string;
  width: number;
}): boolean {
  if (stroke.eraser) return true;
  return (
    stroke.width >= 26 &&
    CANVAS_BG_COLORS.has(stroke.color.toLowerCase())
  );
}

/** Silgi her zaman güncel tuval rengine boyanır */
export function strokeDisplayColor(
  stroke: { eraser?: boolean; color: string; width: number },
  boardBg: string
): string {
  return isEraserStroke(stroke) ? boardBg : stroke.color;
}

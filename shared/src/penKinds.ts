/** Kalem / fırça çeşitleri — çizgi görünümü ve kalınlık çarpanı */
export type PenKind = "pen" | "marker" | "highlighter" | "brush" | "pencil";

export interface PenKindConfig {
  label: string;
  widthScale: number;
  opacity: number;
  composite?: "source-over" | "multiply" | "screen";
  /** Seçildiğinde önerilen varsayılan kalınlık (style dock) */
  defaultWidth: number;
}

export const PEN_KINDS: Record<PenKind, PenKindConfig> = {
  pen: {
    label: "Kalem",
    widthScale: 1,
    opacity: 1,
    defaultWidth: 3,
  },
  marker: {
    label: "Keçeli kalem",
    widthScale: 1.35,
    opacity: 0.92,
    defaultWidth: 6,
  },
  highlighter: {
    label: "Fosforlu kalem",
    widthScale: 2.8,
    opacity: 0.38,
    composite: "multiply",
    defaultWidth: 12,
  },
  brush: {
    label: "Fırça",
    widthScale: 2,
    opacity: 0.72,
    defaultWidth: 10,
  },
  pencil: {
    label: "Kurşun kalem",
    widthScale: 0.75,
    opacity: 0.55,
    defaultWidth: 2,
  },
};

export const PEN_KIND_LIST: PenKind[] = [
  "pen",
  "marker",
  "highlighter",
  "brush",
  "pencil",
];

export interface ResolvedPenStroke {
  penKind: PenKind;
  color: string;
  width: number;
  opacity: number;
  composite?: "source-over" | "multiply" | "screen";
  eraser?: boolean;
}

export function resolvePenStroke(
  penKind: PenKind,
  color: string,
  baseWidth: number,
  pressure = 1
): ResolvedPenStroke {
  const cfg = PEN_KINDS[penKind];
  return {
    penKind,
    color,
    width: Math.max(1, baseWidth * cfg.widthScale * pressure),
    opacity: cfg.opacity,
    composite: cfg.composite,
  };
}

export function penDrawOptions(penKind: PenKind = "pen"): {
  opacity: number;
  composite?: "source-over" | "multiply" | "screen";
} {
  const cfg = PEN_KINDS[penKind];
  return { opacity: cfg.opacity, composite: cfg.composite };
}

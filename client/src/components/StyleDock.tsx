import clsx from "clsx";
import { PaintBucket, Grid3x3 } from "lucide-react";
import { PEN_KINDS } from "@collab/shared";
import { useBoardStore } from "../store/boardStore";
import { useThemeStore } from "../store/themeStore";
import {
  chromeColorRing,
  chromeDivider,
  chromePanel,
  chromeWidthButton,
} from "../lib/chromeStyles";

const COLORS = [
  "#1c1917",
  "#fafafa",
  "#78716c",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0d9488",
  "#2563eb",
  "#7c3aed",
  "#db2777",
];

const WIDTHS = [2, 4, 8, 16];

export function StyleDock() {
  const darkCanvas = useThemeStore((s) => s.darkCanvas);
  const color = useBoardStore((s) => s.color);
  const setColor = useBoardStore((s) => s.setColor);
  const strokeWidth = useBoardStore((s) => s.strokeWidth);
  const setStrokeWidth = useBoardStore((s) => s.setStrokeWidth);
  const fillEnabled = useBoardStore((s) => s.fillEnabled);
  const setFillEnabled = useBoardStore((s) => s.setFillEnabled);
  const snapToGrid = useBoardStore((s) => s.snapToGrid);
  const setSnapToGrid = useBoardStore((s) => s.setSnapToGrid);
  const tool = useBoardStore((s) => s.tool);
  const penKind = useBoardStore((s) => s.penKind);

  const penLabel =
    tool === "pen" ? PEN_KINDS[penKind].label : null;

  return (
    <div
      className={`flex max-w-[calc(100vw-2rem)] flex-wrap items-center justify-center gap-3 px-4 py-2.5 ${chromePanel(darkCanvas)}`}
    >
      {penLabel ? (
        <span
          className={`hidden text-xs font-semibold sm:inline ${darkCanvas ? "text-zinc-400" : "text-stone-500"}`}
        >
          {penLabel}
        </span>
      ) : null}
      <div className="flex items-center gap-1.5">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => setColor(c)}
            className={clsx(
              "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
              chromeColorRing(darkCanvas, color === c)
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <span className={`hidden h-6 w-px sm:block ${chromeDivider(darkCanvas)}`} />

      <div className="flex items-center gap-1">
        {WIDTHS.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setStrokeWidth(w)}
            className={chromeWidthButton(darkCanvas, strokeWidth === w)}
          >
            {w}
          </button>
        ))}
      </div>

      <button
        type="button"
        title="Dolgu"
        onClick={() => setFillEnabled(!fillEnabled)}
        className={chromeWidthButton(darkCanvas, fillEnabled)}
      >
        <PaintBucket size={16} />
      </button>

      <button
        type="button"
        title="Izgara göster ve köşelere yapış (kalem serbest)"
        onClick={() => setSnapToGrid(!snapToGrid)}
        className={chromeWidthButton(darkCanvas, snapToGrid)}
      >
        <Grid3x3 size={16} />
      </button>
    </div>
  );
}

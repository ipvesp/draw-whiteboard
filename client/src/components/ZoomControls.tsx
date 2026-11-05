import { Minus, Plus, Maximize2, Hand } from "lucide-react";
import { useViewportStore } from "../store/viewportStore";
import { useBoardStore } from "../store/boardStore";
import { useThemeStore } from "../store/themeStore";
import { chromePanel } from "../lib/chromeStyles";

export function ZoomControls() {
  const darkCanvas = useThemeStore((s) => s.darkCanvas);
  const zoom = useViewportStore((s) => s.zoom);
  const zoomBy = useViewportStore((s) => s.zoomBy);
  const resetView = useViewportStore((s) => s.resetView);
  const setTool = useBoardStore((s) => s.setTool);

  return (
    <div
      className={`pointer-events-auto absolute bottom-5 right-4 z-20 flex flex-col gap-1 p-1.5 ${chromePanel(darkCanvas)}`}
    >
      <button
        type="button"
        title="El (H)"
        onClick={() => setTool("hand")}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
      >
        <Hand size={18} />
      </button>
      <button
        type="button"
        onClick={() => zoomBy(1.15)}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100"
        title="Yakınlaştır"
      >
        <Plus size={18} />
      </button>
      <span className="text-center text-xs font-medium text-zinc-500">
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        onClick={() => zoomBy(0.87)}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100"
        title="Uzaklaştır"
      >
        <Minus size={18} />
      </button>
      <button
        type="button"
        onClick={resetView}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100"
        title="Sığdır"
      >
        <Maximize2 size={16} />
      </button>
    </div>
  );
}

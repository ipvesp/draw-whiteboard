import { useEffect, useRef } from "react";
import { useBoardStore } from "../store/boardStore";
import { useViewportStore } from "../store/viewportStore";
import { useThemeStore } from "../store/themeStore";
import { chromePanel } from "../lib/chromeStyles";
import { renderBoard } from "../canvas/draw";

export function Minimap() {
  const darkCanvas = useThemeStore((s) => s.darkCanvas);
  const boardBg = useThemeStore((s) => s.boardBg);
  const elementCount = useBoardStore((s) => s.elements.size);
  const pan = useViewportStore((s) => s.pan);
  const zoom = useViewportStore((s) => s.zoom);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const paint = () => {
      rafRef.current = 0;
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const list = Array.from(useBoardStore.getState().elements.values());
      renderBoard(ctx, 120, 80, { x: 20, y: 10 }, 0.08, list, [], null, boardBg());
    };

    const schedule = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(paint);
    };

    schedule();
    const unsub = useBoardStore.subscribe((state, prev) => {
      if (state.elements !== prev.elements) schedule();
    });
    return () => {
      unsub();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [elementCount, boardBg]);

  return (
    <div
      className={`pointer-events-auto absolute bottom-5 left-24 z-20 hidden overflow-hidden sm:block ${chromePanel(darkCanvas)}`}
    >
      <canvas ref={canvasRef} width={120} height={80} className="block" />
      <p className="px-2 py-1 text-[10px] text-zinc-500">
        Pan {Math.round(pan.x)},{Math.round(pan.y)} · {Math.round(zoom * 100)}%
      </p>
    </div>
  );
}

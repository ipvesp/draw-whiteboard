import type { BoardElement } from "@collab/shared";
import { elementBounds, worldToScreen } from "../canvas/draw";
import { useViewportStore } from "../store/viewportStore";

export function TransformOverlay({ element }: { element: BoardElement }) {
  const pan = useViewportStore((s) => s.pan);
  const zoom = useViewportStore((s) => s.zoom);
  const b = elementBounds(element);
  const tl = worldToScreen({ x: b.x, y: b.y }, pan, zoom);
  const br = worldToScreen({ x: b.x + b.width, y: b.y + b.height }, pan, zoom);

  return (
    <div
      className="pointer-events-none absolute z-[15] rounded border-2 border-brand"
      style={{
        left: tl.x,
        top: tl.y,
        width: br.x - tl.x,
        height: br.y - tl.y,
      }}
    ></div>
  );
}

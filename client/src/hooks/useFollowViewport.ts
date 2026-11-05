import { useEffect } from "react";
import { useBoardStore } from "../store/boardStore";
import { useUiStore } from "../store/uiStore";
import { useViewportStore } from "../store/viewportStore";

/** Faz 3: seçilen katılımcının imlecini tuval merkezinde tutar */
export function useFollowViewport(enabled: boolean) {
  const followUserId = useUiStore((s) => s.followUserId);
  const setPan = useViewportStore((s) => s.setPan);
  const zoom = useViewportStore((s) => s.zoom);

  useEffect(() => {
    if (!enabled || !followUserId) return;

    let raf = 0;
    const tick = () => {
      const user = useBoardStore.getState().users.get(followUserId);
      if (user?.cursor) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        setPan({
          x: w / (2 * zoom) - user.cursor.x,
          y: h / (2 * zoom) - user.cursor.y,
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, followUserId, setPan, zoom]);
}

import { memo, useEffect, useMemo, useRef } from "react";
import { useBoardStore } from "../store/boardStore";
import { useViewportStore } from "../store/viewportStore";

const LERP = 0.42;
const SNAP_DIST_SQ = 120 * 120;

const SmoothRemoteCursor = memo(function SmoothRemoteCursor({
  userId,
  name,
  color,
}: {
  userId: string;
  name: string;
  color: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const display = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let alive = true;
    let raf = 0;

    const tick = () => {
      if (!alive) return;
      const el = rootRef.current;
      const u = useBoardStore.getState().users.get(userId);
      if (!u) {
        return;
      }
      if (!el || !u.cursor) {
        raf = requestAnimationFrame(tick);
        return;
      }

      const pan = useViewportStore.getState().pan;
      const zoom = useViewportStore.getState().zoom;
      const t = u.cursor;
      let d = display.current;
      if (!d) {
        d = { x: t.x, y: t.y };
        display.current = d;
      } else {
        const dx = t.x - d.x;
        const dy = t.y - d.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > SNAP_DIST_SQ) {
          d.x = t.x;
          d.y = t.y;
        } else if (distSq < 0.04) {
          d.x = t.x;
          d.y = t.y;
        } else {
          d.x += dx * LERP;
          d.y += dy * LERP;
        }
      }
      const sx = (d.x + pan.x) * zoom;
      const sy = (d.y + pan.y) * zoom;
      el.style.transform = `translate3d(${sx}px, ${sy}px, 0)`;
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [userId]);

  return (
    <div
      ref={rootRef}
      className="absolute left-0 top-0 will-change-transform"
      style={{ transform: "translate3d(0,0,0)" }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill={color}
        className="drop-shadow-lg"
      >
        <path d="M5.5 3.5L18 12 10 13.5 8 21 5.5 3.5Z" />
      </svg>
      <span
        className="ml-3 -mt-1 inline-block rounded-md px-2 py-0.5 text-xs font-medium text-white shadow-tool"
        style={{ backgroundColor: color }}
      >
        {name}
      </span>
    </div>
  );
});

export const CursorsOverlay = memo(function CursorsOverlay() {
  const selfId = useBoardStore((s) => s.userId);
  const users = useBoardStore((s) => s.users);
  /** Yeni dizi her render'da useSyncExternalStore ile uyumsuz — Map + userId ile useMemo */
  const remoteWithCursor = useMemo(() => {
    const out: { id: string; name: string; color: string }[] = [];
    for (const u of users.values()) {
      if (selfId != null && u.id === selfId) continue;
      if (u.cursor) {
        out.push({ id: u.id, name: u.name, color: u.color });
      }
    }
    return out;
  }, [users, selfId]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {remoteWithCursor.map((u) => (
        <SmoothRemoteCursor key={u.id} userId={u.id} name={u.name} color={u.color} />
      ))}
    </div>
  );
});

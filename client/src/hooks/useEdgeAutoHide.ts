import { useCallback, useEffect, useRef, useState } from "react";

const HIDE_DELAY_MS = 5000;
const EDGE_PX = 44;

type Edge = "left" | "bottom";

interface Options {
  edge: Edge;
  enabled?: boolean;
  locked?: boolean;
  hideDelayMs?: number;
  edgePx?: number;
}

export function useEdgeAutoHide({
  edge,
  enabled = true,
  locked = false,
  hideDelayMs = HIDE_DELAY_MS,
  edgePx = EDGE_PX,
}: Options) {
  const [visible, setVisible] = useState(true);
  const hoveredRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = undefined;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      if (!hoveredRef.current && !locked) {
        setVisible(false);
      }
    }, hideDelayMs);
  }, [clearHideTimer, hideDelayMs, locked]);

  /** Tahtaya her girişte önceki oturumdan kalan gizli durumu sıfırla */
  useEffect(() => {
    if (!enabled) {
      clearHideTimer();
      return;
    }
    hoveredRef.current = false;
    setVisible(true);
    clearHideTimer();
  }, [enabled, clearHideTimer]);

  const isInEdge = useCallback(
    (clientX: number, clientY: number) => {
      if (edge === "left") return clientX <= edgePx;
      return clientY >= window.innerHeight - edgePx;
    },
    [edge, edgePx]
  );

  useEffect(() => {
    if (!enabled) return;

    const onMove = (e: MouseEvent) => {
      if (locked) {
        setVisible(true);
        clearHideTimer();
        return;
      }
      if (isInEdge(e.clientX, e.clientY)) {
        setVisible(true);
        clearHideTimer();
        return;
      }
      if (!hoveredRef.current) {
        scheduleHide();
      }
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    scheduleHide();

    return () => {
      window.removeEventListener("mousemove", onMove);
      clearHideTimer();
    };
  }, [enabled, locked, isInEdge, scheduleHide, clearHideTimer]);

  useEffect(() => {
    if (locked) {
      setVisible(true);
      clearHideTimer();
    }
  }, [locked, clearHideTimer]);

  const onMouseEnter = useCallback(() => {
    hoveredRef.current = true;
    setVisible(true);
    clearHideTimer();
  }, [clearHideTimer]);

  const onMouseLeave = useCallback(() => {
    hoveredRef.current = false;
    if (!locked) scheduleHide();
  }, [locked, scheduleHide]);

  return { visible, onMouseEnter, onMouseLeave };
}

import { useCallback, useEffect, useRef } from "react";
import clsx from "clsx";
import type { Point, PenKind } from "@collab/shared";
import type { ClientMessage } from "@collab/shared";
import { ERASER_STROKE_WIDTH, resolvePenStroke } from "@collab/shared";
import { hitTestElement, renderBoard, screenToWorld, snapToGrid } from "../canvas/draw";
import { filterStrokePoints } from "../canvas/stroke";
import { useBoardStore } from "../store/boardStore";
import { useThemeStore } from "../store/themeStore";
import { useUiStore } from "../store/uiStore";
import { useViewportStore } from "../store/viewportStore";
import { CursorsOverlay } from "./CursorsOverlay";
import { TransformOverlay } from "./TransformOverlay";
import { TextEditor } from "./TextEditor";
import type { BoardElement } from "@collab/shared";

interface WhiteboardProps {
  send: (msg: ClientMessage) => void;
}

function tempId() {
  return `temp_${crypto.randomUUID().slice(0, 8)}`;
}

export function Whiteboard({ send }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<BoardElement | null>(null);
  const drawingRef = useRef<{
    strokeId: string;
    points: Point[];
    color: string;
    width: number;
    penKind?: PenKind;
    eraser?: boolean;
    sentIndex: number;
  } | null>(null);
  const shapeStartRef = useRef<Point | null>(null);
  const panningRef = useRef<{ start: Point; panStart: Point } | null>(null);
  const dragRef = useRef<{
    ids: string[];
    start: Point;
    origins: Map<string, BoardElement>;
  } | null>(null);
  const lastCursorSent = useRef(0);
  const lastStrokeSent = useRef(0);
  const rafRef = useRef<number>(0);
  const paintScheduled = useRef(false);
  const localLiveStroke = useRef<{
    strokeId: string;
    userId: string;
    points: Point[];
    color: string;
    width: number;
    penKind?: PenKind;
    eraser?: boolean;
  } | null>(null);

  const tool = useBoardStore((s) => s.tool);
  const penKind = useBoardStore((s) => s.penKind);
  const color = useBoardStore((s) => s.color);
  const strokeWidth = useBoardStore((s) => s.strokeWidth);
  const fillEnabled = useBoardStore((s) => s.fillEnabled);
  const snapToGridEnabled = useBoardStore((s) => s.snapToGrid);
  const elements = useBoardStore((s) => s.elements);
  const userId = useBoardStore((s) => s.userId);
  const selectedId = useBoardStore((s) => s.selectedId);
  const setSelectedId = useBoardStore((s) => s.setSelectedId);
  const toggleSelect = useBoardStore((s) => s.toggleSelect);
  const updateElements = useBoardStore((s) => s.updateElements);

  const darkCanvas = useThemeStore((s) => s.darkCanvas);
  const boardBg = useThemeStore((s) => s.boardBg);
  const viewOnly = useUiStore((s) => s.viewOnly);
  const spaceHeld = useUiStore((s) => s.spaceHeld);
  const openTextEditor = useUiStore((s) => s.openTextEditor);
  const pan = useViewportStore((s) => s.pan);
  const zoom = useViewportStore((s) => s.zoom);
  const setPan = useViewportStore((s) => s.setPan);
  const zoomBy = useViewportStore((s) => s.zoomBy);

  const shouldSnapPoint = useCallback(() => {
    if (!snapToGridEnabled) return false;
    return (
      tool !== "pen" &&
      tool !== "eraser" &&
      tool !== "laser" &&
      tool !== "hand"
    );
  }, [snapToGridEnabled, tool]);

  const getWorldPoint = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = canvasRef.current!.getBoundingClientRect();
      let p = screenToWorld(
        { x: clientX - rect.left, y: clientY - rect.top },
        pan,
        zoom
      );
      if (shouldSnapPoint()) p = snapToGrid(p);
      return p;
    },
    [pan, zoom, shouldSnapPoint]
  );

  /** Fare/touch: pressure API 0.5 döner — çizim ince, bırakınca kalın görünmesin diye yalnızca kalem basıncını kullan */
  const pointerPressure = (e: React.PointerEvent) => {
    if (e.pointerType === "pen" && e.pressure > 0) {
      return Math.min(1, Math.max(0.15, e.pressure));
    }
    return 1;
  };

  const strokeStyle = useCallback(
    (pressure = 1) => {
      if (tool === "eraser") {
        return {
          color: boardBg(),
          width: ERASER_STROKE_WIDTH,
          penKind: undefined,
          eraser: true,
        };
      }
      if (tool === "pen") {
        return resolvePenStroke(penKind, color, strokeWidth, pressure);
      }
      return {
        color,
        width: Math.max(1, strokeWidth * pressure),
        penKind: "pen" as PenKind,
        eraser: false,
      };
    },
    [tool, penKind, color, strokeWidth, boardBg]
  );

  const isPanMode = (e: React.PointerEvent) =>
    tool === "hand" ||
    spaceHeld ||
    e.button === 1 ||
    (e.button === 0 && e.altKey);

  const schedulePaint = useCallback(() => {
    if (paintScheduled.current) return;
    paintScheduled.current = true;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      paintScheduled.current = false;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const { elements: els, liveStrokes: remote, snapToGrid: gridOn } =
        useBoardStore.getState();
      const { laserPoints: lasers } = useUiStore.getState();
      const list = Array.from(els.values());
      const live = Array.from(remote.values());
      if (localLiveStroke.current) live.push(localLiveStroke.current);
      renderBoard(
        ctx,
        canvas.clientWidth,
        canvas.clientHeight,
        useViewportStore.getState().pan,
        useViewportStore.getState().zoom,
        list,
        live,
        previewRef.current,
        boardBg(),
        lasers,
        gridOn,
        darkCanvas
      );
    });
  }, [boardBg, darkCanvas]);

  useEffect(() => {
    const resize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
      schedulePaint();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [schedulePaint]);

  useEffect(() => {
    const unsubBoard = useBoardStore.subscribe((state, prev) => {
      if (
        state.elements !== prev.elements ||
        state.liveStrokes !== prev.liveStrokes ||
        state.snapToGrid !== prev.snapToGrid
      ) {
        schedulePaint();
      }
    });
    const unsubUi = useUiStore.subscribe((state, prev) => {
      if (state.laserPoints !== prev.laserPoints) schedulePaint();
    });
    const unsubVp = useViewportStore.subscribe(() => schedulePaint());
    schedulePaint();
    return () => {
      unsubBoard();
      unsubUi();
      unsubVp();
    };
  }, [schedulePaint]);

  useEffect(() => {
    schedulePaint();
  }, [darkCanvas, schedulePaint]);

  const openEditorForElement = useCallback(
    (el: BoardElement) => {
      if (el.type !== "text" && el.type !== "sticky") return;
      openTextEditor({
        elementId: el.id,
        x: el.x,
        y: el.y,
        isNew: false,
        kind: el.type,
        width: el.type === "text" ? (el.width ?? 280) : el.width,
        height: el.type === "text" ? (el.height ?? 80) : el.height,
      });
    },
    [openTextEditor]
  );

  const sendCursor = useCallback(
    (p: Point) => {
      if (viewOnly) return;
      const now = Date.now();
      if (now - lastCursorSent.current < 16) return;
      lastCursorSent.current = now;
      send({ type: "cursor.move", x: p.x, y: p.y });
    },
    [send, viewOnly]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (viewOnly) return;
    if (isPanMode(e)) {
      panningRef.current = {
        start: { x: e.clientX, y: e.clientY },
        panStart: { ...pan },
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    const p = getWorldPoint(e.clientX, e.clientY);

    if (tool === "text" || tool === "sticky") {
      const list = Array.from(elements.values()).sort(
        (a, b) => b.zIndex - a.zIndex
      );
      const hit = list.find((el) => hitTestElement(el, p));
      if (
        hit &&
        ((tool === "text" && hit.type === "text") ||
          (tool === "sticky" && hit.type === "sticky"))
      ) {
        openEditorForElement(hit);
        return;
      }
      openTextEditor({
        elementId: null,
        x: p.x,
        y: p.y,
        isNew: true,
        kind: tool,
        width: tool === "sticky" ? 200 : 280,
        height: tool === "sticky" ? 160 : 80,
      });
      return;
    }

    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    if (tool === "select") {
      const list = Array.from(elements.values()).sort(
        (a, b) => b.zIndex - a.zIndex
      );
      const hit = list.find((el) => hitTestElement(el, p));
      if (hit) {
        toggleSelect(hit.id, e.shiftKey);
        const ids = useBoardStore.getState().selectedIds;
        const origins = new Map<string, BoardElement>();
        for (const id of ids) {
          const el = elements.get(id);
          if (el) origins.set(id, structuredClone(el));
        }
        dragRef.current = {
          ids: [...ids],
          start: p,
          origins,
        };
      } else {
        setSelectedId(null);
      }
      return;
    }

    if (tool === "pen" || tool === "eraser") {
      const strokeId = tempId();
      const style = strokeStyle(pointerPressure(e));
      drawingRef.current = {
        strokeId,
        points: [p],
        color: style.color,
        width: style.width,
        penKind: style.penKind,
        eraser: style.eraser,
        sentIndex: 1,
      };
      localLiveStroke.current = {
        strokeId,
        userId: userId ?? "local",
        points: [p],
        color: style.color,
        width: style.width,
        penKind: style.penKind,
        eraser: style.eraser,
      };
      send({
        type: "stroke.start",
        tempId: strokeId,
        color: style.color,
        width: style.width,
        penKind: style.penKind,
        eraser: style.eraser,
      });
      return;
    }

    if (
      tool === "rectangle" ||
      tool === "ellipse" ||
      tool === "line" ||
      tool === "arrow"
    ) {
      shapeStartRef.current = getWorldPoint(e.clientX, e.clientY);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (panningRef.current) {
      const dx = (e.clientX - panningRef.current.start.x) / zoom;
      const dy = (e.clientY - panningRef.current.start.y) / zoom;
      setPan({
        x: panningRef.current.panStart.x + dx,
        y: panningRef.current.panStart.y + dy,
      });
      return;
    }

    const p = getWorldPoint(e.clientX, e.clientY);
    sendCursor(p);

    if (tool === "laser") {
      send({ type: "laser.move", points: [p] });
      return;
    }

    if (dragRef.current) {
      const dx = p.x - dragRef.current.start.x;
      const dy = p.y - dragRef.current.start.y;
      const patches: BoardElement[] = [];
      for (const id of dragRef.current.ids) {
        const orig = dragRef.current.origins.get(id);
        if (!orig) continue;
        if (orig.type === "stroke") {
          patches.push({
            ...orig,
            points: orig.points.map((pt) => ({
              x: pt.x + dx,
              y: pt.y + dy,
            })),
            updatedAt: Date.now(),
          });
        } else if ("x" in orig) {
          patches.push({
            ...orig,
            x: orig.x + dx,
            y: orig.y + dy,
            updatedAt: Date.now(),
          });
        }
      }
      if (patches.length) updateElements(patches);
      return;
    }

    if (drawingRef.current) {
      const last = drawingRef.current.points[drawingRef.current.points.length - 1];
      const minDist = 1.2 / zoom;
      if (last) {
        const dx = p.x - last.x;
        const dy = p.y - last.y;
        if (dx * dx + dy * dy < minDist * minDist) return;
      }
      drawingRef.current.points.push(p);
      const {
        strokeId,
        color: strokeColor,
        width: strokeW,
        penKind: strokeKind,
        eraser: strokeEraser,
      } = drawingRef.current;
      const all = drawingRef.current.points;
      localLiveStroke.current = {
        strokeId,
        userId: userId ?? "local",
        points: all,
        color: strokeColor,
        width: strokeW,
        penKind: strokeKind,
        eraser: strokeEraser,
      };
      schedulePaint();
      const now = Date.now();
      const sent = drawingRef.current.sentIndex;
      if (now - lastStrokeSent.current >= 36 && sent < all.length) {
        lastStrokeSent.current = now;
        const batch = all.slice(sent, sent + 64);
        send({
          type: "stroke.points",
          strokeId,
          points: batch,
          color: strokeColor,
          width: strokeW,
          penKind: strokeKind,
          eraser: strokeEraser,
        });
        drawingRef.current.sentIndex = sent + batch.length;
      }
      return;
    }

    if (shapeStartRef.current) {
      const s = shapeStartRef.current;
      previewRef.current = {
        id: "preview",
        type: tool as "rectangle" | "ellipse" | "line" | "arrow",
        authorId: "",
        createdAt: 0,
        updatedAt: 0,
        zIndex: 0,
        x: s.x,
        y: s.y,
        width: p.x - s.x,
        height: p.y - s.y,
        color,
        strokeWidth,
        fill: fillEnabled ? `${color}33` : null,
      };
      schedulePaint();
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    panningRef.current = null;

    if (dragRef.current) {
      for (const id of dragRef.current.ids) {
        const el = useBoardStore.getState().elements.get(id);
        if (el) send({ type: "element.update", elementId: id, patch: el });
      }
      dragRef.current = null;
      return;
    }

    if (drawingRef.current) {
      const {
        strokeId,
        color: strokeColor,
        width: strokeW,
        penKind: strokeKind,
        eraser: strokeEraser,
      } = drawingRef.current;
      const all = drawingRef.current.points;
      const sent = drawingRef.current.sentIndex;
      if (sent < all.length) {
        send({
          type: "stroke.points",
          strokeId,
          points: all.slice(sent),
          color: strokeColor,
          width: strokeW,
          penKind: strokeKind,
          eraser: strokeEraser,
        });
      }
      const points = filterStrokePoints(all, 1.2 / zoom);
      send({
        type: "stroke.end",
        strokeId,
        points,
        color: strokeColor,
        width: strokeW,
        penKind: strokeKind,
        eraser: strokeEraser,
      });
      localLiveStroke.current = null;
      drawingRef.current = null;
      schedulePaint();
      return;
    }

    if (shapeStartRef.current) {
      const s = shapeStartRef.current;
      const p = getWorldPoint(e.clientX, e.clientY);
      const w = p.x - s.x;
      const h = p.y - s.y;
      if (Math.abs(w) > 2 || Math.abs(h) > 2) {
        send({
          type: "shape.commit",
          tempId: tempId(),
          shapeType: tool as "rectangle" | "ellipse" | "line" | "arrow",
          x: s.x,
          y: s.y,
          width: w,
          height: h,
          color,
          strokeWidth,
          fill: fillEnabled ? `${color}44` : null,
        });
      }
      shapeStartRef.current = null;
      previewRef.current = null;
      schedulePaint();
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      zoomBy(e.deltaY > 0 ? 0.92 : 1.08);
    } else {
      setPan({ x: pan.x - e.deltaX / zoom, y: pan.y - e.deltaY / zoom });
    }
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (viewOnly) return;
    const p = getWorldPoint(e.clientX, e.clientY);
    const list = Array.from(elements.values()).reverse();
    const hit = list.find((el) => hitTestElement(el, p));
    if (hit?.type === "text" || hit?.type === "sticky") {
      openEditorForElement(hit);
    }
  };

  const selected = selectedId ? elements.get(selectedId) : null;

  return (
    <div
      ref={containerRef}
      className={clsx(
        "absolute inset-0 z-0 overflow-hidden",
        darkCanvas ? "canvas-dark" : "paper-grid",
        (tool === "hand" || spaceHeld) && "cursor-grab"
      )}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none"
        style={{
          cursor:
            tool === "laser"
              ? "crosshair"
              : viewOnly
                ? "default"
                : "crosshair",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => send({ type: "cursor.leave" })}
        onWheel={onWheel}
        onDoubleClick={onDoubleClick}
      />
      <CursorsOverlay />
      {selected && selected.type !== "stroke" && (
        <TransformOverlay element={selected} />
      )}
      <TextEditor send={send} containerRef={containerRef} />
    </div>
  );
}

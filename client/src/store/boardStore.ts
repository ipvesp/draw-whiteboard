import { create } from "zustand";
import type {
  BoardElement,
  PenKind,
  Point,
  Tool,
  UserPresence,
} from "@collab/shared";
import { PEN_KINDS } from "@collab/shared";
import { appendStrokePoints } from "../canvas/stroke";

export interface LiveStroke {
  strokeId: string;
  userId: string;
  points: Point[];
  color: string;
  width: number;
  penKind?: PenKind;
  eraser?: boolean;
}

interface BoardState {
  connected: boolean;
  userId: string | null;
  userName: string;
  roomId: string;
  elements: Map<string, BoardElement>;
  users: Map<string, UserPresence>;
  liveStrokes: Map<string, LiveStroke>;
  tool: Tool;
  penKind: PenKind;
  color: string;
  strokeWidth: number;
  fillEnabled: boolean;
  snapToGrid: boolean;
  canUndo: boolean;
  canRedo: boolean;
  selectedId: string | null;
  selectedIds: Set<string>;

  setConnected: (v: boolean) => void;
  setUser: (userId: string | null, userName: string, roomId: string) => void;
  setElements: (elements: BoardElement[]) => void;
  addElement: (el: BoardElement) => void;
  updateElement: (el: BoardElement) => void;
  updateElements: (updates: BoardElement[]) => void;
  removeElement: (id: string) => void;
  setUserPresence: (user: UserPresence) => void;
  removeUser: (userId: string) => void;
  setUsers: (users: UserPresence[]) => void;
  setLiveStroke: (stroke: LiveStroke, replace?: boolean) => void;
  appendLiveStrokePoints: (
    strokeId: string,
    userId: string,
    points: Point[],
    meta: Omit<LiveStroke, "strokeId" | "userId" | "points">
  ) => void;
  clearLiveStroke: (strokeId: string) => void;
  setTool: (tool: Tool) => void;
  setPenKind: (penKind: PenKind) => void;
  setColor: (color: string) => void;
  setStrokeWidth: (w: number) => void;
  setFillEnabled: (v: boolean) => void;
  setSnapToGrid: (v: boolean) => void;
  setHistoryFlags: (canUndo: boolean, canRedo: boolean) => void;
  setSelectedId: (id: string | null) => void;
  toggleSelect: (id: string, additive: boolean) => void;
  clearSelection: () => void;
}

export const useBoardStore = create<BoardState>((set) => ({
  connected: false,
  userId: null,
  userName: "",
  roomId: "",
  elements: new Map(),
  users: new Map(),
  liveStrokes: new Map(),
  tool: "pen",
  penKind: "pen",
  color: "#1c1917",
  strokeWidth: 3,
  fillEnabled: false,
  snapToGrid: false,
  canUndo: false,
  canRedo: false,
  selectedId: null,
  selectedIds: new Set(),

  setConnected: (connected) => set({ connected }),
  setUser: (userId, userName, roomId) =>
    set({ userId: userId ?? null, userName, roomId }),
  setElements: (elements) =>
    set({
      elements: new Map(elements.map((e) => [e.id, e])),
    }),
  addElement: (el) =>
    set((s) => {
      const elements = new Map(s.elements);
      elements.set(el.id, el);
      return { elements };
    }),
  updateElement: (el) =>
    set((s) => {
      const elements = new Map(s.elements);
      elements.set(el.id, el);
      return { elements };
    }),
  updateElements: (updates) =>
    set((s) => {
      if (updates.length === 0) return s;
      const elements = new Map(s.elements);
      for (const el of updates) elements.set(el.id, el);
      return { elements };
    }),
  removeElement: (id) =>
    set((s) => {
      const elements = new Map(s.elements);
      elements.delete(id);
      const selectedIds = new Set(s.selectedIds);
      selectedIds.delete(id);
      return {
        elements,
        selectedId: s.selectedId === id ? null : s.selectedId,
        selectedIds,
      };
    }),
  setUserPresence: (user) =>
    set((s) => {
      const users = new Map(s.users);
      users.set(user.id, user);
      return { users };
    }),
  removeUser: (userId) =>
    set((s) => {
      const users = new Map(s.users);
      users.delete(userId);
      return { users };
    }),
  setUsers: (list) =>
    set({
      users: new Map(list.map((u) => [u.id, u])),
    }),
  setLiveStroke: (stroke, replace = false) =>
    set((s) => {
      const prev = s.liveStrokes.get(stroke.strokeId);
      const merged = {
        ...stroke,
        points: replace
          ? stroke.points
          : prev
            ? appendStrokePoints(prev.points, stroke.points)
            : stroke.points,
      };
      if (
        prev &&
        !replace &&
        prev.points.length === merged.points.length &&
        prev.color === merged.color &&
        prev.width === merged.width
      ) {
        return s;
      }
      const liveStrokes = new Map(s.liveStrokes);
      liveStrokes.set(stroke.strokeId, merged);
      return { liveStrokes };
    }),
  appendLiveStrokePoints: (strokeId, userId, points, meta) =>
    set((s) => {
      if (points.length === 0) return s;
      const prev = s.liveStrokes.get(strokeId);
      const mergedPoints = prev
        ? appendStrokePoints(prev.points, points)
        : points;
      if (prev && prev.points.length === mergedPoints.length) return s;
      const liveStrokes = new Map(s.liveStrokes);
      liveStrokes.set(strokeId, {
        strokeId,
        userId,
        points: mergedPoints,
        ...meta,
      });
      return { liveStrokes };
    }),
  clearLiveStroke: (strokeId) =>
    set((s) => {
      const liveStrokes = new Map(s.liveStrokes);
      liveStrokes.delete(strokeId);
      return { liveStrokes };
    }),
  setTool: (tool) => set({ tool }),
  setPenKind: (penKind) =>
    set((s) => {
      const cfg = PEN_KINDS[penKind];
      const next: Partial<BoardState> = { penKind, tool: "pen" };
      if (penKind === "highlighter" && (s.color === "#1c1917" || s.color === "#fafafa")) {
        next.color = "#fef08a";
      }
      if (penKind === "pencil" && s.color === "#fafafa") {
        next.color = "#78716c";
      }
      if (s.strokeWidth < cfg.defaultWidth / 2 || s.strokeWidth > cfg.defaultWidth * 3) {
        next.strokeWidth = cfg.defaultWidth;
      }
      return next;
    }),
  setColor: (color) => set({ color }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
  setFillEnabled: (fillEnabled) => set({ fillEnabled }),
  setSnapToGrid: (snapToGrid) => set({ snapToGrid }),
  setHistoryFlags: (canUndo, canRedo) => set({ canUndo, canRedo }),
  setSelectedId: (selectedId) =>
    set({
      selectedId,
      selectedIds: selectedId ? new Set([selectedId]) : new Set(),
    }),
  toggleSelect: (id, additive) =>
    set((s) => {
      const selectedIds = additive ? new Set(s.selectedIds) : new Set<string>();
      if (selectedIds.has(id)) selectedIds.delete(id);
      else selectedIds.add(id);
      const first = selectedIds.values().next().value ?? null;
      return { selectedIds, selectedId: first };
    }),
  clearSelection: () => set({ selectedId: null, selectedIds: new Set() }),
}));

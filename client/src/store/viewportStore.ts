import { create } from "zustand";
import type { Point } from "@collab/shared";

interface ViewportState {
  pan: Point;
  zoom: number;
  setPan: (p: Point) => void;
  setZoom: (z: number) => void;
  panBy: (dx: number, dy: number) => void;
  zoomBy: (factor: number) => void;
  resetView: () => void;
}

export const useViewportStore = create<ViewportState>((set) => ({
  pan: { x: 0, y: 0 },
  zoom: 1,
  setPan: (pan) => set({ pan }),
  setZoom: (zoom) => set({ zoom: Math.min(4, Math.max(0.15, zoom)) }),
  panBy: (dx, dy) =>
    set((s) => ({ pan: { x: s.pan.x + dx, y: s.pan.y + dy } })),
  zoomBy: (factor) =>
    set((s) => ({
      zoom: Math.min(4, Math.max(0.15, s.zoom * factor)),
    })),
  resetView: () => set({ pan: { x: 0, y: 0 }, zoom: 1 }),
}));

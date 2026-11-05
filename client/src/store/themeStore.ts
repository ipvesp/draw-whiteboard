import { create } from "zustand";

const STORAGE_KEY = "collab_dark_canvas";

function loadDarkCanvas(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

interface ThemeState {
  darkCanvas: boolean;
  toggleDarkCanvas: () => void;
  boardBg: () => string;
  eraserColor: () => string;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  darkCanvas: loadDarkCanvas(),

  toggleDarkCanvas: () =>
    set((s) => {
      const darkCanvas = !s.darkCanvas;
      try {
        localStorage.setItem(STORAGE_KEY, darkCanvas ? "1" : "0");
      } catch {
        /* ignore */
      }
      return { darkCanvas };
    }),

  boardBg: () => (get().darkCanvas ? "#000000" : "#faf7f2"),
  eraserColor: () => (get().darkCanvas ? "#000000" : "#faf7f2"),
}));

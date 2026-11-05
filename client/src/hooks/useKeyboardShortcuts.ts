import { useEffect } from "react";
import type { ClientMessage } from "@collab/shared";
import type { Tool } from "@collab/shared";
import { useBoardStore } from "../store/boardStore";
import { useUiStore } from "../store/uiStore";

const TOOL_KEYS: Record<string, Tool> = {
  v: "select",
  h: "hand",
  p: "pen",
  e: "eraser",
  r: "rectangle",
  o: "ellipse",
  l: "line",
  a: "arrow",
  t: "text",
  s: "sticky",
  k: "laser",
};

export function useKeyboardShortcuts(send: (msg: ClientMessage) => void) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.code === "Space") {
        e.preventDefault();
        useUiStore.getState().setSpaceHeld(true);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) send({ type: "history.redo" });
        else send({ type: "history.undo" });
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        send({ type: "history.redo" });
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        const { selectedId, selectedIds } = useBoardStore.getState();
        const ids = selectedIds.size > 0 ? [...selectedIds] : selectedId ? [selectedId] : [];
        if (ids.length) {
          e.preventDefault();
          for (const id of ids) send({ type: "element.delete", elementId: id });
          useBoardStore.getState().clearSelection();
        }
        return;
      }

      const tool = TOOL_KEYS[e.key.toLowerCase()];
      if (tool && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const store = useBoardStore.getState();
        store.setTool(tool);
        if (tool === "pen") store.setPenKind("pen");
        send({ type: "tool.change", tool });
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") useUiStore.getState().setSpaceHeld(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [send]);
}

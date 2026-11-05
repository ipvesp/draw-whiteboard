import { ArrowUp, ArrowDown } from "lucide-react";
import type { ClientMessage } from "@collab/shared";
import { useBoardStore } from "../store/boardStore";
import { useUiStore } from "../store/uiStore";
import { useThemeStore } from "../store/themeStore";
import { chromePanel, chromeToolButton } from "../lib/chromeStyles";

interface LayerBarProps {
  send: (msg: ClientMessage) => void;
}

export function LayerBar({ send }: LayerBarProps) {
  const darkCanvas = useThemeStore((s) => s.darkCanvas);
  const selectedId = useBoardStore((s) => s.selectedId);
  const viewOnly = useUiStore((s) => s.viewOnly);

  if (!selectedId || viewOnly) return null;

  return (
    <div
      className={`pointer-events-auto absolute left-20 top-4 z-20 flex gap-1 p-1.5 ${chromePanel(darkCanvas)}`}
    >
      <button
        type="button"
        title="Öne getir"
        onClick={() =>
          send({ type: "element.layer", elementId: selectedId, action: "front" })
        }
        className={chromeToolButton(darkCanvas, false)}
      >
        <ArrowUp size={16} />
      </button>
      <button
        type="button"
        title="Arkaya gönder"
        onClick={() =>
          send({ type: "element.layer", elementId: selectedId, action: "back" })
        }
        className={chromeToolButton(darkCanvas, false)}
      >
        <ArrowDown size={16} />
      </button>
    </div>
  );
}

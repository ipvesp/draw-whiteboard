import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { useBoardStore } from "../store/boardStore";
import { useUiStore } from "../store/uiStore";
import { useThemeStore } from "../store/themeStore";
import { useViewportStore } from "../store/viewportStore";
import { worldToScreen } from "../canvas/draw";
import type { ClientMessage } from "@collab/shared";

interface TextEditorProps {
  send: (msg: ClientMessage) => void;
  containerRef: RefObject<HTMLDivElement | null>;
}

export function TextEditor({ send, containerRef }: TextEditorProps) {
  const editor = useUiStore((s) => s.textEditor);
  const close = useUiStore((s) => s.closeTextEditor);
  const color = useBoardStore((s) => s.color);
  const elements = useBoardStore((s) => s.elements);
  const pan = useViewportStore((s) => s.pan);
  const zoom = useViewportStore((s) => s.zoom);
  const darkCanvas = useThemeStore((s) => s.darkCanvas);
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const committing = useRef(false);

  const existing = editor?.elementId ? elements.get(editor.elementId) : null;

  useEffect(() => {
    if (!editor) return;
    if (existing?.type === "text" || existing?.type === "sticky") {
      setValue(existing.content);
    } else {
      setValue("");
    }
    committing.current = false;
    const t = window.setTimeout(() => ref.current?.focus(), 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnızca editör oturumu değişince sıfırla
  }, [editor?.elementId, editor?.isNew, editor?.kind]);

  if (!editor) return null;

  const container = containerRef.current;
  if (!container) return null;

  const screen = worldToScreen({ x: editor.x, y: editor.y }, pan, zoom);
  const w = editor.width * zoom;
  const h = editor.height * zoom;
  const isSticky = editor.kind === "sticky";

  const commit = (content: string) => {
    if (committing.current) return;
    committing.current = true;
    const trimmed = content.trim();
    if (!trimmed) {
      close();
      return;
    }
    if (editor.isNew) {
      if (isSticky) {
        send({
          type: "sticky.commit",
          tempId: `temp_${crypto.randomUUID().slice(0, 8)}`,
          x: editor.x,
          y: editor.y,
          width: editor.width,
          height: editor.height,
          content: trimmed,
          color: "#fef08a",
        });
      } else {
        send({
          type: "text.commit",
          tempId: `temp_${crypto.randomUUID().slice(0, 8)}`,
          x: editor.x,
          y: editor.y,
          width: editor.width,
          height: editor.height,
          content: trimmed,
          color,
          fontSize: 20,
        });
      }
    } else if (editor.elementId) {
      send({
        type: "element.update",
        elementId: editor.elementId,
        patch: { content: trimmed, updatedAt: Date.now() },
      });
    }
    close();
  };

  const cancel = () => {
    committing.current = true;
    close();
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <button
        type="button"
        aria-label="Düzenlemeyi kapat"
        className="pointer-events-auto absolute inset-0 bg-black/10"
        onMouseDown={(e) => {
          e.preventDefault();
          commit(value);
        }}
      />
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={isSticky ? "Notunuzu yazın…" : "Metninizi yazın…"}
        className={`pointer-events-auto absolute resize-none rounded-lg border-2 p-3 shadow-xl outline-none ${
          isSticky
            ? "border-amber-400/60 bg-[#fef08a] text-ink"
            : darkCanvas
              ? "border-brand bg-zinc-900 text-stone-100"
              : "border-brand bg-white text-ink"
        }`}
        style={{
          left: screen.x,
          top: screen.y,
          width: w,
          height: h,
          fontSize: isSticky ? 14 * zoom : 20 * zoom,
          lineHeight: 1.35,
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            commit(value);
          }
        }}
      />
      <p
        className="pointer-events-none absolute text-[10px] text-stone-500"
        style={{ left: screen.x, top: screen.y + h + 4 }}
      >
        Ctrl+Enter kaydet · Esc iptal
      </p>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import {
  MousePointer2,
  Pencil,
  Eraser,
  Square,
  Circle,
  Minus,
  ArrowUpRight,
  Type,
  Undo2,
  Redo2,
  Hand,
  StickyNote,
  Zap,
  RotateCcw,
  PenLine,
  Highlighter,
  Paintbrush,
  Pen,
  ChevronRight,
} from "lucide-react";
import type { Tool, PenKind } from "@collab/shared";
import { PEN_KINDS } from "@collab/shared";
import { useBoardStore } from "../store/boardStore";
import { useThemeStore } from "../store/themeStore";
import { useUiStore } from "../store/uiStore";
import {
  chromeDivider,
  chromePanel,
  chromeToolButton,
} from "../lib/chromeStyles";

const PEN_TOOLS: {
  kind: PenKind;
  icon: typeof Pencil;
  label: string;
}[] = [
  { kind: "pen", icon: Pencil, label: "Kalem (P)" },
  { kind: "marker", icon: PenLine, label: "Keçeli kalem" },
  { kind: "highlighter", icon: Highlighter, label: "Fosforlu kalem" },
  { kind: "brush", icon: Paintbrush, label: "Fırça" },
  { kind: "pencil", icon: Pen, label: "Kurşun kalem" },
];

const OTHER_TOOLS: { id: Tool; icon: typeof Square; label: string }[] = [
  { id: "rectangle", icon: Square, label: "Dikdörtgen (R)" },
  { id: "ellipse", icon: Circle, label: "Elips (O)" },
  { id: "line", icon: Minus, label: "Çizgi (L)" },
  { id: "arrow", icon: ArrowUpRight, label: "Ok (A)" },
  { id: "text", icon: Type, label: "Metin (T)" },
  { id: "sticky", icon: StickyNote, label: "Not (S)" },
  { id: "laser", icon: Zap, label: "Lazer (K)" },
];

interface SidebarProps {
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onToolChange?: (tool: Tool) => void;
  onPenMenuOpenChange?: (open: boolean) => void;
}

export function Sidebar({
  onUndo,
  onRedo,
  onReset,
  onToolChange,
  onPenMenuOpenChange,
}: SidebarProps) {
  const darkCanvas = useThemeStore((s) => s.darkCanvas);
  const viewOnly = useUiStore((s) => s.viewOnly);
  const role = useUiStore((s) => s.role);
  const tool = useBoardStore((s) => s.tool);
  const penKind = useBoardStore((s) => s.penKind);
  const setTool = useBoardStore((s) => s.setTool);
  const setPenKind = useBoardStore((s) => s.setPenKind);
  const canUndo = useBoardStore((s) => s.canUndo);
  const canRedo = useBoardStore((s) => s.canRedo);

  const [penMenuOpen, setPenMenuOpen] = useState(false);
  const [penMenuPos, setPenMenuPos] = useState({ top: 0, left: 0 });
  const penWrapRef = useRef<HTMLDivElement>(null);
  const penBtnRef = useRef<HTMLButtonElement>(null);
  const penFlyoutRef = useRef<HTMLDivElement>(null);

  const activePen =
    PEN_TOOLS.find((p) => p.kind === penKind) ?? PEN_TOOLS[0];
  const ActivePenIcon = activePen.icon;
  const penActive = tool === "pen";

  const updatePenMenuPos = () => {
    const rect = penBtnRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPenMenuPos({ top: rect.top, left: rect.right + 8 });
  };

  useEffect(() => {
    onPenMenuOpenChange?.(penMenuOpen);
  }, [penMenuOpen, onPenMenuOpenChange]);

  useEffect(() => {
    if (!penMenuOpen) return;
    updatePenMenuPos();
    window.addEventListener("resize", updatePenMenuPos);
    window.addEventListener("scroll", updatePenMenuPos, true);
    return () => {
      window.removeEventListener("resize", updatePenMenuPos);
      window.removeEventListener("scroll", updatePenMenuPos, true);
    };
  }, [penMenuOpen]);

  useEffect(() => {
    if (!penMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (
        penWrapRef.current?.contains(t) ||
        penFlyoutRef.current?.contains(t)
      ) {
        return;
      }
      setPenMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [penMenuOpen]);

  const handleReset = () => {
    if (viewOnly || role !== "owner") return;
    if (
      window.confirm(
        "Reset tuşuna basıldığında her şey sıfırlansın mı?\n\nBu işlem tahtadaki tüm içeriği kalıcı olarak siler."
      )
    ) {
      onReset();
    }
  };

  const pick = (id: Tool) => {
    setPenMenuOpen(false);
    setTool(id);
    onToolChange?.(id);
  };

  const pickPen = (kind: PenKind) => {
    setPenKind(kind);
    onToolChange?.("pen");
    setPenMenuOpen(false);
  };

  const onPenButtonClick = () => {
    if (!penActive) {
      setPenKind(penKind);
      onToolChange?.("pen");
    }
    if (!penMenuOpen) updatePenMenuPos();
    setPenMenuOpen((open) => !open);
  };

  const penFlyout =
    penMenuOpen &&
    createPortal(
      <div
        ref={penFlyoutRef}
        className={clsx(
          "pointer-events-auto fixed z-[100] flex min-w-[11rem] flex-col gap-0.5 rounded-xl border p-1.5 shadow-xl",
          darkCanvas
            ? "border-zinc-200 bg-white"
            : "border-zinc-700 bg-zinc-950"
        )}
        style={{ top: penMenuPos.top, left: penMenuPos.left }}
        role="menu"
      >
        {PEN_TOOLS.map(({ kind, icon: Icon, label }) => (
          <button
            key={kind}
            type="button"
            role="menuitem"
            title={label}
            onClick={() => pickPen(kind)}
            className={clsx(
              "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
              tool === "pen" && penKind === kind
                ? darkCanvas
                  ? "bg-black text-white"
                  : "bg-white text-black"
                : darkCanvas
                  ? "text-zinc-600 hover:bg-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-900"
            )}
          >
            <Icon size={16} strokeWidth={1.75} />
            <span className="font-medium">{PEN_KINDS[kind].label}</span>
          </button>
        ))}
      </div>,
      document.body
    );

  return (
    <aside
      className={`flex max-h-[calc(100vh-2rem)] flex-col gap-1 overflow-visible p-2 ${chromePanel(darkCanvas)}`}
      aria-label="Araçlar"
    >
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-x-hidden overflow-y-auto">
        <button
          type="button"
          title="Seç (V)"
          onClick={() => pick("select")}
          className={chromeToolButton(darkCanvas, tool === "select")}
        >
          <MousePointer2
            size={18}
            strokeWidth={tool === "select" ? 2.25 : 1.75}
          />
        </button>
        <button
          type="button"
          title="El (H)"
          onClick={() => pick("hand")}
          className={chromeToolButton(darkCanvas, tool === "hand")}
        >
          <Hand size={18} strokeWidth={tool === "hand" ? 2.25 : 1.75} />
        </button>

        <div className={`my-1 h-px shrink-0 ${chromeDivider(darkCanvas)}`} />

        <div ref={penWrapRef} className="shrink-0">
          <button
            ref={penBtnRef}
            type="button"
            title={`Kalem — ${PEN_KINDS[penKind].label}`}
            onClick={onPenButtonClick}
            aria-expanded={penMenuOpen}
            aria-haspopup="true"
            className={clsx(chromeToolButton(darkCanvas, penActive), "relative")}
          >
            <ActivePenIcon
              size={18}
              strokeWidth={penActive ? 2.25 : 1.75}
              className={penKind === "pencil" ? "opacity-70" : undefined}
            />
            <ChevronRight
              size={10}
              className={clsx(
                "absolute bottom-1 right-1 opacity-60 transition-transform",
                penMenuOpen && "rotate-90"
              )}
            />
          </button>
        </div>

        <button
          type="button"
          title="Silgi (E)"
          onClick={() => pick("eraser")}
          className={chromeToolButton(darkCanvas, tool === "eraser")}
        >
          <Eraser size={18} strokeWidth={tool === "eraser" ? 2.25 : 1.75} />
        </button>

        <div className={`my-1 h-px shrink-0 ${chromeDivider(darkCanvas)}`} />

        {OTHER_TOOLS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            title={label}
            onClick={() => pick(id)}
            className={chromeToolButton(darkCanvas, tool === id)}
          >
            <Icon size={18} strokeWidth={tool === id ? 2.25 : 1.75} />
          </button>
        ))}
      </nav>

      <div className={`h-px shrink-0 ${chromeDivider(darkCanvas)}`} />

      <div className="flex shrink-0 flex-col gap-0.5">
        <button
          type="button"
          title="Geri al (Ctrl+Z)"
          onClick={onUndo}
          disabled={!canUndo}
          className={`${chromeToolButton(darkCanvas, false)} disabled:opacity-25`}
        >
          <Undo2 size={18} />
        </button>
        <button
          type="button"
          title="Yinele (Ctrl+Y)"
          onClick={onRedo}
          disabled={!canRedo}
          className={`${chromeToolButton(darkCanvas, false)} disabled:opacity-25`}
        >
          <Redo2 size={18} />
        </button>
        <button
          type="button"
          title="Tahtayı sıfırla"
          onClick={handleReset}
          disabled={viewOnly}
          className={`${chromeToolButton(darkCanvas, false)} disabled:opacity-25`}
        >
          <RotateCcw size={18} />
        </button>
      </div>
      {penFlyout}
    </aside>
  );
}

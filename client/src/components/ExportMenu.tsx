import { Download, FileImage, FileCode } from "lucide-react";
import { useState } from "react";
import { useBoardStore } from "../store/boardStore";
import { useThemeStore } from "../store/themeStore";
import { exportBoardPng, exportBoardSvg } from "../canvas/export";
import { chromePanel, chromeToolButton } from "../lib/chromeStyles";

export function ExportMenu() {
  const darkCanvas = useThemeStore((s) => s.darkCanvas);
  const boardBg = useThemeStore((s) => s.boardBg);
  const elements = useBoardStore((s) => s.elements);
  const [open, setOpen] = useState(false);

  const list = Array.from(elements.values());

  return (
    <div
      className={`pointer-events-auto absolute bottom-5 left-[11.5rem] z-20 hidden sm:block ${chromePanel(darkCanvas)} p-1.5`}
    >
      <button
        type="button"
        title="Dışa aktar"
        onClick={() => setOpen((o) => !o)}
        className={chromeToolButton(darkCanvas, open)}
      >
        <Download size={18} />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 flex min-w-[7rem] flex-col gap-0.5 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg">
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium hover:bg-zinc-100"
            onClick={() => {
              exportBoardPng(list, boardBg());
              setOpen(false);
            }}
          >
            <FileImage size={14} /> PNG
          </button>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium hover:bg-zinc-100"
            onClick={() => {
              exportBoardSvg(list, boardBg());
              setOpen(false);
            }}
          >
            <FileCode size={14} /> SVG
          </button>
        </div>
      )}
    </div>
  );
}

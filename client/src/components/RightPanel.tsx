import { useCallback, useState } from "react";
import clsx from "clsx";
import {
  Check,
  Link2,
  Wifi,
  WifiOff,
  PanelRightClose,
  PanelRightOpen,
  Users,
  Moon,
  Sun,
} from "lucide-react";
import { useBoardStore } from "../store/boardStore";
import { useThemeStore } from "../store/themeStore";
import { useUiStore } from "../store/uiStore";
import {
  chromeHeading,
  chromeIconButton,
  chromeMutedText,
  chromePanel,
  chromeSubtleBg,
} from "../lib/chromeStyles";

interface RightPanelProps {
  open: boolean;
  onToggle: () => void;
}

export function RightPanel({ open, onToggle }: RightPanelProps) {
  const darkCanvas = useThemeStore((s) => s.darkCanvas);
  const toggleDarkCanvas = useThemeStore((s) => s.toggleDarkCanvas);
  const roomId = useBoardStore((s) => s.roomId);
  const userName = useBoardStore((s) => s.userName);
  const userId = useBoardStore((s) => s.userId);
  const connected = useBoardStore((s) => s.connected);
  const users = useBoardStore((s) => s.users);
  const followUserId = useUiStore((s) => s.followUserId);
  const setFollowUserId = useUiStore((s) => s.setFollowUserId);
  const setColor = useBoardStore((s) => s.setColor);
  const color = useBoardStore((s) => s.color);
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;

  const copyLink = useCallback(async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareUrl]);

  const handleThemeToggle = () => {
    const next = !darkCanvas;
    toggleDarkCanvas();
    if (next && color === "#1c1917") setColor("#fafafa");
    if (!next && color === "#fafafa") setColor("#1c1917");
  };

  const allUsers = Array.from(users.values());
  if (userId && !users.has(userId)) {
    allUsers.unshift({
      id: userId,
      name: userName,
      color: "#0d9488",
      cursor: null,
      tool: "pen",
      role: useUiStore.getState().role,
    });
  }

  const chipClass = `flex items-center gap-2 px-3 py-2.5 ${chromePanel(darkCanvas)}`;

  if (!open) {
    return (
      <div className="pointer-events-auto absolute right-4 top-4 z-20 flex flex-col gap-2">
        <button
          type="button"
          onClick={handleThemeToggle}
          className={`p-2.5 ${chromePanel(darkCanvas)}`}
          title={darkCanvas ? "Açık tuval" : "Koyu tuval"}
        >
          {darkCanvas ? (
            <Sun size={18} className="text-zinc-800" />
          ) : (
            <Moon size={18} className="text-stone-300" />
          )}
        </button>
        <button type="button" onClick={onToggle} title="Oda & ekip" className={chipClass}>
          <Users size={18} className={darkCanvas ? "text-zinc-700" : "text-stone-300"} />
          <span
            className={clsx(
              "rounded-full px-2 py-0.5 text-xs font-semibold",
              darkCanvas ? "bg-zinc-900/10 text-zinc-900" : "bg-brand/30 text-brand-light"
            )}
          >
            {allUsers.length}
          </span>
          <PanelRightOpen size={16} className={chromeMutedText(darkCanvas)} />
        </button>
      </div>
    );
  }

  return (
    <aside
      className={`pointer-events-auto absolute right-4 top-4 z-20 flex max-h-[min(70vh,calc(100%-6rem))] w-72 flex-col overflow-hidden ${chromePanel(darkCanvas)}`}
    >
      <div
        className={`flex items-center justify-between border-b px-4 py-3 ${darkCanvas ? "border-zinc-200" : "border-white/10"}`}
      >
        <span className={clsx("text-sm font-semibold", chromeHeading(darkCanvas))}>
          Oda & ekip
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleThemeToggle}
            className={clsx("rounded-lg p-1.5", chromeIconButton(darkCanvas))}
            title={darkCanvas ? "Açık tuval" : "Koyu tuval"}
          >
            {darkCanvas ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            type="button"
            onClick={onToggle}
            className={clsx("rounded-lg p-1.5", chromeIconButton(darkCanvas))}
            title="Paneli kapat"
          >
            <PanelRightClose size={18} />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto p-4">
        <p className={clsx("text-[10px] font-semibold uppercase tracking-wider", chromeMutedText(darkCanvas))}>
          Oda kodu
        </p>
        <p className={clsx("mt-1 font-mono text-base", chromeHeading(darkCanvas))}>{roomId}</p>

        <button
          type="button"
          onClick={copyLink}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          {copied ? <Check size={15} /> : <Link2 size={15} />}
          {copied ? "Kopyalandı" : "Davet linki"}
        </button>

        <div className="mt-4 flex items-center justify-between">
          <span className={clsx("text-xs", chromeMutedText(darkCanvas))}>Bağlantı</span>
          <span
            className={clsx(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
              connected
                ? "bg-emerald-500/15 text-emerald-500"
                : "bg-amber-500/15 text-amber-600"
            )}
          >
            {connected ? <Wifi size={11} /> : <WifiOff size={11} />}
            {connected ? "Canlı" : "…"}
          </span>
        </div>

        <p className={clsx("mb-2 mt-5 text-[10px] font-semibold uppercase tracking-wider", chromeMutedText(darkCanvas))}>
          Katılımcılar ({allUsers.length})
        </p>
        <ul className="space-y-1.5">
          {allUsers.map((u) => (
            <li
              key={u.id}
              className={clsx("flex items-center gap-2.5 rounded-xl px-2.5 py-2", chromeSubtleBg(darkCanvas))}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: u.color }}
              >
                {u.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className={clsx("truncate text-sm", chromeHeading(darkCanvas))}>
                  {u.name}
                  {u.id === userId && (
                    <span className="text-brand"> · siz</span>
                  )}
                </p>
              </div>
              {u.id !== userId && (
                <button
                  type="button"
                  title="Görünümü takip et"
                  onClick={() =>
                    setFollowUserId(followUserId === u.id ? null : u.id)
                  }
                  className={clsx(
                    "shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold",
                    followUserId === u.id
                      ? "bg-brand text-white"
                      : chromeIconButton(darkCanvas)
                  )}
                >
                  {followUserId === u.id ? "Takipte" : "Takip"}
                </button>
              )}
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: u.color }}
              />
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

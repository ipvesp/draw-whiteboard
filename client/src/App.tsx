import { useEffect, useState } from "react";
import clsx from "clsx";
import { useBoardStore } from "./store/boardStore";
import { useEdgeAutoHide } from "./hooks/useEdgeAutoHide";
import { useCollaboration } from "./hooks/useCollaboration";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { JoinScreen } from "./components/JoinScreen";
import { Sidebar } from "./components/Sidebar";
import { StyleDock } from "./components/StyleDock";
import { RightPanel } from "./components/RightPanel";
import { Whiteboard } from "./components/Whiteboard";
import { ZoomControls } from "./components/ZoomControls";
import { Minimap } from "./components/Minimap";
import { ExportMenu } from "./components/ExportMenu";
import { LayerBar } from "./components/LayerBar";
import { useUiStore } from "./store/uiStore";
import { useFollowViewport } from "./hooks/useFollowViewport";
import { useViewportStore } from "./store/viewportStore";

export default function App() {
  const [joined, setJoined] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const setUser = useBoardStore((s) => s.setUser);
  const reconnecting = useUiStore((s) => s.reconnecting);
  const joinError = useUiStore((s) => s.joinError);

  const { send } = useCollaboration(joined);
  useKeyboardShortcuts(send);
  useFollowViewport(joined);

  const [sidebarLocked, setSidebarLocked] = useState(false);
  const sidebarChrome = useEdgeAutoHide({
    edge: "left",
    enabled: joined,
    locked: sidebarLocked,
  });
  const paletteChrome = useEdgeAutoHide({
    edge: "bottom",
    enabled: joined,
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("pin")) {
      url.searchParams.delete("pin");
      window.history.replaceState({}, "", url);
    }
  }, []);

  useEffect(() => {
    if (joinError) setJoined(false);
  }, [joinError]);

  const handleJoin = (
    userName: string,
    roomId: string,
    opts: { enterPin?: string; setPin?: string }
  ) => {
    useUiStore.getState().setJoinError(null);
    useUiStore.getState().setFollowUserId(null);
    useViewportStore.getState().resetView();
    setUser(null, userName, roomId);
    const url = new URL(window.location.href);
    url.searchParams.set("room", roomId);
    url.searchParams.delete("pin");
    window.history.replaceState({}, "", url);

    sessionStorage.removeItem(`collab_pin_${roomId}`);
    sessionStorage.removeItem(`collab_setpin_${roomId}`);
    if (opts.enterPin) {
      sessionStorage.setItem(`collab_pin_${roomId}`, opts.enterPin);
    }
    if (opts.setPin) {
      sessionStorage.setItem(`collab_setpin_${roomId}`, opts.setPin);
    }

    setJoined(true);
  };

  if (!joined) {
    return (
      <JoinScreen onJoin={handleJoin} joinError={joinError ?? undefined} />
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Whiteboard send={send} />

      {reconnecting && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-amber-500/90 px-4 py-2 text-sm font-medium text-white shadow-lg">
          Yeniden bağlanılıyor…
        </div>
      )}

      <div
        className={clsx(
          "pointer-events-none fixed inset-y-0 left-0 z-20 flex items-center transition-transform duration-300 ease-out",
          sidebarChrome.visible ? "translate-x-0" : "-translate-x-[110%]"
        )}
      >
        <div
          className="pointer-events-auto pl-4"
          onMouseEnter={sidebarChrome.onMouseEnter}
          onMouseLeave={sidebarChrome.onMouseLeave}
        >
          <Sidebar
            onUndo={() => send({ type: "history.undo" })}
            onRedo={() => send({ type: "history.redo" })}
            onReset={() => send({ type: "room.clear" })}
            onToolChange={(tool) => send({ type: "tool.change", tool })}
            onPenMenuOpenChange={setSidebarLocked}
          />
        </div>
      </div>

      <div
        className={clsx(
          "pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center pb-5 transition-transform duration-300 ease-out",
          paletteChrome.visible ? "translate-y-0" : "translate-y-[calc(100%+2rem)]"
        )}
      >
        <div
          className="pointer-events-auto"
          onMouseEnter={paletteChrome.onMouseEnter}
          onMouseLeave={paletteChrome.onMouseLeave}
        >
          <StyleDock />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 z-10">
        <LayerBar send={send} />
        <ZoomControls />
        <Minimap />
        <ExportMenu />
        <RightPanel open={panelOpen} onToggle={() => setPanelOpen((o) => !o)} />
      </div>

    </div>
  );
}

import type { ServerMessage } from "@collab/shared";
import { useBoardStore } from "../store/boardStore";
import { useUiStore } from "../store/uiStore";

const SYNC_CHUNK = 48;

/** Büyük sync.batch: bir karede işlenecek üst sınır; kalanı sonraki kareye bırak */
function applySyncBatchDeferred(messages: ServerMessage[]): void {
  let i = 0;
  const run = () => {
    const end = Math.min(i + SYNC_CHUNK, messages.length);
    for (; i < end; i++) {
      applyServerMessage(messages[i]!);
    }
    if (i < messages.length) requestAnimationFrame(run);
  };
  run();
}

export function applyServerMessage(msg: ServerMessage): void {
  if (msg.type === "sync.batch") {
    const list = msg.messages;
    if (list.length <= SYNC_CHUNK) {
      for (const m of list) applyServerMessage(m);
    } else {
      applySyncBatchDeferred(list);
    }
    return;
  }

  const s = useBoardStore.getState();
  const ui = useUiStore.getState();

  const trackSeq = (seq: number) => {
    const uist = useUiStore.getState();
    if (seq > uist.lastSeq) uist.setLastSeq(seq);
  };

  switch (msg.type) {
    case "room.joined": {
      const els = Array.isArray(msg.state.elements) ? msg.state.elements : [];
      s.setUser(msg.userId, s.userName, msg.state.roomId);
      s.setElements(els);
      s.setUsers(msg.state.users ?? []);
      ui.setRole(msg.role, msg.role === "viewer");
      trackSeq(msg.state.seq);
      ui.setJoinError(null);
      sessionStorage.removeItem(`collab_setpin_${msg.state.roomId}`);
      break;
    }
    case "room.user_joined":
      s.setUserPresence(msg.user);
      break;
    case "room.user_left":
      s.removeUser(msg.userId);
      break;
    case "element.added":
      trackSeq(msg.seq);
      s.addElement(msg.element);
      if (msg.element.type === "stroke") {
        const live = useBoardStore.getState().liveStrokes;
        for (const key of live.keys()) {
          if (key.startsWith("temp_")) s.clearLiveStroke(key);
        }
      }
      break;
    case "element.updated":
      trackSeq(msg.seq);
      s.updateElement(msg.element);
      break;
    case "element.deleted":
      trackSeq(msg.seq);
      s.removeElement(msg.elementId);
      break;
    case "stroke.live":
      s.appendLiveStrokePoints(msg.strokeId, msg.userId, msg.points, {
        color: msg.color,
        width: msg.width,
        penKind: msg.penKind,
        eraser: msg.eraser,
      });
      break;
    case "laser.live": {
      const last = msg.points[msg.points.length - 1];
      ui.pushLaser({
        x: last?.x ?? 0,
        y: last?.y ?? 0,
        color: msg.color,
        userId: msg.userId,
      });
      const uid = msg.userId;
      setTimeout(() => {
        useUiStore.setState((st) => ({
          laserPoints: st.laserPoints.filter((p) => p.userId !== uid),
        }));
      }, 600);
      break;
    }
    case "presence.update":
      s.setUserPresence(msg.user);
      break;
    case "history.changed":
      s.setHistoryFlags(msg.canUndo, msg.canRedo);
      break;
    case "room.cleared":
      trackSeq(msg.seq);
      s.setElements([]);
      s.clearSelection();
      for (const key of useBoardStore.getState().liveStrokes.keys()) {
        s.clearLiveStroke(key);
      }
      ui.closeTextEditor();
      break;
    case "room.error":
      ui.setJoinError(msg.message);
      break;
  }
}

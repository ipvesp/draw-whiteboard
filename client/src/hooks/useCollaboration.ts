import { useCallback, useEffect, useRef } from "react";
import type { ClientMessage, ServerMessage } from "@collab/shared";
import { useBoardStore } from "../store/boardStore";
import { useUiStore } from "../store/uiStore";
import { applyServerMessage } from "../lib/applyServerMessage";

const WS_URL =
  import.meta.env.VITE_WS_URL ??
  `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:3001`;

export function useCollaboration(enabled: boolean) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const intentionalClose = useRef(false);
  const joinPayload = useRef<{
    roomId: string;
    userName: string;
    pin?: string;
    setPin?: string;
    viewOnly: boolean;
  } | null>(null);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const connect = useCallback(() => {
    const payload = joinPayload.current;
    if (!payload) return;

    const { lastSeq } = useUiStore.getState();
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      useBoardStore.getState().setConnected(true);
      useUiStore.getState().setReconnecting(false);
      ws.send(
        JSON.stringify({
          type: "room.join",
          roomId: payload.roomId,
          userName: payload.userName,
          pin: payload.pin,
          setPin: payload.setPin,
          role: payload.viewOnly ? "viewer" : undefined,
        } satisfies ClientMessage)
      );
      if (lastSeq > 0) {
        ws.send(JSON.stringify({ type: "sync.request", lastSeq }));
      }
    };

    ws.onmessage = (ev) => {
      try {
        applyServerMessage(JSON.parse(ev.data as string) as ServerMessage);
      } catch (e) {
        console.error("[collab] WS message", e);
      }
    };

    ws.onclose = () => {
      useBoardStore.getState().setConnected(false);
      if (!intentionalClose.current) {
        useUiStore.getState().setReconnecting(true);
        reconnectTimer.current = setTimeout(connect, 2000);
      }
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const params = new URLSearchParams(window.location.search);
    const roomId = useBoardStore.getState().roomId;
    const userName = useBoardStore.getState().userName;
    const viewOnly = params.get("mode") === "view";

    joinPayload.current = {
      roomId,
      userName,
      pin: sessionStorage.getItem(`collab_pin_${roomId}`) ?? undefined,
      setPin: sessionStorage.getItem(`collab_setpin_${roomId}`) ?? undefined,
      viewOnly,
    };

    intentionalClose.current = false;
    connect();

    return () => {
      intentionalClose.current = true;
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [enabled, connect]);

  return { send };
}

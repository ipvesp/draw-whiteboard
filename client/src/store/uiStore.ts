import { create } from "zustand";
import type { UserRole } from "@collab/shared";

interface UiState {
  role: UserRole;
  viewOnly: boolean;
  lastSeq: number;
  spaceHeld: boolean;
  reconnecting: boolean;
  joinError: string | null;
  followUserId: string | null;
  textEditor: {
    elementId: string | null;
    x: number;
    y: number;
    isNew: boolean;
    kind: "text" | "sticky";
    width: number;
    height: number;
  } | null;
  laserPoints: { x: number; y: number; color: string; userId: string }[];

  setRole: (role: UserRole, viewOnly: boolean) => void;
  setLastSeq: (seq: number) => void;
  setSpaceHeld: (v: boolean) => void;
  setReconnecting: (v: boolean) => void;
  setJoinError: (msg: string | null) => void;
  setFollowUserId: (id: string | null) => void;
  openTextEditor: (p: {
    elementId: string | null;
    x: number;
    y: number;
    isNew: boolean;
    kind: "text" | "sticky";
    width?: number;
    height?: number;
  }) => void;
  closeTextEditor: () => void;
  setLaserPoints: (
    pts: { x: number; y: number; color: string; userId: string }[]
  ) => void;
  pushLaser: (p: { x: number; y: number; color: string; userId: string }) => void;
}

export const useUiStore = create<UiState>((set) => ({
  role: "editor",
  viewOnly: false,
  lastSeq: 0,
  spaceHeld: false,
  reconnecting: false,
  joinError: null,
  followUserId: null,
  textEditor: null,
  laserPoints: [],

  setRole: (role, viewOnly) => set({ role, viewOnly }),
  setLastSeq: (lastSeq) => set({ lastSeq }),
  setSpaceHeld: (spaceHeld) => set({ spaceHeld }),
  setReconnecting: (reconnecting) => set({ reconnecting }),
  setJoinError: (joinError) => set({ joinError }),
  setFollowUserId: (followUserId) => set({ followUserId }),
  openTextEditor: (p) =>
    set({
      textEditor: {
        elementId: p.elementId,
        x: p.x,
        y: p.y,
        isNew: p.isNew,
        kind: p.kind,
        width: p.width ?? (p.kind === "sticky" ? 200 : 280),
        height: p.height ?? (p.kind === "sticky" ? 160 : 80),
      },
    }),
  closeTextEditor: () => set({ textEditor: null }),
  setLaserPoints: (laserPoints) => set({ laserPoints }),
  pushLaser: (p) =>
    set((s) => ({
      laserPoints: [...s.laserPoints.filter((x) => x.userId !== p.userId), p],
    })),
}));

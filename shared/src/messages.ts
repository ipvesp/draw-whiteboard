import type {
  BoardElement,
  Point,
  RoomState,
  Tool,
  UndoPolicy,
  UserPresence,
  UserRole,
} from "./types.js";
import type { PenKind } from "./penKinds.js";

/** Client → Server */
export type ClientMessage =
  | {
      type: "room.join";
      roomId: string;
      userName: string;
      /** Mevcut odaya giriş şifresi */
      pin?: string;
      /** Yeni oda oluştururken şifre belirle (yalnızca odada henüz şifre yoksa) */
      setPin?: string;
      role?: UserRole;
    }
  | { type: "room.leave" }
  | {
      type: "stroke.start";
      tempId: string;
      color: string;
      width: number;
      penKind?: PenKind;
      eraser?: boolean;
    }
  | {
      type: "stroke.points";
      strokeId: string;
      points: Point[];
      color: string;
      width: number;
      penKind?: PenKind;
      eraser?: boolean;
    }
  | {
      type: "stroke.end";
      strokeId: string;
      points: Point[];
      color: string;
      width: number;
      penKind?: PenKind;
      eraser?: boolean;
    }
  | {
      type: "shape.commit";
      tempId: string;
      shapeType: "rectangle" | "ellipse" | "line" | "arrow";
      x: number;
      y: number;
      width: number;
      height: number;
      color: string;
      strokeWidth: number;
      fill: string | null;
    }
  | {
      type: "text.commit";
      tempId: string;
      x: number;
      y: number;
      width: number;
      height: number;
      content: string;
      color: string;
      fontSize: number;
    }
  | {
      type: "sticky.commit";
      tempId: string;
      x: number;
      y: number;
      width: number;
      height: number;
      content: string;
      color: string;
    }
  | {
      type: "element.update";
      elementId: string;
      patch: Partial<BoardElement>;
    }
  | { type: "element.delete"; elementId: string }
  | { type: "element.layer"; elementId: string; action: "front" | "back" }
  | { type: "cursor.move"; x: number; y: number }
  | { type: "cursor.leave" }
  | { type: "laser.move"; points: Point[] }
  | { type: "tool.change"; tool: Tool }
  | { type: "history.undo" }
  | { type: "history.redo" }
  | { type: "sync.request"; lastSeq: number }
  | { type: "room.clear" };

/** Server → Client */
export type ServerMessage =
  | { type: "room.joined"; state: RoomState; userId: string; role: UserRole }
  | { type: "room.user_joined"; user: UserPresence }
  | { type: "room.user_left"; userId: string }
  | { type: "room.error"; message: string }
  | {
      type: "element.added";
      seq: number;
      element: BoardElement;
      userId: string;
    }
  | {
      type: "element.updated";
      seq: number;
      element: BoardElement;
      userId: string;
    }
  | {
      type: "element.deleted";
      seq: number;
      elementId: string;
      userId: string;
    }
  | {
      type: "stroke.live";
      strokeId: string;
      userId: string;
      points: Point[];
      color: string;
      width: number;
      penKind?: PenKind;
      eraser?: boolean;
    }
  | {
      type: "laser.live";
      userId: string;
      points: Point[];
      color: string;
    }
  | { type: "presence.update"; user: UserPresence }
  | { type: "history.changed"; canUndo: boolean; canRedo: boolean }
  | { type: "sync.batch"; fromSeq: number; messages: ServerMessage[] }
  | { type: "room.cleared"; seq: number; userId: string };

export const CURSOR_COLORS = [
  "#e11d48",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0891b2",
  "#2563eb",
  "#7c3aed",
  "#db2777",
] as const;

export function pickUserColor(index: number): string {
  return CURSOR_COLORS[index % CURSOR_COLORS.length];
}

export const DEFAULT_ROOM_SETTINGS = {
  locked: false,
  undoPolicy: "own" as UndoPolicy,
  maxElements: 5000,
};

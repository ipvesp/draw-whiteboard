import type { PenKind } from "./penKinds.js";

export type Tool =
  | "select"
  | "hand"
  | "pen"
  | "eraser"
  | "rectangle"
  | "ellipse"
  | "line"
  | "arrow"
  | "text"
  | "sticky"
  | "laser";

export type UserRole = "owner" | "editor" | "viewer";

export type UndoPolicy = "own" | "global";

export interface Point {
  x: number;
  y: number;
}

export interface BaseElement {
  id: string;
  type: string;
  authorId: string;
  createdAt: number;
  updatedAt: number;
  zIndex: number;
}

export interface StrokeElement extends BaseElement {
  type: "stroke";
  points: Point[];
  color: string;
  width: number;
  /** Eski odalar: yoksa normal kalem */
  penKind?: PenKind;
  /** Silgi — renk yerine her zaman tuval arka planı kullanılır */
  eraser?: boolean;
}

export interface ShapeElement extends BaseElement {
  type: "rectangle" | "ellipse" | "line" | "arrow";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
  fill: string | null;
}

export interface TextElement extends BaseElement {
  type: "text";
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  color: string;
  fontSize: number;
}

export interface StickyElement extends BaseElement {
  type: "sticky";
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  color: string;
}

export type BoardElement =
  | StrokeElement
  | ShapeElement
  | TextElement
  | StickyElement;

export interface UserPresence {
  id: string;
  name: string;
  color: string;
  cursor: Point | null;
  tool: Tool;
  role: UserRole;
}

/** İstemciye gönderilen oda ayarları — PIN asla dahil edilmez */
export interface RoomSettings {
  locked: boolean;
  undoPolicy: UndoPolicy;
  maxElements: number;
}

export interface RoomState {
  roomId: string;
  elements: BoardElement[];
  seq: number;
  users: UserPresence[];
  settings: RoomSettings;
}

export interface HistoryEntry {
  seq: number;
  action: "add" | "update" | "delete";
  elementId: string;
  before: BoardElement | null;
  after: BoardElement | null;
  userId: string;
  timestamp: number;
}

export interface LaserPoint {
  x: number;
  y: number;
  userId: string;
  color: string;
  expiresAt: number;
}

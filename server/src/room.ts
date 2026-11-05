import type {
  BoardElement,
  HistoryEntry,
  Point,
  RoomState,
  UserPresence,
  UserRole,
} from "@collab/shared";
import { DEFAULT_ROOM_SETTINGS, pickUserColor } from "@collab/shared";
import type { ClientMessage, ServerMessage } from "@collab/shared";
import type { WebSocket } from "ws";
import { loadRoom, saveRoom, type InternalSettings } from "./persistence.js";
import { hashPin, verifyPin } from "./pin.js";
import {
  clampCoord,
  MAX_STROKE_POINTS,
  MAX_SYNC_BATCH,
  requireTempId,
  sanitizeCommitStrokePoints,
  sanitizeElementId,
  sanitizeElementPatch,
  sanitizeIncrementalStrokePoints,
  sanitizeLaserPoints,
  sanitizeShapeCommit,
  sanitizeStickyCommit,
  sanitizeStrokeStyle,
  sanitizeSyncLastSeq,
  sanitizeTextCommit,
  sanitizeTool,
  sanitizeUserName,
} from "./validate.js";

interface Client {
  ws: WebSocket;
  userId: string;
  userName: string;
  color: string;
  tool: UserPresence["tool"];
  cursor: { x: number; y: number } | null;
  role: UserRole;
}

export class Room {
  readonly roomId: string;
  private clients = new Map<string, Client>();
  private elements = new Map<string, BoardElement>();
  private history: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private seq = 0;
  private seqLog: ServerMessage[] = [];
  private colorIndex = 0;
  private zCounter = 0;
  private settings: InternalSettings = {
    pinHash: null,
    undoPolicy: DEFAULT_ROOM_SETTINGS.undoPolicy,
    maxElements: DEFAULT_ROOM_SETTINGS.maxElements,
  };
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private ownerId: string | null = null;
  private liveStrokeBuf = new Map<
    string,
    {
      strokeId: string;
      userId: string;
      points: Point[];
      color: string;
      width: number;
      penKind?: string;
      eraser?: boolean;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private serializedBroadcast = new Map<ServerMessage, string>();

  private constructor(roomId: string) {
    this.roomId = roomId;
  }

  static async create(roomId: string): Promise<Room> {
    const room = new Room(roomId);
    const saved = await loadRoom(roomId);
    if (saved) {
      room.seq = saved.seq;
      room.settings = saved.settings;
      for (const el of saved.elements) {
        room.elements.set(el.id, el);
        room.zCounter = Math.max(room.zCounter, el.zIndex);
      }
    }
    return room;
  }

  get isEmpty(): boolean {
    return this.clients.size === 0;
  }

  hasPin(): boolean {
    return !!this.settings.pinHash;
  }

  private nextUserId(): string {
    return `u_${crypto.randomUUID().slice(0, 8)}`;
  }

  private nextElementId(): string {
    return `el_${crypto.randomUUID().slice(0, 12)}`;
  }

  private nextZ(): number {
    this.zCounter += 1;
    return this.zCounter;
  }

  private bumpSeq(): number {
    this.seq += 1;
    return this.seq;
  }

  private canEdit(role: UserRole): boolean {
    return role === "owner" || role === "editor";
  }

  private canModifyElement(
    userId: string,
    role: UserRole,
    el: BoardElement
  ): boolean {
    if (role === "owner") return true;
    if (role === "editor") return el.authorId === userId;
    return false;
  }

  private resolveCommitId(tempOrClientId: string): string | null {
    if (!requireTempId(tempOrClientId)) return null;
    return this.nextElementId();
  }

  private serialize(msg: ServerMessage): string {
    let s = this.serializedBroadcast.get(msg);
    if (!s) {
      s = JSON.stringify(msg);
      this.serializedBroadcast.set(msg, s);
      if (this.serializedBroadcast.size > 200) {
        const first = this.serializedBroadcast.keys().next().value;
        if (first) this.serializedBroadcast.delete(first);
      }
    }
    return s;
  }

  private flushLiveStroke(key: string): void {
    const buf = this.liveStrokeBuf.get(key);
    if (!buf) return;
    this.liveStrokeBuf.delete(key);
    const msg: ServerMessage = {
      type: "stroke.live",
      strokeId: buf.strokeId,
      userId: buf.userId,
      points: buf.points,
      color: buf.color,
      width: buf.width,
      ...(buf.penKind ? { penKind: buf.penKind as import("@collab/shared").PenKind } : {}),
      ...(buf.eraser ? { eraser: true } : {}),
    };
    this.broadcastExceptSerialized(buf.userId, [this.serialize(msg)]);
  }

  private queueLiveStroke(
    userId: string,
    data: {
      strokeId: string;
      points: Point[];
      color: string;
      width: number;
      penKind?: string;
      eraser?: boolean;
    }
  ): void {
    const key = `${userId}:${data.strokeId}`;
    let buf = this.liveStrokeBuf.get(key);
    if (!buf) {
      const timer = setTimeout(() => this.flushLiveStroke(key), 48);
      buf = {
        strokeId: data.strokeId,
        userId,
        points: [],
        color: data.color,
        width: data.width,
        penKind: data.penKind,
        eraser: data.eraser,
        timer,
      };
      this.liveStrokeBuf.set(key, buf);
    }
    buf.points.push(...data.points);
    if (buf.points.length > MAX_STROKE_POINTS) {
      buf.points = buf.points.slice(-MAX_STROKE_POINTS);
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      void saveRoom({
        roomId: this.roomId,
        elements: Array.from(this.elements.values()),
        seq: this.seq,
        settings: this.settings,
      });
    }, 800);
  }

  private recordSeq(msg: ServerMessage): void {
    if ("seq" in msg && typeof msg.seq === "number") {
      this.seqLog.push(msg);
      if (this.seqLog.length > 8000) this.seqLog.splice(0, 2000);
    }
  }

  getState(): RoomState {
    return {
      roomId: this.roomId,
      elements: Array.from(this.elements.values()).sort(
        (a, b) => a.zIndex - b.zIndex || a.createdAt - b.createdAt
      ),
      seq: this.seq,
      settings: {
        locked: !!this.settings.pinHash,
        undoPolicy: this.settings.undoPolicy,
        maxElements: this.settings.maxElements,
      },
      users: Array.from(this.clients.values()).map((c) => ({
        id: c.userId,
        name: c.userName,
        color: c.color,
        cursor: c.cursor,
        tool: c.tool,
        role: c.role,
      })),
    };
  }

  join(
    ws: WebSocket,
    userName: string,
    opts: {
      pin?: string;
      setPin?: string;
      requestedRole?: UserRole;
      viewOnly?: boolean;
      pinAllowed?: boolean;
    }
  ): { userId: string; messages: ServerMessage[] } | { error: string } {
    const pinAttempt = opts.pin?.trim() ?? "";
    const setPinAttempt = opts.setPin?.trim() ?? "";

    if (this.settings.pinHash) {
      if (!opts.pinAllowed) {
        return { error: "Çok fazla şifre denemesi. Biraz bekleyin." };
      }
      if (!pinAttempt || !verifyPin(pinAttempt, this.settings.pinHash)) {
        return { error: "Bu oda şifre korumalı. Doğru şifreyi girin." };
      }
    } else if (setPinAttempt && this.clients.size === 0 && !this.settings.pinHash) {
      this.settings.pinHash = hashPin(setPinAttempt.slice(0, 32));
      this.scheduleSave();
    }

    const userId = this.nextUserId();
    const color = pickUserColor(this.colorIndex++);

    let role: UserRole = "editor";
    if (opts.viewOnly) role = "viewer";
    else if (!this.ownerId) {
      this.ownerId = userId;
      role = "owner";
    } else if (opts.requestedRole === "viewer") {
      role = "viewer";
    }

    const client: Client = {
      ws,
      userId,
      userName: sanitizeUserName(userName),
      color,
      tool: "pen",
      cursor: null,
      role,
    };
    this.clients.set(userId, client);

    const joined: ServerMessage = {
      type: "room.joined",
      state: this.getState(),
      userId,
      role,
    };

    const presence: ServerMessage = {
      type: "room.user_joined",
      user: {
        id: userId,
        name: client.userName,
        color,
        cursor: null,
        tool: "pen",
        role,
      },
    };

    this.broadcastExcept(userId, [presence]);
    return {
      userId,
      messages: [joined, ...this.historyFlagsFor(userId)],
    };
  }

  leave(userId: string): void {
    if (!this.clients.has(userId)) return;
    this.clients.delete(userId);
    if (this.ownerId === userId) {
      const next = this.clients.values().next().value;
      this.ownerId = next?.userId ?? null;
      if (next) next.role = "owner";
    }
    this.broadcast([{ type: "room.user_left", userId }]);
    this.scheduleSave();
  }

  handle(userId: string, msg: ClientMessage): ServerMessage[] {
    const client = this.clients.get(userId);
    if (!client) return [];

    switch (msg.type) {
      case "sync.request": {
        const lastSeq = sanitizeSyncLastSeq(msg.lastSeq, this.seq);
        const batch = this.seqLog.filter(
          (m) => "seq" in m && m.seq > lastSeq
        );
        const messages =
          batch.length > MAX_SYNC_BATCH ? batch.slice(0, MAX_SYNC_BATCH) : batch;
        return [{ type: "sync.batch", fromSeq: lastSeq, messages }];
      }
      case "stroke.start":
        return [];
      case "stroke.points":
        if (!this.canEdit(client.role)) return [];
        if (!requireTempId(msg.strokeId)) return [];
        {
          const st = sanitizeStrokeStyle(
            msg.color,
            msg.width,
            msg.penKind,
            msg.eraser
          );
          this.queueLiveStroke(userId, {
            strokeId: msg.strokeId,
            points: sanitizeIncrementalStrokePoints(msg.points),
            color: st.color,
            width: st.width,
            penKind: st.penKind,
            eraser: st.eraser,
          });
        }
        return [];
      case "stroke.end": {
        if (!this.canEdit(client.role)) return [];
        const flushKey = `${userId}:${msg.strokeId}`;
        if (this.liveStrokeBuf.has(flushKey)) this.flushLiveStroke(flushKey);
        const id = this.resolveCommitId(msg.strokeId);
        if (!id) return [];
        const st = sanitizeStrokeStyle(
          msg.color,
          msg.width,
          msg.penKind,
          msg.eraser
        );
        const el: BoardElement = {
          id,
          type: "stroke",
          authorId: userId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          zIndex: this.nextZ(),
          points: sanitizeCommitStrokePoints(msg.points),
          color: st.color,
          width: st.width,
          penKind: st.penKind,
          eraser: st.eraser,
        };
        return this.addElement(userId, el);
      }
      case "shape.commit": {
        if (!this.canEdit(client.role)) return [];
        const id = this.resolveCommitId(msg.tempId);
        if (!id) return [];
        const sh = sanitizeShapeCommit(msg);
        if (!sh) return [];
        const el: BoardElement = {
          id,
          type: sh.shapeType,
          authorId: userId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          zIndex: this.nextZ(),
          x: sh.x,
          y: sh.y,
          width: sh.width,
          height: sh.height,
          color: sh.color,
          strokeWidth: sh.strokeWidth,
          fill: sh.fill,
        };
        return this.addElement(userId, el);
      }
      case "text.commit": {
        if (!this.canEdit(client.role)) return [];
        const id = this.resolveCommitId(msg.tempId);
        if (!id) return [];
        const tx = sanitizeTextCommit(msg);
        const el: BoardElement = {
          id,
          type: "text",
          authorId: userId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          zIndex: this.nextZ(),
          x: tx.x,
          y: tx.y,
          width: tx.width,
          height: tx.height,
          content: tx.content,
          color: tx.color,
          fontSize: tx.fontSize,
        };
        return this.addElement(userId, el);
      }
      case "sticky.commit": {
        if (!this.canEdit(client.role)) return [];
        const id = this.resolveCommitId(msg.tempId);
        if (!id) return [];
        const st = sanitizeStickyCommit(msg);
        const el: BoardElement = {
          id,
          type: "sticky",
          authorId: userId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          zIndex: this.nextZ(),
          x: st.x,
          y: st.y,
          width: st.width,
          height: st.height,
          content: st.content,
          color: st.color,
        };
        return this.addElement(userId, el);
      }
      case "element.update": {
        if (!this.canEdit(client.role)) return [];
        const eid = sanitizeElementId(msg.elementId);
        if (!eid) return [];
        const existing = this.elements.get(eid);
        if (!existing || !this.canModifyElement(userId, client.role, existing))
          return [];
        const patch = sanitizeElementPatch(existing, msg.patch);
        if (!patch) return [];
        const updated = {
          ...existing,
          ...patch,
          updatedAt: Date.now(),
        } as BoardElement;
        return this.updateElement(userId, updated);
      }
      case "element.delete": {
        if (!this.canEdit(client.role)) return [];
        const eid = sanitizeElementId(msg.elementId);
        if (!eid) return [];
        const existing = this.elements.get(eid);
        if (!existing || !this.canModifyElement(userId, client.role, existing))
          return [];
        return this.deleteElement(userId, eid);
      }
      case "element.layer": {
        if (!this.canEdit(client.role)) return [];
        const eid = sanitizeElementId(msg.elementId);
        if (!eid) return [];
        const el = this.elements.get(eid);
        if (!el || !this.canModifyElement(userId, client.role, el)) return [];
        if (msg.action !== "front" && msg.action !== "back") return [];
        if (msg.action === "front") el.zIndex = this.nextZ();
        else el.zIndex = 0;
        return this.updateElement(userId, { ...el, updatedAt: Date.now() });
      }
      case "laser.move": {
        if (!this.canEdit(client.role)) return [];
        this.broadcastExcept(userId, [
          {
            type: "laser.live",
            userId,
            points: sanitizeLaserPoints(msg.points),
            color: client.color,
          },
        ]);
        return [];
      }
      case "cursor.move": {
        if (client.role === "viewer") return [];
        if (!Number.isFinite(msg.x) || !Number.isFinite(msg.y)) return [];
        client.cursor = { x: clampCoord(msg.x), y: clampCoord(msg.y) };
        const presence: ServerMessage = {
          type: "presence.update",
          user: this.presence(client),
        };
        this.broadcastExceptSerialized(userId, [this.serialize(presence)]);
        return [];
      }
      case "cursor.leave": {
        client.cursor = null;
        this.broadcastExcept(userId, [
          { type: "presence.update", user: this.presence(client) },
        ]);
        return [];
      }
      case "tool.change": {
        const t = sanitizeTool(msg.tool);
        if (!t) return [];
        client.tool = t;
        return [];
      }
      case "history.undo":
        if (!this.canEdit(client.role)) return [];
        return this.undo(userId);
      case "history.redo":
        if (!this.canEdit(client.role)) return [];
        return this.redo(userId);
      case "room.clear":
        if (client.role !== "owner") return [];
        return this.clearBoard(userId);
      default:
        return [];
    }
  }

  private clearBoard(userId: string): ServerMessage[] {
    this.elements.clear();
    this.history = [];
    this.redoStack = [];
    const seq = this.bumpSeq();
    this.scheduleSave();
    const messages: ServerMessage[] = [
      { type: "room.cleared", seq, userId },
      ...this.historyFlagsFor(userId),
    ];
    this.broadcast(messages);
    return messages;
  }

  private presence(c: Client): UserPresence {
    return {
      id: c.userId,
      name: c.userName,
      color: c.color,
      cursor: c.cursor,
      tool: c.tool,
      role: c.role,
    };
  }

  private addElement(userId: string, el: BoardElement): ServerMessage[] {
    if (this.elements.size >= this.settings.maxElements) return [];
    this.elements.set(el.id, el);
    const seq = this.bumpSeq();
    this.history.push({
      seq,
      action: "add",
      elementId: el.id,
      before: null,
      after: structuredClone(el),
      userId,
      timestamp: Date.now(),
    });
    this.redoStack = [];
    const out: ServerMessage = {
      type: "element.added",
      seq,
      element: el,
      userId,
    };
    this.recordSeq(out);
    this.broadcast([out]);
    this.sendHistoryFlags();
    this.scheduleSave();
    return [out];
  }

  private updateElement(userId: string, el: BoardElement): ServerMessage[] {
    const before = this.elements.get(el.id);
    if (!before) return [];
    this.elements.set(el.id, el);
    const seq = this.bumpSeq();
    this.history.push({
      seq,
      action: "update",
      elementId: el.id,
      before: structuredClone(before),
      after: structuredClone(el),
      userId,
      timestamp: Date.now(),
    });
    this.redoStack = [];
    const out: ServerMessage = {
      type: "element.updated",
      seq,
      element: el,
      userId,
    };
    this.recordSeq(out);
    this.broadcast([out]);
    this.sendHistoryFlags();
    this.scheduleSave();
    return [out];
  }

  private deleteElement(userId: string, elementId: string): ServerMessage[] {
    const before = this.elements.get(elementId);
    if (!before) return [];
    this.elements.delete(elementId);
    const seq = this.bumpSeq();
    this.history.push({
      seq,
      action: "delete",
      elementId,
      before: structuredClone(before),
      after: null,
      userId,
      timestamp: Date.now(),
    });
    this.redoStack = [];
    const out: ServerMessage = {
      type: "element.deleted",
      seq,
      elementId,
      userId,
    };
    this.recordSeq(out);
    this.broadcast([out]);
    this.sendHistoryFlags();
    this.scheduleSave();
    return [out];
  }

  private sendHistoryFlags(): void {
    for (const c of this.clients.values()) {
      for (const m of this.historyFlagsFor(c.userId)) {
        this.send(c.ws, m);
      }
    }
  }

  private undo(userId: string): ServerMessage[] {
    const entry =
      this.settings.undoPolicy === "global"
        ? this.history[this.history.length - 1]
        : [...this.history].reverse().find((e) => e.userId === userId);
    if (!entry) {
      this.sendHistoryFlags();
      return [];
    }
    this.history = this.history.filter((e) => e !== entry);
    this.redoStack.push(entry);
    const messages = this.applyHistoryInverse(entry);
    for (const m of messages) this.recordSeq(m);
    this.broadcast(messages);
    this.sendHistoryFlags();
    this.scheduleSave();
    return messages;
  }

  private redo(userId: string): ServerMessage[] {
    const entry =
      this.settings.undoPolicy === "global"
        ? this.redoStack[this.redoStack.length - 1]
        : [...this.redoStack].reverse().find((e) => e.userId === userId);
    if (!entry) {
      this.sendHistoryFlags();
      return [];
    }
    this.redoStack = this.redoStack.filter((e) => e !== entry);
    this.history.push(entry);
    const messages = this.applyHistoryForward(entry);
    for (const m of messages) this.recordSeq(m);
    this.broadcast(messages);
    this.sendHistoryFlags();
    this.scheduleSave();
    return messages;
  }

  private applyHistoryInverse(entry: HistoryEntry): ServerMessage[] {
    const seq = this.bumpSeq();
    if (entry.action === "add" && entry.after) {
      this.elements.delete(entry.elementId);
      return [
        {
          type: "element.deleted",
          seq,
          elementId: entry.elementId,
          userId: entry.userId,
        },
      ];
    }
    if (entry.action === "delete" && entry.before) {
      this.elements.set(entry.elementId, entry.before);
      return [
        {
          type: "element.added",
          seq,
          element: entry.before,
          userId: entry.userId,
        },
      ];
    }
    if (entry.action === "update" && entry.before) {
      this.elements.set(entry.elementId, entry.before);
      return [
        {
          type: "element.updated",
          seq,
          element: entry.before,
          userId: entry.userId,
        },
      ];
    }
    return [];
  }

  private applyHistoryForward(entry: HistoryEntry): ServerMessage[] {
    const seq = this.bumpSeq();
    if (entry.action === "add" && entry.after) {
      this.elements.set(entry.elementId, entry.after);
      return [
        {
          type: "element.added",
          seq,
          element: entry.after,
          userId: entry.userId,
        },
      ];
    }
    if (entry.action === "delete" && entry.before) {
      this.elements.delete(entry.elementId);
      return [
        {
          type: "element.deleted",
          seq,
          elementId: entry.elementId,
          userId: entry.userId,
        },
      ];
    }
    if (entry.action === "update" && entry.after) {
      this.elements.set(entry.elementId, entry.after);
      return [
        {
          type: "element.updated",
          seq,
          element: entry.after,
          userId: entry.userId,
        },
      ];
    }
    return [];
  }

  private historyFlagsFor(userId: string): ServerMessage[] {
    const canUndo =
      this.settings.undoPolicy === "global"
        ? this.history.length > 0
        : this.history.some((e) => e.userId === userId);
    const canRedo =
      this.settings.undoPolicy === "global"
        ? this.redoStack.length > 0
        : this.redoStack.some((e) => e.userId === userId);
    return [{ type: "history.changed", canUndo, canRedo }];
  }

  private broadcast(messages: ServerMessage[]): void {
    const payloads = messages.map((m) => this.serialize(m));
    for (const c of this.clients.values()) {
      for (const p of payloads) this.sendRaw(c.ws, p);
    }
  }

  private broadcastExcept(userId: string, messages: ServerMessage[]): void {
    const payloads = messages.map((m) => this.serialize(m));
    this.broadcastExceptSerialized(userId, payloads);
  }

  private broadcastExceptSerialized(userId: string, payloads: string[]): void {
    for (const c of this.clients.values()) {
      if (c.userId === userId) continue;
      for (const p of payloads) this.sendRaw(c.ws, p);
    }
  }

  private send(ws: WebSocket, message: ServerMessage): void {
    this.sendRaw(ws, this.serialize(message));
  }

  private sendRaw(ws: WebSocket, payload: string): void {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  }
}

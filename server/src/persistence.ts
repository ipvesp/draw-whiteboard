import { mkdir, readFile, writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { BoardElement, UndoPolicy } from "@collab/shared";
import { DEFAULT_ROOM_SETTINGS } from "@collab/shared";
import { migratePlainPin } from "./pin.js";

const DATA_DIR =
  process.env.DATA_DIR ??
  join(dirname(fileURLToPath(import.meta.url)), "../../data/rooms");

const MAX_ELEMENTS_CAP = 5000;

export interface PersistedRoomSettings {
  pinHash?: string | null;
  /** Eski kayıtlar — yüklemede hash'e çevrilir */
  pin?: string | null;
  undoPolicy: UndoPolicy;
  maxElements: number;
}

export interface PersistedRoom {
  roomId: string;
  elements: BoardElement[];
  seq: number;
  settings: PersistedRoomSettings;
  updatedAt: number;
}

export interface InternalSettings {
  pinHash: string | null;
  undoPolicy: UndoPolicy;
  maxElements: number;
}

let dirReady = false;

async function ensureDir() {
  if (!dirReady) {
    await mkdir(DATA_DIR, { recursive: true });
    dirReady = true;
  }
}

function roomPath(roomId: string) {
  const safe = roomId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return join(DATA_DIR, `${safe}.json`);
}

function normalizeSettings(raw: Partial<PersistedRoomSettings>): InternalSettings {
  const pinHash = migratePlainPin(raw);
  const maxElements = Math.min(
    MAX_ELEMENTS_CAP,
    Math.max(100, Number(raw.maxElements) || DEFAULT_ROOM_SETTINGS.maxElements)
  );
  return {
    pinHash,
    undoPolicy: raw.undoPolicy ?? DEFAULT_ROOM_SETTINGS.undoPolicy,
    maxElements,
  };
}

export async function loadRoom(roomId: string): Promise<{
  elements: BoardElement[];
  seq: number;
  settings: InternalSettings;
} | null> {
  await ensureDir();
  try {
    const raw = await readFile(roomPath(roomId), "utf-8");
    const data = JSON.parse(raw) as PersistedRoom;
    return {
      seq: data.seq ?? 0,
      settings: normalizeSettings(data.settings ?? {}),
      elements: data.elements.map((el, i) => ({
        ...el,
        zIndex: el.zIndex ?? i,
      })),
    };
  } catch {
    return null;
  }
}

export async function saveRoom(data: {
  roomId: string;
  elements: BoardElement[];
  seq: number;
  settings: InternalSettings;
}): Promise<void> {
  await ensureDir();
  const payload: PersistedRoom = {
    roomId: data.roomId,
    elements: data.elements,
    seq: data.seq,
    settings: {
      pinHash: data.settings.pinHash,
      undoPolicy: data.settings.undoPolicy,
      maxElements: data.settings.maxElements,
    },
    updatedAt: Date.now(),
  };
  await writeFile(roomPath(data.roomId), JSON.stringify(payload), "utf-8");
}

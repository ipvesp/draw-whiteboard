import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { join, dirname, normalize } from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import type { ClientMessage, ServerMessage } from "@collab/shared";
import { Room } from "./room.js";
import { allowPinAttempt, allowWsMessage } from "./rateLimit.js";
import { MAX_WS_BYTES } from "./validate.js";

const PORT = Number(process.env.PORT) || 3001;
const rooms = new Map<string, Promise<Room>>();
const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDist = join(__dirname, "../../client/dist");

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** Sadece geliştirme / özel dağıtım: köken kontrolünü kapatır (bilinçli risk). */
const WS_ALLOW_INSECURE = process.env.WS_ALLOW_INSECURE === "1";

/** Aynı IP’den eşzamanlı WS üst sınırı (DoS / çoklu sekme) */
const MAX_WS_PER_IP = Number(process.env.MAX_WS_PER_IP) || 48;

const ipConn = new Map<string, number>();

async function getOrCreateRoom(roomId: string): Promise<Room> {
  let pending = rooms.get(roomId);
  if (!pending) {
    pending = Room.create(roomId);
    rooms.set(roomId, pending);
  }
  return pending;
}

function parseMessage(data: unknown): ClientMessage | null {
  try {
    const raw = String(data);
    if (raw.length > MAX_WS_BYTES) return null;
    const msg = JSON.parse(raw) as ClientMessage;
    if (msg && typeof msg === "object" && "type" in msg && typeof msg.type === "string") {
      return msg;
    }
  } catch {
    /* invalid */
  }
  return null;
}

function safeStaticPath(urlPath: string): string | null {
  const decoded = decodeURIComponent(urlPath.split("?")[0] ?? "");
  const rel = decoded.replace(/^\/+/, "");
  if (!rel || rel.includes("..")) return null;
  const abs = normalize(join(clientDist, rel));
  if (!abs.startsWith(normalize(clientDist))) return null;
  return abs;
}

function originAllowed(origin: string | undefined): boolean {
  if (WS_ALLOW_INSECURE) return true;
  if (ALLOWED_ORIGINS.length > 0) {
    if (!origin) return false;
    return ALLOWED_ORIGINS.includes(origin);
  }
  if (!origin) return false;
  try {
    const u = new URL(origin);
    const h = u.hostname;
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
  } catch {
    return false;
  }
}

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.url === "/" || req.url?.startsWith("/assets")) {
    const file =
      req.url === "/"
        ? join(clientDist, "index.html")
        : safeStaticPath(req.url);
    if (file && existsSync(file)) {
      const ext = file.split(".").pop();
      const types: Record<string, string> = {
        html: "text/html",
        js: "application/javascript",
        css: "text/css",
        svg: "image/svg+xml",
      };
      res.writeHead(200, { "Content-Type": types[ext ?? ""] ?? "text/plain" });
      res.end(readFileSync(file));
      return;
    }
  }

  res.writeHead(404);
  res.end("Not found");
});

const wss = new WebSocketServer({
  server: httpServer,
  maxPayload: MAX_WS_BYTES,
  verifyClient: ({ origin }, cb) => {
    cb(originAllowed(origin));
  },
});

interface SocketMeta {
  roomId: string | null;
  userId: string | null;
  joinKey: string;
}

const meta = new WeakMap<WebSocket, SocketMeta>();
let anonCounter = 0;

function socketKey(ws: WebSocket, m: SocketMeta): string {
  return m.userId ?? m.joinKey;
}

wss.on("connection", (ws, req) => {
  const ip = req.socket.remoteAddress ?? "unknown";
  const next = (ipConn.get(ip) ?? 0) + 1;
  if (next > MAX_WS_PER_IP) {
    ws.close(1008, "Too many connections");
    return;
  }
  ipConn.set(ip, next);
  ws.on("close", async () => {
    const v = (ipConn.get(ip) ?? 1) - 1;
    if (v <= 0) ipConn.delete(ip);
    else ipConn.set(ip, v);

    const m = meta.get(ws);
    if (m?.roomId && m.userId) {
      const room = await rooms.get(m.roomId);
      room?.leave(m.userId);
    }
  });

  const joinKey = `anon_${++anonCounter}`;
  meta.set(ws, { roomId: null, userId: null, joinKey });

  ws.on("message", async (raw) => {
    const m = meta.get(ws)!;
    const msg = parseMessage(raw);
    if (!msg) return;
    if (!allowWsMessage(socketKey(ws, m), msg.type)) return;

    if (msg.type === "room.join") {
      const roomId = msg.roomId.trim().slice(0, 64) || "lobby";

      if (m.roomId && m.userId) {
        const prev = await rooms.get(m.roomId);
        prev?.leave(m.userId);
      }

      const room = await getOrCreateRoom(roomId);
      const pinKey = `${roomId}:${req.socket.remoteAddress ?? "local"}`;
      const needsPin = await room.hasPin();
      const pinAllowed = !needsPin || allowPinAttempt(pinKey);

      const result = room.join(ws, msg.userName, {
        pin: msg.pin,
        setPin: msg.setPin,
        requestedRole: msg.role,
        viewOnly: msg.role === "viewer",
        pinAllowed,
      });

      if ("error" in result) {
        const err: ServerMessage = { type: "room.error", message: result.error };
        ws.send(JSON.stringify(err));
        return;
      }

      m.roomId = roomId;
      m.userId = result.userId;
      for (const out of result.messages) {
        ws.send(JSON.stringify(out));
      }
      return;
    }

    if (msg.type === "room.leave") {
      if (m.roomId && m.userId) {
        const room = await rooms.get(m.roomId);
        room?.leave(m.userId);
        m.roomId = null;
        m.userId = null;
      }
      return;
    }

    if (!m.roomId || !m.userId) {
      ws.send(
        JSON.stringify({
          type: "room.error",
          message: "Join a room first",
        } satisfies ServerMessage)
      );
      return;
    }

    const roomPromise = rooms.get(m.roomId);
    if (!roomPromise) return;
    const room = await roomPromise;

    const responses = room.handle(m.userId, msg);
    for (const out of responses) {
      ws.send(JSON.stringify(out));
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Draw Whiteboard server on http://localhost:${PORT}`);
});

const buckets = new Map<string, { count: number; reset: number }>();

const WINDOW_MS = 1000;
/** Yüksek frekans: imleç, canlı çizgi noktaları, lazer */
const MAX_LIGHT_PER_WINDOW = 220;
/** Diğer tüm WS mesajları */
const MAX_HEAVY_PER_WINDOW = 80;
const MAX_PIN_ATTEMPTS = 8;
const PIN_WINDOW_MS = 60_000;

const LIGHT_WS_TYPES = new Set([
  "cursor.move",
  "cursor.leave",
  "stroke.points",
  "stroke.start",
  "laser.move",
]);

export function allowWsMessage(clientKey: string, msgType: string): boolean {
  if (LIGHT_WS_TYPES.has(msgType)) {
    return allowInWindow(`light:${clientKey}`, MAX_LIGHT_PER_WINDOW, WINDOW_MS);
  }
  return allowInWindow(`heavy:${clientKey}`, MAX_HEAVY_PER_WINDOW, WINDOW_MS);
}

export function allowPinAttempt(roomKey: string): boolean {
  return allowInWindow(`pin:${roomKey}`, MAX_PIN_ATTEMPTS, PIN_WINDOW_MS);
}

function allowInWindow(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now > b.reset) {
    b = { count: 0, reset: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  return b.count <= max;
}

/** Eski bucket girişlerini ara sıra temizle */
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (now > b.reset) buckets.delete(k);
  }
}, 120_000).unref();

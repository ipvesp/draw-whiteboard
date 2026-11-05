import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEY_LEN = 32;

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, KEY_LEN);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const sep = stored.indexOf(":");
  if (sep < 1) return false;
  try {
    const salt = Buffer.from(stored.slice(0, sep), "hex");
    const expected = Buffer.from(stored.slice(sep + 1), "hex");
    if (expected.length !== KEY_LEN) return false;
    const hash = scryptSync(pin, salt, KEY_LEN);
    return timingSafeEqual(hash, expected);
  } catch {
    return false;
  }
}

/** Eski düz metin PIN kayıtlarını hash'e taşır */
export function migratePlainPin(
  settings: { pin?: string | null; pinHash?: string | null }
): string | null {
  if (settings.pinHash) return settings.pinHash;
  if (settings.pin) return hashPin(settings.pin);
  return null;
}

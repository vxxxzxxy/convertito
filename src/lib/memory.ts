const MB = 1024 * 1024;
const MP = 1_000_000;

export const LIMITS = {
  warnBytes: 50 * MB,
  blockBytes: 200 * MB,
  warnPixels: 50 * MP,
  blockPixels: 200 * MP,
} as const;

export type CheckLevel = 'ok' | 'warn' | 'block';

export interface MemoryCheck {
  level: CheckLevel;
  reason?: string;
}

interface NavigatorWithDeviceMemory extends Navigator {
  /** Approximate device RAM in GB. Chromium-only, undefined elsewhere. */
  deviceMemory?: number;
}

/**
 * Returns 0.5 on low-memory devices (navigator.deviceMemory < 4) so the
 * thresholds tighten on phones, otherwise 1. Falls back to 1 when the API
 * isn't available (Firefox / Safari).
 */
function memoryFactor(): number {
  if (typeof navigator === 'undefined') return 1;
  const dm = (navigator as NavigatorWithDeviceMemory).deviceMemory;
  return typeof dm === 'number' && dm < 4 ? 0.5 : 1;
}

export function checkFileSize(bytes: number): MemoryCheck {
  const factor = memoryFactor();
  const warn = LIMITS.warnBytes * factor;
  const block = LIMITS.blockBytes * factor;
  if (bytes > block) {
    return {
      level: 'block',
      reason: `Archivo demasiado grande (${(bytes / MB).toFixed(0)} MB > ${(block / MB).toFixed(0)} MB).`,
    };
  }
  if (bytes > warn) {
    return {
      level: 'warn',
      reason: `Archivo grande (${(bytes / MB).toFixed(0)} MB) — la conversión puede ser lenta.`,
    };
  }
  return { level: 'ok' };
}

export function checkPixelCount(width: number, height: number): MemoryCheck {
  const factor = memoryFactor();
  const warn = LIMITS.warnPixels * factor;
  const block = LIMITS.blockPixels * factor;
  const pixels = width * height;
  if (pixels > block) {
    return {
      level: 'block',
      reason: `Imagen demasiado grande (${(pixels / MP).toFixed(0)} MP > ${(block / MP).toFixed(0)} MP).`,
    };
  }
  if (pixels > warn) {
    return {
      level: 'warn',
      reason: `Imagen grande (${(pixels / MP).toFixed(0)} MP) — la conversión puede ser lenta.`,
    };
  }
  return { level: 'ok' };
}

/** Combine multiple checks; the worst level wins, reasons concatenated. */
export function combine(...checks: MemoryCheck[]): MemoryCheck {
  const order: Record<CheckLevel, number> = { ok: 0, warn: 1, block: 2 };
  let worst: MemoryCheck = { level: 'ok' };
  const reasons: string[] = [];
  for (const c of checks) {
    if (c.reason) reasons.push(c.reason);
    if (order[c.level] > order[worst.level]) worst = c;
  }
  return reasons.length === 0
    ? worst
    : { level: worst.level, reason: reasons.join(' ') };
}

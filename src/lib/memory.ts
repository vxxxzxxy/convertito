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

/**
 * Result of parsing an SVG root tag:
 * - `absolute`: the author declared `width` and `height` in resolvable units
 *   (px, cm, mm, in, pt, pc). Convert intent: render at exactly that size.
 * - `viewBox`: only `viewBox` was usable (e.g. `width="100%"`). The author
 *   delegated absolute size to a containing element that doesn't exist when
 *   we rasterize. The viewBox values define the aspect ratio, not pixels.
 *
 * Returning `null` means the root tag has neither resolvable dims nor
 * viewBox — without those, any rasterization size is a guess and we should
 * surface the ambiguity to the user.
 */
export type SvgDimensions =
  | { kind: 'absolute'; width: number; height: number }
  | { kind: 'viewBox'; width: number; height: number };

/**
 * Inspect an SVG document and report whether the author declared an
 * absolute size or only a viewBox. Used by the SVG decoder to decide
 * between rendering at the declared size (with a safety clamp) versus
 * picking a reasonable web default.
 *
 * Width/height with units (`10cm`, `200pt`) are normalized to CSS pixels.
 * Percent units (`100%`) and missing attributes count as "no absolute size"
 * and fall through to viewBox.
 */
export function analyzeSvgDimensions(svgText: string): SvgDimensions | null {
  const tag = svgText.match(/<svg\b[^>]*>/i)?.[0];
  if (!tag) return null;
  const w = readDim(tag, 'width');
  const h = readDim(tag, 'height');
  if (w !== null && h !== null) return { kind: 'absolute', width: w, height: h };
  const vb = tag.match(
    /viewBox\s*=\s*["']\s*[\d.\-]+\s+[\d.\-]+\s+([\d.]+)\s+([\d.]+)/i,
  );
  if (vb) {
    return {
      kind: 'viewBox',
      width: Math.round(Number(vb[1])),
      height: Math.round(Number(vb[2])),
    };
  }
  return null;
}

function readDim(tag: string, attr: 'width' | 'height'): number | null {
  const match = tag.match(new RegExp(`\\b${attr}\\s*=\\s*["']?\\s*([\\d.]+)\\s*([a-z%]*)`, 'i'));
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = match[2]?.toLowerCase() ?? '';
  const factor = SVG_UNIT_FACTORS[unit];
  if (factor === undefined) return null;
  return Math.round(value * factor);
}

const SVG_UNIT_FACTORS: Record<string, number> = {
  '': 1,
  px: 1,
  in: 96,
  cm: 37.795,
  mm: 3.7795,
  pt: 1.3333,
  pc: 16,
};

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

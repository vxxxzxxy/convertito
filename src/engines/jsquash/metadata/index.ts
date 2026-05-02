/**
 * Metadata pipeline for jsquash.
 *
 * jsquash decoders strip EXIF and ICC profiles silently — without intervention,
 * phone photos lose orientation and wide-gamut images shift colors. We wrap the
 * decode step with `extractMetadata` and the encode step with `injectMetadata`.
 *
 * EXIF orientation is **applied to the pixel buffer** during decode so the
 * encoded output is always orientation = 1. The `orientation` tag in the
 * preserved EXIF is rewritten to 1 before injection so viewers don't double-rotate.
 *
 * Format coverage in v1:
 * - JPEG, PNG, WebP — full extract + inject of EXIF, ICC, and XMP.
 * - AVIF, JXL — orientation only (others are documented limitations).
 */

import { extractFromJpeg, injectIntoJpeg } from './jpeg';
import { extractFromPng, injectIntoPng } from './png';
import { extractFromWebp, injectIntoWebp } from './webp';

export interface ExtractedMetadata {
  /** EXIF orientation 1..8 found in source. Treated as 1 when absent. */
  orientation?: number;
  /** Raw TIFF-formatted EXIF bytes (starts with `II*\0` or `MM\0*`). */
  exif?: Uint8Array;
  /** Raw ICC profile bytes (uncompressed). */
  iccProfile?: Uint8Array;
  /** Raw XMP XML bytes (no UTF-8 BOM). */
  xmp?: Uint8Array;
}

const EMPTY: ExtractedMetadata = { orientation: 1 };

export async function extractMetadata(bytes: ArrayBuffer, mime: string): Promise<ExtractedMetadata> {
  const u8 = new Uint8Array(bytes);
  switch (mime) {
    case 'image/jpeg':
    case 'image/jpg':
      return extractFromJpeg(u8);
    case 'image/png':
      return extractFromPng(u8);
    case 'image/webp':
      return extractFromWebp(u8);
    default:
      return EMPTY;
  }
}

export async function injectMetadata(
  encoded: ArrayBuffer,
  metadata: ExtractedMetadata,
  targetMime: string,
): Promise<ArrayBuffer> {
  if (!metadata.exif && !metadata.iccProfile && !metadata.xmp) {
    return encoded;
  }
  // Pixels are already upright; rewrite the orientation tag to 1 so viewers
  // don't apply it again on top of our rotated output.
  const sanitized = stripOrientationFromExif(metadata);
  const u8 = new Uint8Array(encoded);
  switch (targetMime) {
    case 'image/jpeg':
    case 'image/jpg':
      return injectIntoJpeg(u8, sanitized).buffer as ArrayBuffer;
    case 'image/png':
      return (await injectIntoPng(u8, sanitized)).buffer as ArrayBuffer;
    case 'image/webp':
      return injectIntoWebp(u8, sanitized).buffer as ArrayBuffer;
    default:
      return encoded;
  }
}

/**
 * Apply an EXIF orientation (1..8) to an ImageData buffer, returning a new
 * ImageData with pixels physically rotated/flipped so callers can treat it as
 * orientation = 1.
 *
 * Reference: EXIF 2.32 §4.6.4, tag 0x0112.
 */
export function applyOrientationToPixels(pixels: ImageData, orientation: number): ImageData {
  if (orientation <= 1 || orientation > 8) return pixels;
  const { width: srcW, height: srcH, data: srcData } = pixels;
  // Orientations 5..8 transpose width/height.
  const swap = orientation >= 5;
  const dstW = swap ? srcH : srcW;
  const dstH = swap ? srcW : srcH;
  const dstData = new Uint8ClampedArray(dstW * dstH * 4);

  for (let y = 0; y < srcH; y++) {
    for (let x = 0; x < srcW; x++) {
      let dx: number;
      let dy: number;
      switch (orientation) {
        case 2: // flip horizontal
          dx = srcW - 1 - x; dy = y; break;
        case 3: // rotate 180
          dx = srcW - 1 - x; dy = srcH - 1 - y; break;
        case 4: // flip vertical
          dx = x; dy = srcH - 1 - y; break;
        case 5: // transpose (top-left ↔ bottom-right diagonal)
          dx = y; dy = x; break;
        case 6: // rotate 90 CW
          dx = srcH - 1 - y; dy = x; break;
        case 7: // transverse (top-right ↔ bottom-left diagonal)
          dx = srcH - 1 - y; dy = srcW - 1 - x; break;
        case 8: // rotate 90 CCW
          dx = y; dy = srcW - 1 - x; break;
        default:
          dx = x; dy = y;
      }
      const srcIdx = (y * srcW + x) * 4;
      const dstIdx = (dy * dstW + dx) * 4;
      dstData[dstIdx] = srcData[srcIdx]!;
      dstData[dstIdx + 1] = srcData[srcIdx + 1]!;
      dstData[dstIdx + 2] = srcData[srcIdx + 2]!;
      dstData[dstIdx + 3] = srcData[srcIdx + 3]!;
    }
  }
  return new ImageData(dstData, dstW, dstH);
}

function stripOrientationFromExif(metadata: ExtractedMetadata): ExtractedMetadata {
  if (!metadata.exif) return metadata;
  const rewritten = rewriteExifOrientation(metadata.exif, 1);
  return { ...metadata, exif: rewritten };
}

/**
 * Walk an EXIF TIFF block and overwrite the orientation tag (0x0112) value
 * to `newValue`. Operates on a copy. If the tag is not present the buffer is
 * returned unchanged.
 *
 * EXIF layout: TIFF header (8 bytes) — byte-order mark "II" or "MM",
 * magic 0x002A, IFD0 offset (4 bytes). Then each IFD: 2-byte entry count,
 * then 12-byte entries (tag, type, count, value/offset).
 */
function rewriteExifOrientation(exif: Uint8Array, newValue: number): Uint8Array {
  if (exif.length < 8) return exif;
  const out = exif.slice();
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  const isLE = exif[0] === 0x49 && exif[1] === 0x49;
  const magic = view.getUint16(2, isLE);
  if (magic !== 0x002a) return exif;
  const ifd0Offset = view.getUint32(4, isLE);
  if (ifd0Offset + 2 > exif.length) return exif;
  const count = view.getUint16(ifd0Offset, isLE);
  for (let i = 0; i < count; i++) {
    const entryOffset = ifd0Offset + 2 + i * 12;
    if (entryOffset + 12 > exif.length) break;
    const tag = view.getUint16(entryOffset, isLE);
    if (tag === 0x0112) {
      // type=SHORT(3), count=1; value lives in the first 2 bytes of the value field at offset+8.
      view.setUint16(entryOffset + 8, newValue, isLE);
      return out;
    }
  }
  return exif;
}

/** Read EXIF orientation tag value (1..8). Returns 1 when absent or malformed. */
export function readOrientationFromExif(exif: Uint8Array | undefined): number {
  if (!exif || exif.length < 8) return 1;
  const view = new DataView(exif.buffer, exif.byteOffset, exif.byteLength);
  const isLE = exif[0] === 0x49 && exif[1] === 0x49;
  if (view.getUint16(2, isLE) !== 0x002a) return 1;
  const ifd0Offset = view.getUint32(4, isLE);
  if (ifd0Offset + 2 > exif.length) return 1;
  const count = view.getUint16(ifd0Offset, isLE);
  for (let i = 0; i < count; i++) {
    const entryOffset = ifd0Offset + 2 + i * 12;
    if (entryOffset + 12 > exif.length) break;
    if (view.getUint16(entryOffset, isLE) === 0x0112) {
      const value = view.getUint16(entryOffset + 8, isLE);
      return value >= 1 && value <= 8 ? value : 1;
    }
  }
  return 1;
}

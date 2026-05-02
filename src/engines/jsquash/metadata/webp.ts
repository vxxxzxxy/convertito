import type { ExtractedMetadata } from './index';
import { readOrientationFromExif } from './index';

const RIFF = encodeAscii('RIFF');
const WEBP = encodeAscii('WEBP');

interface RiffChunk {
  id: string;
  data: Uint8Array;
}

function parseRiff(bytes: Uint8Array): RiffChunk[] | null {
  if (bytes.length < 12) return null;
  for (let i = 0; i < 4; i++) if (bytes[i] !== RIFF[i]) return null;
  for (let i = 0; i < 4; i++) if (bytes[8 + i] !== WEBP[i]) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: RiffChunk[] = [];
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = decodeAscii(bytes.subarray(offset, offset + 4));
    const size = view.getUint32(offset + 4, true);
    if (offset + 8 + size > bytes.length) break;
    chunks.push({ id, data: bytes.subarray(offset + 8, offset + 8 + size) });
    // Each chunk is padded to even length.
    offset += 8 + size + (size & 1);
  }
  return chunks;
}

export function extractFromWebp(bytes: Uint8Array): ExtractedMetadata {
  const chunks = parseRiff(bytes);
  if (!chunks) return { orientation: 1 };
  let exif: Uint8Array | undefined;
  let iccProfile: Uint8Array | undefined;
  let xmp: Uint8Array | undefined;
  for (const chunk of chunks) {
    if (chunk.id === 'EXIF' && !exif) exif = chunk.data.slice();
    else if (chunk.id === 'ICCP' && !iccProfile) iccProfile = chunk.data.slice();
    else if (chunk.id === 'XMP ' && !xmp) xmp = chunk.data.slice();
  }
  return {
    orientation: readOrientationFromExif(exif),
    exif,
    iccProfile,
    xmp,
  };
}

interface CanvasDims {
  width: number;
  height: number;
}

/**
 * Read the canvas dimensions from whichever image chunk is present (VP8, VP8L,
 * or an existing VP8X). We need them to write a fresh VP8X header when
 * promoting a simple WebP to extended format.
 */
function readCanvasDims(chunks: RiffChunk[]): CanvasDims | null {
  for (const c of chunks) {
    if (c.id === 'VP8X') {
      // VP8X data: flags(4) canvas-width-1(3 LE) canvas-height-1(3 LE)
      if (c.data.length < 10) continue;
      const w =
        ((c.data[4] ?? 0) | ((c.data[5] ?? 0) << 8) | ((c.data[6] ?? 0) << 16)) + 1;
      const h =
        ((c.data[7] ?? 0) | ((c.data[8] ?? 0) << 8) | ((c.data[9] ?? 0) << 16)) + 1;
      return { width: w, height: h };
    }
    if (c.id === 'VP8L') {
      // 1-byte signature 0x2F, then 14-bit width-1, 14-bit height-1, 1-bit alpha, 3-bit version.
      if (c.data.length < 5 || c.data[0] !== 0x2f) continue;
      const b1 = c.data[1] ?? 0;
      const b2 = c.data[2] ?? 0;
      const b3 = c.data[3] ?? 0;
      const b4 = c.data[4] ?? 0;
      const w = ((b1 | (b2 << 8)) & 0x3fff) + 1;
      const h = (((b2 >> 6) | (b3 << 2) | (b4 << 10)) & 0x3fff) + 1;
      return { width: w, height: h };
    }
    if (c.id === 'VP8 ') {
      // VP8 lossy: scan for start-code 0x9d 0x01 0x2a, then 16-bit width and height (with 2-bit scale).
      const d = c.data;
      for (let i = 3; i + 6 < d.length; i++) {
        if (d[i] === 0x9d && d[i + 1] === 0x01 && d[i + 2] === 0x2a) {
          const w = ((d[i + 3] ?? 0) | ((d[i + 4] ?? 0) << 8)) & 0x3fff;
          const h = ((d[i + 5] ?? 0) | ((d[i + 6] ?? 0) << 8)) & 0x3fff;
          if (w > 0 && h > 0) return { width: w, height: h };
        }
      }
    }
  }
  return null;
}

export function injectIntoWebp(encoded: Uint8Array, metadata: ExtractedMetadata): Uint8Array {
  const chunks = parseRiff(encoded);
  if (!chunks) return encoded;
  const dims = readCanvasDims(chunks);
  if (!dims) return encoded;

  // Strip any existing competing chunks; we'll write fresh ones.
  const surviving = chunks.filter(
    (c) =>
      !(metadata.iccProfile && c.id === 'ICCP') &&
      !(metadata.exif && c.id === 'EXIF') &&
      !(metadata.xmp && c.id === 'XMP ') &&
      c.id !== 'VP8X', // we always rewrite VP8X
  );

  // Compose flags per WebP spec: bit5=ICC, bit3=EXIF, bit2=XMP.
  let flags = 0;
  if (metadata.iccProfile) flags |= 0b0010_0000;
  if (metadata.exif) flags |= 0b0000_1000;
  if (metadata.xmp) flags |= 0b0000_0100;
  // If the source had alpha or animation, preserve those flag bits by
  // detecting the original VP8X. (Simplest: scan once.)
  const originalVp8x = chunks.find((c) => c.id === 'VP8X');
  if (originalVp8x && originalVp8x.data.length >= 1) {
    flags |= (originalVp8x.data[0] ?? 0) & 0b0001_0011; // animation + alpha + reserved bits we don't manage
  }

  const vp8x = buildVp8x(flags, dims);

  // Write order per spec: VP8X, ICCP, ANIM, ANMF/(VP8|VP8L|ALPH), EXIF, XMP.
  // For static images we keep it simple: VP8X, ICCP, <imagery>, EXIF, XMP.
  const imagery = surviving.filter((c) =>
    ['ALPH', 'VP8 ', 'VP8L', 'ANIM', 'ANMF'].includes(c.id),
  );
  const others = surviving.filter((c) => !imagery.includes(c) && !['ICCP', 'EXIF', 'XMP '].includes(c.id));

  const orderedChunks: RiffChunk[] = [{ id: 'VP8X', data: vp8x }];
  if (metadata.iccProfile) orderedChunks.push({ id: 'ICCP', data: metadata.iccProfile });
  // Anything that isn't ICCP/EXIF/XMP and isn't VP8X-ish — keep order from source.
  for (const c of others) orderedChunks.push(c);
  for (const c of imagery) orderedChunks.push(c);
  if (metadata.exif) orderedChunks.push({ id: 'EXIF', data: metadata.exif });
  if (metadata.xmp) orderedChunks.push({ id: 'XMP ', data: metadata.xmp });

  // Serialize.
  const body = serializeChunks(orderedChunks);
  const out = new Uint8Array(12 + body.length);
  out.set(RIFF, 0);
  const view = new DataView(out.buffer);
  view.setUint32(4, 4 + body.length, true); // "WEBP" + body
  out.set(WEBP, 8);
  out.set(body, 12);
  return out;
}

function buildVp8x(flags: number, dims: CanvasDims): Uint8Array {
  const data = new Uint8Array(10);
  data[0] = flags & 0xff;
  // bytes 1..3 reserved (zero)
  const w = dims.width - 1;
  const h = dims.height - 1;
  data[4] = w & 0xff;
  data[5] = (w >> 8) & 0xff;
  data[6] = (w >> 16) & 0xff;
  data[7] = h & 0xff;
  data[8] = (h >> 8) & 0xff;
  data[9] = (h >> 16) & 0xff;
  return data;
}

function serializeChunks(chunks: RiffChunk[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + 8 + c.data.length + (c.data.length & 1), 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  let offset = 0;
  for (const c of chunks) {
    for (let i = 0; i < 4; i++) out[offset + i] = c.id.charCodeAt(i) & 0xff;
    view.setUint32(offset + 4, c.data.length, true);
    out.set(c.data, offset + 8);
    offset += 8 + c.data.length;
    if (c.data.length & 1) {
      out[offset] = 0;
      offset += 1;
    }
  }
  return out;
}

function encodeAscii(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

function decodeAscii(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] ?? 0);
  return s;
}

import type { ExtractedMetadata } from './index';
import { readOrientationFromExif } from './index';

const APP1 = 0xffe1;
const APP2 = 0xffe2;
const SOS = 0xffda;
const EOI = 0xffd9;

const EXIF_MARKER = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]); // "Exif\0\0"
const XMP_MARKER = new TextEncoder().encode('http://ns.adobe.com/xap/1.0/\0');
// "ICC_PROFILE\0"
const ICC_MARKER = new Uint8Array([
  0x49, 0x43, 0x43, 0x5f, 0x50, 0x52, 0x4f, 0x46, 0x49, 0x4c, 0x45, 0x00,
]);

interface Segment {
  marker: number;
  payload: Uint8Array;
}

function walkSegments(bytes: Uint8Array): Segment[] {
  const out: Segment[] = [];
  if (bytes.length < 2 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return out;
  let i = 2;
  while (i + 1 < bytes.length) {
    if (bytes[i] !== 0xff) break;
    const marker = ((bytes[i] ?? 0) << 8) | (bytes[i + 1] ?? 0);
    i += 2;
    if (marker === SOS || marker === EOI) break;
    // RST markers and TEM have no length and no payload.
    if (marker >= 0xffd0 && marker <= 0xffd9) continue;
    if (i + 2 > bytes.length) break;
    const len = ((bytes[i] ?? 0) << 8) | (bytes[i + 1] ?? 0);
    if (len < 2 || i + len > bytes.length) break;
    out.push({ marker, payload: bytes.subarray(i + 2, i + len) });
    i += len;
  }
  return out;
}

function startsWith(buf: Uint8Array, prefix: Uint8Array): boolean {
  if (buf.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (buf[i] !== prefix[i]) return false;
  }
  return true;
}

export function extractFromJpeg(bytes: Uint8Array): ExtractedMetadata {
  const segments = walkSegments(bytes);
  let exif: Uint8Array | undefined;
  let xmp: Uint8Array | undefined;
  const iccChunks: Array<{ seq: number; total: number; data: Uint8Array }> = [];

  for (const seg of segments) {
    if (seg.marker === APP1) {
      if (!exif && startsWith(seg.payload, EXIF_MARKER)) {
        exif = seg.payload.slice(EXIF_MARKER.length);
      } else if (!xmp && startsWith(seg.payload, XMP_MARKER)) {
        xmp = seg.payload.slice(XMP_MARKER.length);
      }
    } else if (seg.marker === APP2 && startsWith(seg.payload, ICC_MARKER)) {
      const seq = seg.payload[ICC_MARKER.length] ?? 0;
      const total = seg.payload[ICC_MARKER.length + 1] ?? 0;
      const data = seg.payload.slice(ICC_MARKER.length + 2);
      iccChunks.push({ seq, total, data });
    }
  }

  let iccProfile: Uint8Array | undefined;
  if (iccChunks.length > 0) {
    iccChunks.sort((a, b) => a.seq - b.seq);
    const totalLen = iccChunks.reduce((sum, c) => sum + c.data.length, 0);
    iccProfile = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of iccChunks) {
      iccProfile.set(c.data, offset);
      offset += c.data.length;
    }
  }

  return {
    orientation: readOrientationFromExif(exif),
    exif,
    xmp,
    iccProfile,
  };
}

export function injectIntoJpeg(encoded: Uint8Array, metadata: ExtractedMetadata): Uint8Array {
  if (encoded.length < 2 || encoded[0] !== 0xff || encoded[1] !== 0xd8) return encoded;

  const inserts: Uint8Array[] = [];
  if (metadata.exif) {
    inserts.push(buildSegment(APP1, concat(EXIF_MARKER, metadata.exif)));
  }
  if (metadata.xmp) {
    inserts.push(buildSegment(APP1, concat(XMP_MARKER, metadata.xmp)));
  }
  if (metadata.iccProfile) {
    // Each APP2 segment can hold up to 65533 bytes of payload; subtract the
    // 12-byte ICC marker and the 2 sequence/total bytes.
    const max = 65533 - ICC_MARKER.length - 2;
    const total = Math.max(1, Math.ceil(metadata.iccProfile.length / max));
    if (total > 255) throw new Error('ICC profile too large to encode in JPEG APP2');
    for (let i = 0; i < total; i++) {
      const chunk = metadata.iccProfile.subarray(i * max, (i + 1) * max);
      const payload = new Uint8Array(ICC_MARKER.length + 2 + chunk.length);
      payload.set(ICC_MARKER, 0);
      payload[ICC_MARKER.length] = i + 1; // 1-based sequence
      payload[ICC_MARKER.length + 1] = total;
      payload.set(chunk, ICC_MARKER.length + 2);
      inserts.push(buildSegment(APP2, payload));
    }
  }
  if (inserts.length === 0) return encoded;

  const insertsLen = inserts.reduce((sum, s) => sum + s.length, 0);
  const out = new Uint8Array(encoded.length + insertsLen);
  out.set(encoded.subarray(0, 2), 0); // SOI
  let offset = 2;
  for (const seg of inserts) {
    out.set(seg, offset);
    offset += seg.length;
  }
  out.set(encoded.subarray(2), offset);
  return out;
}

function buildSegment(marker: number, payload: Uint8Array): Uint8Array {
  const len = payload.length + 2;
  if (len > 0xffff) throw new Error('JPEG segment payload too large');
  const out = new Uint8Array(2 + 2 + payload.length);
  out[0] = (marker >> 8) & 0xff;
  out[1] = marker & 0xff;
  out[2] = (len >> 8) & 0xff;
  out[3] = len & 0xff;
  out.set(payload, 4);
  return out;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

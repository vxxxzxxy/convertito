import type { ExtractedMetadata } from './index';
import { readOrientationFromExif } from './index';

const PNG_SIG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const XMP_KEYWORD = 'XML:com.adobe.xmp';

interface PngChunk {
  type: string;
  data: Uint8Array;
}

function parseChunks(bytes: Uint8Array): PngChunk[] | null {
  if (bytes.length < PNG_SIG.length + 12) return null;
  for (let i = 0; i < PNG_SIG.length; i++) {
    if (bytes[i] !== PNG_SIG[i]) return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: PngChunk[] = [];
  let offset = PNG_SIG.length;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset, false);
    const typeOffset = offset + 4;
    if (typeOffset + 4 + length + 4 > bytes.length) break;
    const type = String.fromCharCode(
      bytes[typeOffset] ?? 0,
      bytes[typeOffset + 1] ?? 0,
      bytes[typeOffset + 2] ?? 0,
      bytes[typeOffset + 3] ?? 0,
    );
    const data = bytes.subarray(typeOffset + 4, typeOffset + 4 + length);
    chunks.push({ type, data });
    offset = typeOffset + 4 + length + 4;
    if (type === 'IEND') break;
  }
  return chunks;
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

export async function extractFromPng(bytes: Uint8Array): Promise<ExtractedMetadata> {
  const chunks = parseChunks(bytes);
  if (!chunks) return { orientation: 1 };

  let exif: Uint8Array | undefined;
  let iccProfile: Uint8Array | undefined;
  let xmp: Uint8Array | undefined;

  for (const chunk of chunks) {
    if (chunk.type === 'eXIf' && !exif) {
      exif = chunk.data.slice();
      continue;
    }
    if (chunk.type === 'iCCP' && !iccProfile) {
      const nullIdx = chunk.data.indexOf(0);
      if (nullIdx <= 0 || nullIdx >= chunk.data.length - 1) continue;
      const compressionMethod = chunk.data[nullIdx + 1];
      if (compressionMethod !== 0) continue;
      try {
        iccProfile = await inflate(chunk.data.subarray(nullIdx + 2));
      } catch {
        // ignore: malformed iCCP
      }
      continue;
    }
    if (chunk.type === 'iTXt' && !xmp) {
      const kwEnd = chunk.data.indexOf(0);
      if (kwEnd <= 0) continue;
      const keyword = decodeAscii(chunk.data.subarray(0, kwEnd));
      if (keyword !== XMP_KEYWORD) continue;
      const compFlag = chunk.data[kwEnd + 1] ?? 0;
      const compMethod = chunk.data[kwEnd + 2] ?? 0;
      let cursor = kwEnd + 3;
      const langEnd = chunk.data.indexOf(0, cursor);
      if (langEnd < 0) continue;
      cursor = langEnd + 1;
      const transEnd = chunk.data.indexOf(0, cursor);
      if (transEnd < 0) continue;
      cursor = transEnd + 1;
      const textBytes = chunk.data.subarray(cursor);
      if (compFlag === 1 && compMethod === 0) {
        try {
          xmp = await inflate(textBytes);
        } catch {
          // ignore
        }
      } else {
        xmp = textBytes.slice();
      }
    }
  }

  return {
    orientation: readOrientationFromExif(exif),
    exif,
    iccProfile,
    xmp,
  };
}

export async function injectIntoPng(
  encoded: Uint8Array,
  metadata: ExtractedMetadata,
): Promise<Uint8Array> {
  const chunks = parseChunks(encoded);
  if (!chunks) return encoded;

  const inserts: PngChunk[] = [];
  if (metadata.iccProfile) {
    const compressed = await deflate(metadata.iccProfile);
    const keyword = encodeAscii('ICC profile');
    const data = new Uint8Array(keyword.length + 1 + 1 + compressed.length);
    data.set(keyword, 0);
    data[keyword.length] = 0;     // null terminator
    data[keyword.length + 1] = 0; // deflate compression method
    data.set(compressed, keyword.length + 2);
    inserts.push({ type: 'iCCP', data });
  }
  if (metadata.exif) {
    inserts.push({ type: 'eXIf', data: metadata.exif });
  }
  if (metadata.xmp) {
    const keyword = encodeAscii(XMP_KEYWORD);
    const data = new Uint8Array(keyword.length + 1 + 1 + 1 + 1 + 1 + metadata.xmp.length);
    let pos = 0;
    data.set(keyword, pos);
    pos += keyword.length;
    data[pos++] = 0; // null after keyword
    data[pos++] = 0; // compression flag (uncompressed)
    data[pos++] = 0; // compression method
    data[pos++] = 0; // language tag (empty) + null
    data[pos++] = 0; // translated keyword (empty) + null
    data.set(metadata.xmp, pos);
    inserts.push({ type: 'iTXt', data });
  }
  if (inserts.length === 0) return encoded;

  const parts: Uint8Array[] = [PNG_SIG];
  let inserted = false;
  for (const chunk of chunks) {
    if (chunk.type === 'iCCP' && metadata.iccProfile) continue;
    if (chunk.type === 'eXIf' && metadata.exif) continue;
    if (chunk.type === 'iTXt' && metadata.xmp) {
      const nullIdx = chunk.data.indexOf(0);
      if (nullIdx > 0 && decodeAscii(chunk.data.subarray(0, nullIdx)) === XMP_KEYWORD) continue;
    }
    if (!inserted && chunk.type === 'IDAT') {
      for (const ins of inserts) parts.push(serializeChunk(ins));
      inserted = true;
    }
    parts.push(serializeChunk(chunk));
  }
  if (!inserted) {
    for (const ins of inserts) parts.push(serializeChunk(ins));
  }
  return concatU8(parts);
}

function serializeChunk(chunk: PngChunk): Uint8Array {
  const buf = new Uint8Array(4 + 4 + chunk.data.length + 4);
  const view = new DataView(buf.buffer);
  view.setUint32(0, chunk.data.length, false);
  for (let i = 0; i < 4; i++) buf[4 + i] = chunk.type.charCodeAt(i);
  buf.set(chunk.data, 8);
  const crc = crc32(buf.subarray(4, 8 + chunk.data.length));
  view.setUint32(8 + chunk.data.length, crc, false);
  return buf;
}

let CRC_TABLE: Uint32Array | null = null;

function crc32(bytes: Uint8Array): number {
  if (!CRC_TABLE) {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
    CRC_TABLE = table;
  }
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = (CRC_TABLE[((c ^ (bytes[i] ?? 0)) & 0xff)] ?? 0) ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
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

function concatU8(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

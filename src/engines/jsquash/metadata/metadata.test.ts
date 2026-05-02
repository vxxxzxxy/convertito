// ImageData polyfill — node test env doesn't ship it. Must be installed at
// module-load time because the test file constructs ImageData in describe-scope.
if (typeof globalThis.ImageData === 'undefined') {
  class PolyImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    colorSpace = 'srgb' as const;
    constructor(data: Uint8ClampedArray, width: number, height: number) {
      this.data = data;
      this.width = width;
      this.height = height;
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).ImageData = PolyImageData;
}

import { describe, expect, it } from 'vitest';
import { applyOrientationToPixels, readOrientationFromExif } from './index';
import { extractFromJpeg, injectIntoJpeg } from './jpeg';
import { extractFromPng, injectIntoPng } from './png';
import { extractFromWebp, injectIntoWebp } from './webp';

function makeImage(width: number, height: number, fill: (x: number, y: number) => [number, number, number, number]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = fill(x, y);
      const i = (y * width + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
    }
  }
  return new ImageData(data, width, height);
}

function pixelAt(img: ImageData, x: number, y: number): [number, number, number, number] {
  const i = (y * img.width + x) * 4;
  return [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!, img.data[i + 3]!];
}

describe('applyOrientationToPixels', () => {
  // Build a 2×3 image where each pixel encodes its (x,y) in (R,G).
  const src = makeImage(2, 3, (x, y) => [x, y, 0, 255]);

  it('returns identity for orientation 1', () => {
    const out = applyOrientationToPixels(src, 1);
    expect(out.width).toBe(2);
    expect(out.height).toBe(3);
    expect(pixelAt(out, 0, 0)).toEqual([0, 0, 0, 255]);
  });

  it('flips horizontally for orientation 2', () => {
    const out = applyOrientationToPixels(src, 2);
    expect(out.width).toBe(2);
    expect(out.height).toBe(3);
    // Original (0,0)=(0,0,0,255) ends up at (1,0)
    expect(pixelAt(out, 1, 0)).toEqual([0, 0, 0, 255]);
    expect(pixelAt(out, 0, 0)).toEqual([1, 0, 0, 255]);
  });

  it('rotates 180 for orientation 3', () => {
    const out = applyOrientationToPixels(src, 3);
    expect(out.width).toBe(2);
    expect(out.height).toBe(3);
    // Original (0,0)=(0,0,0,255) ends up at (1,2)
    expect(pixelAt(out, 1, 2)).toEqual([0, 0, 0, 255]);
  });

  it('rotates 90 CW for orientation 6 (phone-portrait case)', () => {
    const out = applyOrientationToPixels(src, 6);
    // 2x3 → 3x2 (swapped)
    expect(out.width).toBe(3);
    expect(out.height).toBe(2);
    // Original top-left (0,0) goes to top-right of new image: (W-1, 0) = (2, 0)
    expect(pixelAt(out, 2, 0)).toEqual([0, 0, 0, 255]);
  });

  it('rotates 90 CCW for orientation 8', () => {
    const out = applyOrientationToPixels(src, 8);
    expect(out.width).toBe(3);
    expect(out.height).toBe(2);
    // Original top-left (0,0) goes to bottom-left of new image: (0, H-1) = (0, 1)
    expect(pixelAt(out, 0, 1)).toEqual([0, 0, 0, 255]);
  });
});

describe('readOrientationFromExif', () => {
  function buildExifWithOrientation(value: number): Uint8Array {
    // Little-endian TIFF header + IFD0 with one entry (orientation tag).
    const buf = new ArrayBuffer(8 + 2 + 12 + 4);
    const view = new DataView(buf);
    const u8 = new Uint8Array(buf);
    u8[0] = 0x49; u8[1] = 0x49;          // "II"
    view.setUint16(2, 0x002a, true);     // magic
    view.setUint32(4, 8, true);          // IFD0 offset
    view.setUint16(8, 1, true);          // entry count
    view.setUint16(10, 0x0112, true);    // tag (orientation)
    view.setUint16(12, 3, true);         // type SHORT
    view.setUint32(14, 1, true);         // count
    view.setUint16(18, value, true);     // value
    view.setUint32(22, 0, true);         // next IFD offset
    return u8;
  }

  it('returns 1 when EXIF is missing', () => {
    expect(readOrientationFromExif(undefined)).toBe(1);
  });

  it('reads orientation 6 from a TIFF block', () => {
    expect(readOrientationFromExif(buildExifWithOrientation(6))).toBe(6);
  });

  it('clamps invalid orientation values to 1', () => {
    expect(readOrientationFromExif(buildExifWithOrientation(99))).toBe(1);
  });
});

describe('JPEG metadata extract+inject roundtrip', () => {
  // Build a minimal JPEG: SOI + APP1(EXIF) + APP2(ICC chunk 1/1) + SOS + payload + EOI.
  function buildJpeg(exif?: Uint8Array, iccProfile?: Uint8Array): Uint8Array {
    const parts: Uint8Array[] = [new Uint8Array([0xff, 0xd8])]; // SOI
    if (exif) {
      const marker = new TextEncoder().encode('Exif\0\0');
      const len = 2 + marker.length + exif.length;
      const seg = new Uint8Array(2 + len);
      seg[0] = 0xff; seg[1] = 0xe1;
      seg[2] = (len >> 8) & 0xff; seg[3] = len & 0xff;
      seg.set(marker, 4);
      seg.set(exif, 4 + marker.length);
      parts.push(seg);
    }
    if (iccProfile) {
      const marker = new TextEncoder().encode('ICC_PROFILE\0');
      const len = 2 + marker.length + 2 + iccProfile.length;
      const seg = new Uint8Array(2 + len);
      seg[0] = 0xff; seg[1] = 0xe2;
      seg[2] = (len >> 8) & 0xff; seg[3] = len & 0xff;
      seg.set(marker, 4);
      seg[4 + marker.length] = 1; // sequence
      seg[4 + marker.length + 1] = 1; // total
      seg.set(iccProfile, 4 + marker.length + 2);
      parts.push(seg);
    }
    // Minimal SOS + dummy scan + EOI.
    parts.push(new Uint8Array([0xff, 0xda, 0x00, 0x02, 0xab, 0xff, 0xd9]));
    return concat(parts);
  }

  function concat(parts: Uint8Array[]): Uint8Array {
    const total = parts.reduce((s, p) => s + p.length, 0);
    const out = new Uint8Array(total);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }

  it('extracts EXIF + ICC from a synthetic JPEG', () => {
    const exif = new Uint8Array([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00]); // valid TIFF header, empty IFD
    const icc = new Uint8Array([0x00, 0x00, 0x02, 0x30]); // dummy ICC bytes
    const jpeg = buildJpeg(exif, icc);
    const result = extractFromJpeg(jpeg);
    expect(result.exif).toEqual(exif);
    expect(result.iccProfile).toEqual(icc);
  });

  it('injects metadata into a JPEG with no metadata, then extracts the same back', () => {
    const baseline = buildJpeg();
    const exif = new Uint8Array([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const icc = new Uint8Array(Array.from({ length: 100 }, (_, i) => i & 0xff));
    const injected = injectIntoJpeg(baseline, { orientation: 1, exif, iccProfile: icc });
    const extracted = extractFromJpeg(injected);
    expect(extracted.exif).toEqual(exif);
    expect(extracted.iccProfile).toEqual(icc);
  });

  it('splits large ICC profiles across multiple APP2 segments and reassembles them', () => {
    const baseline = buildJpeg();
    // 200 KB > 64 KB single-segment cap → must split
    const icc = new Uint8Array(200_000);
    for (let i = 0; i < icc.length; i++) icc[i] = i & 0xff;
    const injected = injectIntoJpeg(baseline, { orientation: 1, iccProfile: icc });
    const extracted = extractFromJpeg(injected);
    expect(extracted.iccProfile?.length).toBe(icc.length);
    expect(extracted.iccProfile?.[0]).toBe(0);
    expect(extracted.iccProfile?.[icc.length - 1]).toBe((icc.length - 1) & 0xff);
  });
});

describe('PNG metadata extract+inject roundtrip (async)', () => {
  // Build minimal PNG: signature + IHDR (hardcoded 1x1 RGBA) + IDAT(empty) + IEND.
  function minimalPng(): Uint8Array {
    return new Uint8Array([
      // signature
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      // IHDR length=13
      0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, // "IHDR"
      0x00, 0x00, 0x00, 0x01, // width 1
      0x00, 0x00, 0x00, 0x01, // height 1
      0x08, 0x06, 0x00, 0x00, 0x00, // bit depth, color type, ...
      0x1f, 0x15, 0xc4, 0x89, // CRC
      // IDAT length=0
      0x00, 0x00, 0x00, 0x00, 0x49, 0x44, 0x41, 0x54, 0x35, 0xaf, 0x06, 0x1e,
      // IEND
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
  }

  it('injects ICC + EXIF, then re-extracts them', async () => {
    const baseline = minimalPng();
    const exif = new Uint8Array([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const icc = new Uint8Array(Array.from({ length: 256 }, (_, i) => i));
    const injected = await injectIntoPng(baseline, { orientation: 1, exif, iccProfile: icc });
    const extracted = await extractFromPng(injected);
    expect(extracted.exif).toEqual(exif);
    expect(extracted.iccProfile).toEqual(icc);
  });
});

describe('WebP metadata extract+inject roundtrip', () => {
  // Build a minimal lossless WebP (VP8L) for a 1×1 image.
  function minimalWebp(): Uint8Array {
    const vp8l = new Uint8Array([
      0x2f,                   // signature
      0x00, 0x00, 0x00, 0x00, // 14-bit width-1 = 0 (1px), height-1 = 0
      0x10,                   // 1-bit alpha=1, 3-bit version=0; remaining bits don't matter for parser
    ]);
    const body = new Uint8Array(8 + vp8l.length);
    body[0] = 0x56; body[1] = 0x50; body[2] = 0x38; body[3] = 0x4c; // "VP8L"
    new DataView(body.buffer).setUint32(4, vp8l.length, true);
    body.set(vp8l, 8);
    const out = new Uint8Array(12 + body.length);
    out[0] = 0x52; out[1] = 0x49; out[2] = 0x46; out[3] = 0x46; // "RIFF"
    new DataView(out.buffer).setUint32(4, 4 + body.length, true);
    out[8] = 0x57; out[9] = 0x45; out[10] = 0x42; out[11] = 0x50; // "WEBP"
    out.set(body, 12);
    return out;
  }

  it('injects EXIF + ICC into a simple WebP and re-extracts them', () => {
    const baseline = minimalWebp();
    const exif = new Uint8Array([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const icc = new Uint8Array([1, 2, 3, 4, 5]);
    const injected = injectIntoWebp(baseline, { orientation: 1, exif, iccProfile: icc });
    const extracted = extractFromWebp(injected);
    expect(extracted.exif).toEqual(exif);
    expect(extracted.iccProfile).toEqual(icc);
  });
});

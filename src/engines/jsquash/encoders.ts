import type { DecodedMedia, Encoder } from '../types';

function firstFrame(media: DecodedMedia): ImageData {
  const frame = media.frames?.[0];
  if (!frame) throw new Error('encoder requires at least one image frame');
  return frame.pixels;
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

// JPEG has no alpha channel. Composite RGBA onto an opaque background before
// encoding — otherwise transparent pixels reveal whatever garbage RGB the PNG
// stored beneath them, producing the muddy artifacts users see when they
// expect a clean white fill.
function flattenAlpha(image: ImageData, bgR: number, bgG: number, bgB: number): ImageData {
  const { width, height, data } = image;
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]! / 255;
    const inv = 1 - a;
    out[i] = data[i]! * a + bgR * inv;
    out[i + 1] = data[i + 1]! * a + bgG * inv;
    out[i + 2] = data[i + 2]! * a + bgB * inv;
    out[i + 3] = 255;
  }
  return new ImageData(out, width, height);
}

export const jpegEncoder: Encoder = {
  id: 'jsquash-jpeg',
  outputMime: 'image/jpeg',
  outputExtension: 'jpg',
  label: 'JPEG',
  defaultOptions: { quality: 80 },
  qualityPresets: { high: 95, balanced: 80, small: 60 },
  async encode(media, options) {
    const { default: encode } = await import('@jsquash/jpeg/encode');
    const flat = flattenAlpha(firstFrame(media), 255, 255, 255);
    return encode(flat, {
      quality: num(options?.quality, 80),
    });
  },
};

export const pngEncoder: Encoder = {
  id: 'jsquash-png',
  outputMime: 'image/png',
  outputExtension: 'png',
  label: 'PNG',
  defaultOptions: {},
  async encode(media) {
    const { default: encode } = await import('@jsquash/png/encode');
    return encode(firstFrame(media));
  },
};

export const webpEncoder: Encoder = {
  id: 'jsquash-webp',
  outputMime: 'image/webp',
  outputExtension: 'webp',
  label: 'WebP',
  defaultOptions: { quality: 80, lossless: false },
  qualityPresets: { high: 90, balanced: 80, small: 60 },
  async encode(media, options) {
    const { default: encode } = await import('@jsquash/webp/encode');
    return encode(firstFrame(media), {
      quality: num(options?.quality, 80),
      lossless: bool(options?.lossless, false) ? 1 : 0,
    });
  },
};

export const avifEncoder: Encoder = {
  id: 'jsquash-avif',
  outputMime: 'image/avif',
  outputExtension: 'avif',
  label: 'AVIF',
  // speed 6 is libavif's default — balanced. Lower = slower & smaller.
  defaultOptions: { quality: 75, speed: 6 },
  qualityPresets: { high: 85, balanced: 75, small: 50 },
  async encode(media, options) {
    const { default: encode } = await import('@jsquash/avif/encode');
    return encode(firstFrame(media), {
      quality: num(options?.quality, 75),
      speed: num(options?.speed, 6),
    });
  },
};

export const jxlEncoder: Encoder = {
  id: 'jsquash-jxl',
  outputMime: 'image/jxl',
  outputExtension: 'jxl',
  label: 'JPEG XL',
  defaultOptions: { quality: 80, effort: 7, lossless: false },
  qualityPresets: { high: 95, balanced: 80, small: 60 },
  async encode(media, options) {
    const { default: encode } = await import('@jsquash/jxl/encode');
    return encode(firstFrame(media), {
      quality: num(options?.quality, 80),
      effort: num(options?.effort, 7),
      lossless: bool(options?.lossless, false),
    });
  },
};

export const jsquashEncoders: readonly Encoder[] = [
  jpegEncoder,
  pngEncoder,
  webpEncoder,
  avifEncoder,
  jxlEncoder,
];

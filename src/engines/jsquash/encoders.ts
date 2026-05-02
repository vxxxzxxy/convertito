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

export const jpegEncoder: Encoder = {
  id: 'jsquash-jpeg',
  outputMime: 'image/jpeg',
  outputExtension: 'jpg',
  label: 'JPEG',
  defaultOptions: { quality: 80 },
  async encode(media, options) {
    const { default: encode } = await import('@jsquash/jpeg/encode');
    return encode(firstFrame(media), {
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

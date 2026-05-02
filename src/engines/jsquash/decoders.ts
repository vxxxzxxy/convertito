import type { Decoder, DecodedMedia } from '../types';
import { applyOrientationToPixels, extractMetadata } from './metadata';

type JsquashDecode = (input: ArrayBuffer) => Promise<ImageData | null | undefined>;

async function decodeWithMetadata(
  input: ArrayBuffer,
  mime: string,
  decode: JsquashDecode,
): Promise<DecodedMedia> {
  const [pixels, extracted] = await Promise.all([decode(input), extractMetadata(input, mime)]);
  if (!pixels) throw new Error(`failed to decode ${mime}`);
  const oriented = applyOrientationToPixels(pixels, extracted.orientation ?? 1);
  return {
    kind: 'image',
    frames: [{ pixels: oriented }],
    metadata: {
      sourceMime: mime,
      sourceBytes: input.byteLength,
      exif: extracted.exif,
      iccProfile: extracted.iccProfile,
      xmp: extracted.xmp,
      orientation: extracted.orientation,
    },
  };
}

export const jpegDecoder: Decoder = {
  id: 'jsquash-jpeg',
  inputMimes: ['image/jpeg', 'image/jpg'],
  inputExtensions: ['jpg', 'jpeg', 'jpe', 'jfif'],
  async decode(input) {
    const { default: decode } = await import('@jsquash/jpeg/decode');
    return decodeWithMetadata(input, 'image/jpeg', decode);
  },
};

export const pngDecoder: Decoder = {
  id: 'jsquash-png',
  inputMimes: ['image/png'],
  inputExtensions: ['png'],
  async decode(input) {
    const { default: decode } = await import('@jsquash/png/decode');
    return decodeWithMetadata(input, 'image/png', decode);
  },
};

export const webpDecoder: Decoder = {
  id: 'jsquash-webp',
  inputMimes: ['image/webp'],
  inputExtensions: ['webp'],
  async decode(input) {
    const { default: decode } = await import('@jsquash/webp/decode');
    return decodeWithMetadata(input, 'image/webp', decode);
  },
};

export const avifDecoder: Decoder = {
  id: 'jsquash-avif',
  inputMimes: ['image/avif'],
  inputExtensions: ['avif'],
  async decode(input) {
    const { default: decode } = await import('@jsquash/avif/decode');
    return decodeWithMetadata(input, 'image/avif', decode);
  },
};

export const jxlDecoder: Decoder = {
  id: 'jsquash-jxl',
  inputMimes: ['image/jxl'],
  inputExtensions: ['jxl'],
  async decode(input) {
    const { default: decode } = await import('@jsquash/jxl/decode');
    return decodeWithMetadata(input, 'image/jxl', decode);
  },
};

export const jsquashDecoders: readonly Decoder[] = [
  jpegDecoder,
  pngDecoder,
  webpDecoder,
  avifDecoder,
  jxlDecoder,
];

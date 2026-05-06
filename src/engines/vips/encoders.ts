import type { DecodedMedia, Encoder } from '../types';
import { getVips } from './loader';

/**
 * Build a libvips Image from RGBA pixels and write it out in `suffix`'s
 * format (e.g. `.tiff`). The intermediate VImage handle is freed in
 * `finally` regardless of success — Embind objects don't get GC'd.
 *
 * `writeToBuffer` returns a Uint8Array that's a view onto the WASM heap,
 * so we `.slice()` to copy into a fresh ArrayBuffer detached from libvips
 * before returning.
 */
async function vipsEncodeFromRGBA(
  media: DecodedMedia,
  suffix: string,
  options: Record<string, unknown> = {},
): Promise<ArrayBuffer> {
  const frame = media.frames?.[0];
  if (!frame) throw new Error('encoder requires at least one image frame');
  const { width, height, data } = frame.pixels;
  const vips = await getVips();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let img: any = null;
  try {
    img = vips.Image.newFromMemory(data, width, height, 4, 'uchar');
    const out: Uint8Array = img.writeToBuffer(suffix, options);
    return out.slice().buffer;
  } finally {
    try {
      if (img && typeof img.delete === 'function' && !img.isDeleted?.()) img.delete();
    } catch {
      // Best-effort cleanup.
    }
  }
}

/**
 * TIFF encoder. LZW compression by default — lossless and broadly supported.
 * Other meaningful options would be `compression: 'deflate'` (smaller, also
 * lossless) and `compression: 'jpeg' / Q: N` (lossy). Keeping defaults
 * conservative until there's UI to surface them.
 */
export const tiffEncoder: Encoder = {
  id: 'vips-tiff',
  outputMime: 'image/tiff',
  outputExtension: 'tiff',
  label: 'TIFF',
  defaultOptions: { compression: 'lzw' },
  async encode(media, options) {
    const compression = (options?.compression as string) ?? 'lzw';
    return vipsEncodeFromRGBA(media, '.tiff', { compression });
  },
};

import type { Decoder, DecodedMedia } from '../types';

/**
 * HEIC/HEIF decoder via libheif-js. Input-only — there is no viable WASM
 * encoder for HEIC at the moment.
 *
 * libheif-js variants (default vs `libheif-js/wasm-bundle`) export different
 * shapes; we use the default which gives a synchronous `HeifDecoder`. The
 * dynamic import keeps the ~1 MB WASM out of the worker bundle until needed.
 */
export const heicDecoder: Decoder = {
  id: 'heic-libheif',
  inputMimes: [
    'image/heic',
    'image/heif',
    'image/heic-sequence',
    'image/heif-sequence',
  ],
  inputExtensions: ['heic', 'heif', 'heics', 'heifs'],
  async decode(input): Promise<DecodedMedia> {
    const mod = await import('libheif-js');
    // libheif-js historically exports as default; guard for either shape.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const libheif: any = (mod as any).default ?? mod;
    const decoder = new libheif.HeifDecoder();
    const data = decoder.decode(input);
    if (!data || data.length === 0) {
      throw new Error('HEIC has no decodable image');
    }
    // HEIC containers can hold multiple images (live photos, bursts).
    // We take the primary item.
    const image = data[0];
    const width = image.get_width();
    const height = image.get_height();

    const pixels = await new Promise<ImageData>((resolve, reject) => {
      const canvas = new ImageData(width, height);
      image.display(canvas, (display: ImageData | null) => {
        if (!display) reject(new Error('HEIC display() returned no data'));
        else resolve(display);
      });
    });

    return {
      kind: 'image',
      frames: [{ pixels }],
      metadata: {
        sourceMime: 'image/heic',
        sourceBytes: input.byteLength,
        // EXIF/orientation extraction deferred — varies per libheif version.
      },
    };
  },
};

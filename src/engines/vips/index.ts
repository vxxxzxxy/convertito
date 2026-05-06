import type { Engine } from '../types';
import { tiffDecoder, svgDecoder } from './decoders';
import { tiffEncoder } from './encoders';

/**
 * wasm-vips engine — long-tail image formats not covered by jsquash.
 *
 * Priority 25 (jsquash=100, heic/gif=50). Priority only matters when
 * multiple engines support the same conversion; for vips' formats
 * (TIFF in/out, SVG decode) there's no overlap. When vips decodes a TIFF
 * and jsquash encodes the PNG output, `pick()` reaches across engines —
 * `DecodedMedia` (RGBA) is the pivot.
 *
 * Scoped down from the original plan: BMP and ICO require the ImageMagick
 * delegate, which `wasm-vips@0.0.17` does not ship. They're deferred to a
 * future iteration (custom build or `bmp-js` / `ico-loader` add-ons).
 */
export const vipsEngine: Engine = {
  id: 'vips',
  priority: 25,
  decoders: [tiffDecoder, svgDecoder],
  encoders: [tiffEncoder],
};

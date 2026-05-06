import type { Decoder, DecodedMedia } from '../types';
import { LIMITS, analyzeSvgDimensions } from '../../lib/memory';
import { getVips } from './loader';

/** Fallback longest-side resolution for SVGs with no absolute size. */
const SVG_DEFAULT_MAX_DIMENSION = 2048;

/**
 * Helper that turns any libvips-decodable buffer into the pipeline's
 * `DecodedMedia` (RGBA `ImageData`). All decoders go through this so the
 * lifecycle of vips' Embind handles is consistent and try/finally-safe.
 *
 * Embind C++ objects in wasm-vips are not GC'd — every `Image` we produce
 * via `colourspace`, `addAlpha`, or `cast` allocates on the WASM heap and
 * leaks until `delete()` is called. The intermediate handles are tracked in
 * order and freed in `finally` so a throw mid-pipeline doesn't leak.
 *
 * We force `colourspace('srgb')` so CMYK TIFFs decode correctly, then
 * `addAlpha()` and `cast('uchar')` to land at 8-bit RGBA — the format the
 * rest of the pipeline (resize, encoders) expects.
 */
async function vipsDecodeToRGBA(
  input: ArrayBuffer,
  sourceMime: string,
  loadOptions: Record<string, unknown> = {},
): Promise<DecodedMedia> {
  const vips = await getVips();
  const buf = new Uint8Array(input);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handles: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const track = <T>(handle: T): T => {
    handles.push(handle);
    return handle;
  };
  try {
    const img = track(vips.Image.newFromBuffer(buf, '', loadOptions));
    const srgb = track(img.colourspace('srgb'));
    const withAlpha = srgb.hasAlpha() ? srgb : track(srgb.addAlpha());
    const rgba8 = withAlpha.format !== 'uchar' ? track(withAlpha.cast('uchar')) : withAlpha;
    const width: number = rgba8.width;
    const height: number = rgba8.height;
    const raw: Uint8Array = rgba8.writeToMemory();
    return {
      kind: 'image',
      frames: [{ pixels: new ImageData(new Uint8ClampedArray(raw), width, height) }],
      metadata: {
        sourceMime,
        sourceBytes: input.byteLength,
      },
    };
  } finally {
    // Iterate in reverse so derived handles are freed before their parents.
    for (let i = handles.length - 1; i >= 0; i--) {
      const h = handles[i];
      try {
        if (h && typeof h.delete === 'function' && !h.isDeleted?.()) h.delete();
      } catch {
        // Swallow — best-effort cleanup; an already-disposed handle is fine.
      }
    }
  }
}

export const tiffDecoder: Decoder = {
  id: 'vips-tiff',
  inputMimes: ['image/tiff', 'image/tif', 'image/x-tiff'],
  inputExtensions: ['tif', 'tiff'],
  async decode(input): Promise<DecodedMedia> {
    // Multi-page TIFFs silently take page 0, mirroring how the GIF decoder
    // takes the first frame. Pinning {page, n} also short-circuits libvips
    // probing for sequence metadata.
    return vipsDecodeToRGBA(input, 'image/tiff', { page: 0, n: 1 });
  },
};

/**
 * SVG decoder via librsvg/resvg (compiled into `vips-resvg.wasm`).
 *
 * librsvg in wasm-vips uses a fontconfig stub — SVGs that reference custom
 * web fonts not embedded inline will fall back to a default sans-serif. The
 * `svg-to-*` landing copy mentions this limitation.
 *
 * Two cases for sizing the raster:
 *
 * 1. **Absolute dims declared** (`width="800"`, `width="20cm"`): we honor
 *    the author's intent. If the resulting pixel count exceeds
 *    `LIMITS.blockPixels`, we clamp via a `scale` factor — the output is
 *    smaller than the SVG asked but the conversion succeeds.
 *
 * 2. **Only viewBox** (or `width="100%"`, etc.): the author delegated
 *    absolute size to a containing element that doesn't exist at raster
 *    time. We pick a sensible web default — longest side capped at
 *    `SVG_DEFAULT_MAX_DIMENSION` px, aspect ratio from the viewBox. This
 *    is the only sane behavior; trying to rasterize at the viewBox values
 *    treats `viewBox="0 0 10000 8500"` as 10000×8500 px which is hundreds
 *    of MB of RGBA — almost never what the user wants for web output.
 *
 * If neither absolute dims nor viewBox are parseable, we refuse the file
 * with a message asking the author to add them. libvips' fallback density
 * would otherwise produce unpredictable rasters.
 *
 * No `dpi` override — librsvg multiplies the viewBox by `dpi / 72`, so any
 * value > 72 inflates the raster beyond the area we just measured. Default
 * keeps `scale` as the single source of truth.
 */
export const svgDecoder: Decoder = {
  id: 'vips-svg',
  inputMimes: ['image/svg+xml', 'image/svg'],
  inputExtensions: ['svg'],
  async decode(input): Promise<DecodedMedia> {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(input);
    const dims = analyzeSvgDimensions(text);
    if (!dims) {
      throw new Error(
        'No se pueden detectar las dimensiones del SVG. Añade width, height o viewBox al elemento <svg>.',
      );
    }
    let scale: number;
    if (dims.kind === 'absolute') {
      const declared = dims.width * dims.height;
      // sqrt(max / declared) lands the output exactly at the pixel cap.
      // Cap at 1 so we never upscale beyond what the author asked.
      scale = declared > LIMITS.blockPixels ? Math.sqrt(LIMITS.blockPixels / declared) : 1;
    } else {
      // viewBox-only: scale so the longest side equals the web default.
      const longest = Math.max(dims.width, dims.height);
      scale = SVG_DEFAULT_MAX_DIMENSION / longest;
    }
    return vipsDecodeToRGBA(input, 'image/svg+xml', { scale });
  },
};

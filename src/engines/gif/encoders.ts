import type { DecodedMedia, Encoder } from '../types';

function firstFrame(media: DecodedMedia): ImageData {
  const frame = media.frames?.[0];
  if (!frame) throw new Error('encoder requires at least one image frame');
  return frame.pixels;
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * GIF encoder via gifenc. Single-frame, palette-quantized (max 256 colors).
 * `numColors` is exposed as the option but the UI doesn't surface it yet —
 * we default to 256 (max quality). Future: add a slider in OutputPicker
 * specific to GIF, similar to how PNG could expose compression effort.
 */
export const gifEncoder: Encoder = {
  id: 'gif-gifenc',
  outputMime: 'image/gif',
  outputExtension: 'gif',
  label: 'GIF',
  defaultOptions: { numColors: 256 },
  // No qualityPresets — GIF uses palette size, not lossy quality. Same as PNG.
  async encode(media, options) {
    const { quantize, applyPalette, GIFEncoder } = await import('gifenc');
    const image = firstFrame(media);
    const numColors = Math.min(256, Math.max(2, num(options?.numColors, 256)));
    const palette = quantize(image.data, numColors);
    const indexed = applyPalette(image.data, palette);
    const enc = GIFEncoder();
    enc.writeFrame(indexed, image.width, image.height, { palette });
    enc.finish();
    const view = enc.bytesView();
    // Copy out of the underlying buffer so the result owns its own memory
    // (gifenc keeps reusing the buffer across calls).
    const out = new Uint8Array(view.byteLength);
    out.set(view);
    return out.buffer;
  },
};

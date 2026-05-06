import type { Decoder, DecodedMedia } from '../types';

/**
 * GIF decoder via gifuct-js. v1 only takes the first frame — multi-frame
 * (animated) support would require encoders that accept frame sequences,
 * which jsquash does not currently expose.
 */
export const gifDecoder: Decoder = {
  id: 'gif',
  inputMimes: ['image/gif'],
  inputExtensions: ['gif'],
  async decode(input): Promise<DecodedMedia> {
    const { parseGIF, decompressFrames } = await import('gifuct-js');
    const gif = parseGIF(input);
    // `true` builds the full RGBA patch for each frame. Costly for animated
    // GIFs (decodes all frames), but for v1 we accept it. Optimization for
    // later: decompress only frame 0.
    const frames = decompressFrames(gif, true);
    if (frames.length === 0) throw new Error('GIF has no frames');
    const first = frames[0]!;
    const patch = new Uint8ClampedArray(first.patch.byteLength);
    patch.set(first.patch);
    const pixels = new ImageData(
      patch,
      first.dims.width,
      first.dims.height,
    );
    return {
      kind: 'image',
      frames: [{ pixels }],
      metadata: {
        sourceMime: 'image/gif',
        sourceBytes: input.byteLength,
      },
    };
  },
};

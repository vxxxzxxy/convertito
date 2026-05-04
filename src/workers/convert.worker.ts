import * as Comlink from 'comlink';
import { pick } from '../engines/registry';
import type { EncoderOptions } from '../engines/types';
import { injectMetadata } from '../engines/jsquash/metadata';

export interface ConvertParams {
  input: ArrayBuffer;
  sourceMime: string;
  targetMime: string;
  options?: EncoderOptions;
}

export interface ConvertResult {
  bytes: ArrayBuffer;
  outputMime: string;
  outputExtension: string;
}

const api = {
  async convert(params: ConvertParams): Promise<ConvertResult> {
    const route = pick(params.sourceMime, params.targetMime);
    if (!route) {
      throw new Error(`No engine supports ${params.sourceMime} → ${params.targetMime}`);
    }
    const decoded = await route.decoder.decode(params.input);
    // Optional resize between decode and encode. The dynamic import keeps
    // pica out of the worker bundle until a job actually needs it.
    const resize = params.options?.resize as { width: number; height: number } | undefined;
    if (resize && decoded.frames?.[0]) {
      const { resizeImageData } = await import('../engines/resize');
      decoded.frames[0].pixels = await resizeImageData(
        decoded.frames[0].pixels,
        resize.width,
        resize.height,
      );
    }
    const encoded = await route.encoder.encode(decoded, params.options);
    const finalBytes = await injectMetadata(encoded, decoded.metadata, route.encoder.outputMime);
    const result: ConvertResult = {
      bytes: finalBytes,
      outputMime: route.encoder.outputMime,
      outputExtension: route.encoder.outputExtension,
    };
    return Comlink.transfer(result, [result.bytes]);
  },
};

export type ConvertApi = typeof api;

Comlink.expose(api);

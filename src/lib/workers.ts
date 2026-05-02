import * as Comlink from 'comlink';
import type { ConvertApi, ConvertParams } from '../workers/convert.worker';

export interface ConvertWorker {
  /** Comlink proxy. Method returns are auto-wrapped in promises. */
  api: Comlink.Remote<ConvertApi>;
  /** Terminate the underlying worker and release its proxy. */
  terminate(): void;
}

/**
 * Spawn a fresh conversion worker.
 *
 * Vite detects worker URLs only when both `new URL(..., import.meta.url)` and
 * the options object are inline literals at the call site — don't refactor
 * this into a helper that takes a path parameter or it stops working in prod.
 */
export function spawnConvertWorker(): ConvertWorker {
  const worker = new Worker(
    new URL('../workers/convert.worker.ts', import.meta.url),
    { type: 'module' },
  );
  const api = Comlink.wrap<ConvertApi>(worker);
  return {
    api,
    terminate() {
      api[Comlink.releaseProxy]();
      worker.terminate();
    },
  };
}

/**
 * Wrap a `ConvertParams` so its input ArrayBuffer is transferred to the
 * worker without copy. After this call the caller MUST NOT touch
 * `params.input` again — its backing memory is detached.
 */
export function transferConvertParams(params: ConvertParams): ConvertParams {
  return Comlink.transfer(params, [params.input]);
}

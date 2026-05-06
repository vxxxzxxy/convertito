/**
 * Singleton loader for wasm-vips. The package ships as a single threaded
 * Emscripten module; we initialize it once per worker and reuse the resulting
 * `vips` namespace for every decode/encode.
 *
 * `dynamicLibraries` lists the optional libvips loaders we want available.
 * The default set is `['vips-jxl.wasm', 'vips-heif.wasm']` — we add
 * `vips-resvg.wasm` for SVG decoding. Each is fetched lazily as the actual
 * format is touched, so the worker only pays the bytes it uses.
 */

// wasm-vips' types declare the module via a global declaration; in worker
// context (no DOM types) the structural shape is what we rely on. Casting
// keeps the public API of this loader narrow without dragging libvips' full
// 200KB of types into every file that imports getVips.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VipsModule = any;

let vipsPromise: Promise<VipsModule> | null = null;

export function getVips(): Promise<VipsModule> {
  vipsPromise ??= (async () => {
    const mod = await import('wasm-vips');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Vips = (mod as any).default ?? mod;
    const vips = await Vips({
      dynamicLibraries: ['vips-jxl.wasm', 'vips-heif.wasm', 'vips-resvg.wasm'],
    });
    // libvips' operation cache holds intermediate results across calls. We
    // delete() Image handles after each job, so the cache only adds bytes.
    // Disable both to keep memory predictable.
    vips.Cache.max(0);
    vips.Cache.maxMem(0);
    return vips;
  })();
  return vipsPromise;
}

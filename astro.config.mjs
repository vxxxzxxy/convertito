// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// SharedArrayBuffer (needed by multi-threaded WASM, e.g. ffmpeg-mt later)
// requires cross-origin isolation. `credentialless` keeps third-party
// subresources working without per-resource CORP headers — easier to evolve
// than `require-corp`. Production parity lives in `public/_headers`.
const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
};

/**
 * @param {unknown} _req
 * @param {{ setHeader(name: string, value: string): void }} res
 * @param {() => void} next
 */
function applyIsolationHeaders(_req, res, next) {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  next();
}

/**
 * Vite middleware that re-applies isolation headers on every dev-server
 * response. `vite.server.headers` is supposed to do this, but it skips a few
 * paths (notably worker chunks served with `?v=...` query strings). Without
 * those headers reaching the wasm-vips child workers, `self.crossOriginIsolated`
 * is `false` inside them and SharedArrayBuffer transfers fail with
 * `DataCloneError`. This plugin covers that gap.
 */
const crossOriginIsolation = {
  name: 'convertito:cross-origin-isolation',
  /** @param {any} server */
  configureServer(server) {
    server.middlewares.use(applyIsolationHeaders);
  },
  /** @param {any} server */
  configurePreviewServer(server) {
    server.middlewares.use(applyIsolationHeaders);
  },
};

// https://astro.build/config
export default defineConfig({
  integrations: [react()],

  vite: {
    plugins: [tailwindcss(), crossOriginIsolation],

    // jsquash codecs ship Emscripten glue that locates .wasm via
    // `new URL(..., import.meta.url)`. Keeping them out of dep optimization
    // ensures Vite emits the asset references correctly from worker chunks.
    // (See vitejs/vite#19194, #11694.)
    //
    // gifuct-js is CommonJS only and Vite's auto-detection sometimes misses
    // it when imported dynamically inside a Worker — forcing it (and gifenc)
    // into the `include` list ensures both get pre-bundled to ESM up front.
    optimizeDeps: {
      exclude: [
        '@jsquash/avif',
        '@jsquash/jpeg',
        '@jsquash/jxl',
        '@jsquash/png',
        '@jsquash/webp',
        // wasm-vips uses the same Emscripten `new URL(..., import.meta.url)`
        // pattern as jsquash to locate vips.wasm and its dynamic libraries
        // (vips-jxl/heif/resvg.wasm). Excluding from dep optimization keeps
        // the asset references intact when Vite bundles the worker chunk.
        'wasm-vips',
      ],
      include: ['gifuct-js', 'gifenc'],
    },

    worker: {
      format: 'es',
    },

    server: {
      headers: isolationHeaders,
    },

    preview: {
      headers: isolationHeaders,
    },
  },
});

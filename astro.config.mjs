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

// https://astro.build/config
export default defineConfig({
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],

    // jsquash codecs ship Emscripten glue that locates .wasm via
    // `new URL(..., import.meta.url)`. Keeping them out of dep optimization
    // ensures Vite emits the asset references correctly from worker chunks.
    // (See vitejs/vite#19194, #11694.)
    optimizeDeps: {
      exclude: [
        '@jsquash/avif',
        '@jsquash/jpeg',
        '@jsquash/jxl',
        '@jsquash/png',
        '@jsquash/webp',
      ],
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

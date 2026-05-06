# convertito

Conversor de archivos 100 % en el navegador. WASM-first, sin servidor, sin coste de hosting.

Las imágenes nunca salen del dispositivo: el decodificador y el codificador corren en un Web Worker dentro del navegador del usuario. El sitio se sirve como estáticos.

## Formatos soportados

Imágenes (entrada → salida cualquier combinación viable):

- JPG / PNG / WebP / AVIF / JPEG XL — vía [`@jsquash`](https://github.com/jamsinclair/jSquash)
- HEIC (solo entrada) — vía [`libheif-js`](https://github.com/catdad-experiments/libheif-js)
- GIF — decoder con `gifuct-js`, encoder con `gifenc` (extrae el primer fotograma)
- TIFF (entrada y salida) y SVG (solo entrada, rasterizado con límites seguros) — vía [`wasm-vips`](https://github.com/kleisauke/wasm-vips)

El registro de pares concretos vive en `src/lib/pairs.ts`. Cada par tiene su propia ruta SEO en `/convert/<slug>`.

## Arquitectura

```
Archivo del usuario
      │
      ▼
DropZone (UI) ──► JobQueue (estado React)
                       │
                       ▼
              convert.worker.ts (Comlink)
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
      Decoder                   Encoder
   (jSquash / libheif /         (jSquash /
    gifuct-js)                   gifenc)
          │                         ▲
          └─────► RGBA pivote ──────┘
                       │
                       ▼
              Blob descargable
```

- **`src/engines/`** — cada engine (`jsquash`, `heic`, `gif`, `vips`) expone `decoders` y `encoders`. El `registry.ts` los combina por prioridad (`jsquash`=100, `heic`/`gif`=50, `vips`=25 como long tail) y permite que un decoder de un engine alimente al encoder de otro (el pivote es RGBA).
- **`src/workers/convert.worker.ts`** — el trabajo pesado corre fuera del hilo principal vía Comlink.
- **`src/lib/jobs/`** — máquina de estados de la cola de trabajos (pending → running → done/error).
- **`src/lib/pairs.ts`** — pares destacados con copy en español para SEO.

### Cross-origin isolation

Para habilitar `SharedArrayBuffer` (que `wasm-vips` ya necesita y `ffmpeg-mt` necesitará en el futuro) la app se sirve con cabeceras COOP/COEP:

- Dev/preview: middleware Vite custom `crossOriginIsolation` en `astro.config.mjs` que aplica los headers a **todas** las responses. (`vite.server.headers` por sí solo se salta algunos chunks con query string `?v=...`, lo que rompe los workers anidados de wasm-vips.)
- Producción: `public/_headers` (formato Cloudflare Pages / Netlify).

Se usa `Cross-Origin-Embedder-Policy: credentialless` en lugar de `require-corp` para no bloquear subrecursos de terceros.

## Stack

- [Astro 6](https://astro.build/) con integración de [React 19](https://react.dev/) para los componentes interactivos.
- [Tailwind CSS 4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) (Radix) para la UI.
- [Comlink](https://github.com/GoogleChromeLabs/comlink) para hablar con el Web Worker.
- [pica](https://github.com/nodeca/pica) para redimensionado de alta calidad.
- [Vitest](https://vitest.dev/) para tests.

## Requisitos

- Node ≥ 22.12
- pnpm (recomendado)

## Comandos

| Comando         | Acción                                              |
| :-------------- | :-------------------------------------------------- |
| `pnpm install`  | Instala dependencias                                |
| `pnpm dev`      | Servidor de desarrollo en `localhost:4321`          |
| `pnpm build`    | Build de producción a `./dist/`                     |
| `pnpm preview`  | Sirve el build localmente (con cabeceras COOP/COEP) |
| `pnpm test`     | Tests unitarios (Vitest, una pasada)                |
| `pnpm test:watch` | Tests en watch mode                               |

## Estructura

```
src/
├── components/    # UI (React + Astro). ConverterApp es el entrypoint cliente.
├── engines/       # Decoders / encoders organizados por familia (jsquash, heic, gif, vips).
├── layouts/
├── lib/           # Utilidades: jobs, files, memoria, pares de conversión.
├── pages/
│   ├── index.astro
│   ├── image.astro
│   └── convert/[pair].astro
├── styles/
└── workers/       # convert.worker.ts (corre las conversiones).
public/
├── _headers       # COOP/COEP para producción.
└── ...
```

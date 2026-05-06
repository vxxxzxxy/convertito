declare module 'pica' {
  interface ResizeBufferOptions {
    src: Uint8Array;
    width: number;
    height: number;
    toWidth: number;
    toHeight: number;
    quality?: number;
  }

  interface PicaInstance {
    resizeBuffer(options: ResizeBufferOptions): Promise<Uint8Array>;
  }

  export default function Pica(): PicaInstance;
}

declare module 'gifenc' {
  export function quantize(data: Uint8ClampedArray | Uint8Array, maxColors: number): number[][];
  export function applyPalette(data: Uint8ClampedArray | Uint8Array, palette: number[][]): Uint8Array;

  export interface GifEncoder {
    writeFrame(indexed: Uint8Array, width: number, height: number, options: { palette: number[][] }): void;
    finish(): void;
    bytesView(): Uint8Array;
  }

  export function GIFEncoder(): GifEncoder;
}

declare module 'libheif-js' {
  export interface HeifImage {
    get_width(): number;
    get_height(): number;
    display(imageData: ImageData, callback: (display: ImageData | null) => void): void;
  }

  export class HeifDecoder {
    decode(input: ArrayBuffer): HeifImage[];
  }
}

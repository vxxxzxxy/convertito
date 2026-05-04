export type MediaKind = 'image' | 'audio' | 'video';

export interface MediaMetadata {
  /** Raw EXIF segment (JPEG APP1 / PNG eXIf / WebP EXIF chunk), if present. */
  exif?: Uint8Array;
  /** Raw ICC profile bytes. */
  iccProfile?: Uint8Array;
  /** Raw XMP packet. */
  xmp?: Uint8Array;
  /**
   * EXIF orientation (1..8) found in the source. The decoder is expected to
   * apply this to the pixel buffer so callers see orientation=1 — i.e. the
   * `frames` are already rotated to "upright". Carried here purely for traceability.
   */
  orientation?: number;
  /** Source MIME the bytes came from (after sniffing if needed). */
  sourceMime: string;
  /** Length of the source ArrayBuffer in bytes. */
  sourceBytes: number;
}

export interface ImageFrame {
  pixels: ImageData;
  /** Frame duration in ms for animated formats. Undefined for static images. */
  durationMs?: number;
}

/**
 * Common intermediate the pipeline pivots on. Decoders produce one, encoders
 * consume one. The discriminator `kind` lets the orchestrator stay
 * media-agnostic when audio/video engines land.
 */
export interface DecodedMedia {
  kind: MediaKind;
  /** Always set for `kind: 'image'`. Single static image is `frames.length === 1`. */
  frames?: ImageFrame[];
  /** Reserved for future audio engines. */
  audio?: AudioBuffer;
  metadata: MediaMetadata;
}

export interface Decoder {
  /** Stable identifier — `'<engine>-<format>'`, e.g. `'jsquash-jpeg'`. */
  id: string;
  /** MIME types this decoder accepts as input. */
  inputMimes: readonly string[];
  /** File extensions (lowercased, no dot) used as MIME fallback. */
  inputExtensions: readonly string[];
  decode(input: ArrayBuffer, signal?: AbortSignal): Promise<DecodedMedia>;
}

export type EncoderOptions = Record<string, unknown>;

export interface QualityPresets {
  high: number;
  balanced: number;
  small: number;
}

export interface Encoder {
  /** Stable identifier — e.g. `'jsquash-webp'`. */
  id: string;
  /** Output MIME type. */
  outputMime: string;
  /** File extension to use when offering download (lowercased, no dot). */
  outputExtension: string;
  /** Human-friendly label for UI, e.g. `'WebP'`. */
  label: string;
  /** Defaults the picker / UI seeds the options dialog with. */
  defaultOptions: EncoderOptions;
  /** If present, the OutputPicker renders preset chips that snap the quality slider. */
  qualityPresets?: QualityPresets;
  encode(media: DecodedMedia, options?: EncoderOptions, signal?: AbortSignal): Promise<ArrayBuffer>;
}

export interface Engine {
  /** Stable engine identifier, e.g. `'jsquash'`. */
  id: string;
  /** Higher wins when multiple engines support the same conversion. */
  priority: number;
  decoders: readonly Decoder[];
  encoders: readonly Encoder[];
  /**
   * Optional eager preload hook. Useful if the UI wants to warm caches; not
   * required for correctness because each decoder/encoder lazy-loads its WASM.
   */
  load?(): Promise<void>;
}

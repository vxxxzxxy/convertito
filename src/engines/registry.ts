import type { Decoder, Encoder, Engine } from './types';
import { jsquashEngine } from './jsquash';
import { heicEngine } from './heic';
import { gifEngine } from './gif';
import { vipsEngine } from './vips';

export const engines: readonly Engine[] = [jsquashEngine, heicEngine, gifEngine, vipsEngine];

export interface ConversionRoute {
  engine: Engine;
  decoder: Decoder;
  encoder: Encoder;
}

/**
 * Per-pair override map. Key format: `<sourceMime>-><targetMime>`, value is an
 * `engine.id`. Missing keys fall back to priority-based selection. The map is
 * intentionally not exposed in v1's UI — it's a knob for fine-tuning later.
 */
export const enginePreferences: Readonly<Record<string, string>> = {};

/**
 * Pick the route that should handle a given conversion. Decoder and encoder
 * may come from different engines — `DecodedMedia` (RGBA) is the pivot, so
 * any decoder can hand off to any encoder. Returns `null` when no engine
 * decodes the source or no engine encodes the target.
 *
 * When multiple engines provide decoders/encoders for the same MIME, the
 * highest `priority` wins on each side (with `enginePreferences` allowing
 * a per-pair override, currently unused).
 */
export function pick(sourceMime: string, targetMime: string): ConversionRoute | null {
  const decoderCandidates = engines
    .flatMap((engine) =>
      engine.decoders
        .filter((d) => d.inputMimes.includes(sourceMime))
        .map((decoder) => ({ engine, decoder })),
    )
    .sort((a, b) => b.engine.priority - a.engine.priority);
  const encoderCandidates = engines
    .flatMap((engine) =>
      engine.encoders
        .filter((e) => e.outputMime === targetMime)
        .map((encoder) => ({ engine, encoder })),
    )
    .sort((a, b) => b.engine.priority - a.engine.priority);

  if (decoderCandidates.length === 0 || encoderCandidates.length === 0) return null;

  const overrideId = enginePreferences[`${sourceMime}->${targetMime}`];
  const overrideEncoder = overrideId
    ? encoderCandidates.find((c) => c.engine.id === overrideId)
    : null;
  const chosenEncoder = overrideEncoder ?? encoderCandidates[0]!;
  const chosenDecoder = decoderCandidates[0]!;

  // `engine` field is informational; the worker only uses decoder/encoder.
  // We expose the encoder's engine here for back-compat with anything that
  // reads `route.engine` for telemetry/labels.
  return {
    engine: chosenEncoder.engine,
    decoder: chosenDecoder.decoder,
    encoder: chosenEncoder.encoder,
  };
}

export interface OutputOption {
  mime: string;
  label: string;
  extension: string;
}

/**
 * For a given source MIME, returns the deduplicated list of output formats the
 * registry can produce. Cross-engine: as long as *some* engine decodes the
 * source, every encoder across all engines is a valid output (because the
 * pipeline pivots on RGBA). Used to populate the per-file output picker.
 */
export function availableOutputsFor(sourceMime: string): OutputOption[] {
  const hasAnyDecoder = engines.some((e) =>
    e.decoders.some((d) => d.inputMimes.includes(sourceMime)),
  );
  if (!hasAnyDecoder) return [];
  const seen = new Map<string, OutputOption>();
  for (const engine of engines) {
    for (const encoder of engine.encoders) {
      if (seen.has(encoder.outputMime)) continue;
      seen.set(encoder.outputMime, {
        mime: encoder.outputMime,
        label: encoder.label,
        extension: encoder.outputExtension,
      });
    }
  }
  return [...seen.values()];
}

/** All distinct input MIMEs across all engines — handy for `<input accept=...>`. */
export function allInputMimes(): string[] {
  const set = new Set<string>();
  for (const engine of engines) {
    for (const decoder of engine.decoders) {
      for (const mime of decoder.inputMimes) set.add(mime);
    }
  }
  return [...set];
}

/** Extensions registered for a given list of input MIMEs (without leading dot). */
export function inputExtensionsFor(mimes: readonly string[]): string[] {
  const set = new Set<string>();
  const wanted = new Set(mimes);
  for (const engine of engines) {
    for (const decoder of engine.decoders) {
      if (decoder.inputMimes.some((m) => wanted.has(m))) {
        for (const ext of decoder.inputExtensions) set.add(ext);
      }
    }
  }
  return [...set];
}

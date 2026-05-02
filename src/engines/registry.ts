import type { Decoder, Encoder, Engine } from './types';
import { jsquashEngine } from './jsquash';

export const engines: readonly Engine[] = [jsquashEngine];

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
 * Pick the route that should handle a given conversion. Returns `null` when
 * no engine supports the source → target pair.
 */
export function pick(sourceMime: string, targetMime: string): ConversionRoute | null {
  const candidates: ConversionRoute[] = [];
  for (const engine of engines) {
    const decoder = engine.decoders.find((d) => d.inputMimes.includes(sourceMime));
    const encoder = engine.encoders.find((e) => e.outputMime === targetMime);
    if (decoder && encoder) {
      candidates.push({ engine, decoder, encoder });
    }
  }
  if (candidates.length === 0) return null;

  const overrideId = enginePreferences[`${sourceMime}->${targetMime}`];
  if (overrideId) {
    const match = candidates.find((c) => c.engine.id === overrideId);
    if (match) return match;
  }
  candidates.sort((a, b) => b.engine.priority - a.engine.priority);
  return candidates[0]!;
}

export interface OutputOption {
  mime: string;
  label: string;
  extension: string;
}

/**
 * For a given source MIME, returns the deduplicated list of output formats the
 * registry can produce. Used to populate the per-file output picker in the UI.
 */
export function availableOutputsFor(sourceMime: string): OutputOption[] {
  const seen = new Map<string, OutputOption>();
  for (const engine of engines) {
    const hasDecoder = engine.decoders.some((d) => d.inputMimes.includes(sourceMime));
    if (!hasDecoder) continue;
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

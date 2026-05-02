import { useMemo } from 'react';
import { availableOutputsFor, engines, pick } from '../engines/registry';
import type { EncoderOptions } from '../engines/types';

interface OutputPickerProps {
  sourceMime: string;
  targetMime: string;
  options: EncoderOptions;
  disabled?: boolean;
  onTargetChange: (targetMime: string) => void;
  onOptionsChange: (options: EncoderOptions) => void;
}

function findEncoderDefaults(targetMime: string): EncoderOptions {
  for (const engine of engines) {
    const enc = engine.encoders.find((e) => e.outputMime === targetMime);
    if (enc) return enc.defaultOptions;
  }
  return {};
}

export function OutputPicker({
  sourceMime,
  targetMime,
  options,
  disabled,
  onTargetChange,
  onOptionsChange,
}: OutputPickerProps) {
  const outputs = useMemo(() => availableOutputsFor(sourceMime), [sourceMime]);
  const route = pick(sourceMime, targetMime);
  const defaults = useMemo(() => findEncoderDefaults(targetMime), [targetMime]);
  const merged = { ...defaults, ...options };

  if (!route) {
    return (
      <p className="text-xs text-amber-400">
        No hay un conversor disponible para {sourceMime} → {targetMime}.
      </p>
    );
  }

  const supportsQuality = 'quality' in defaults;
  const supportsLossless = 'lossless' in defaults;

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <label className="flex items-center gap-2">
        <span className="text-zinc-400">Salida</span>
        <select
          disabled={disabled}
          value={targetMime}
          onChange={(e) => onTargetChange(e.target.value)}
          className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
        >
          {outputs.map((o) => (
            <option key={o.mime} value={o.mime}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {supportsQuality && !merged.lossless && (
        <label className="flex items-center gap-2">
          <span className="text-zinc-400">Calidad</span>
          <input
            type="range"
            min={1}
            max={100}
            value={Number(merged.quality ?? 80)}
            disabled={disabled}
            onChange={(e) =>
              onOptionsChange({ ...options, quality: Number(e.target.value) })
            }
            className="accent-emerald-500"
          />
          <span className="w-8 text-right tabular-nums text-zinc-300">
            {Number(merged.quality ?? 80)}
          </span>
        </label>
      )}

      {supportsLossless && (
        <label className="flex items-center gap-2 text-zinc-400">
          <input
            type="checkbox"
            checked={Boolean(merged.lossless)}
            disabled={disabled}
            onChange={(e) =>
              onOptionsChange({ ...options, lossless: e.target.checked })
            }
            className="accent-emerald-500"
          />
          Sin pérdida
        </label>
      )}
    </div>
  );
}

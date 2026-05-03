import { useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
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
      <p className="text-xs text-destructive">
        No hay un conversor disponible para {sourceMime} → {targetMime}.
      </p>
    );
  }

  const supportsQuality = 'quality' in defaults;
  const supportsLossless = 'lossless' in defaults;
  const qualityValue = Number(merged.quality ?? 80);

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Salida</span>
        <Select
          value={targetMime}
          onValueChange={onTargetChange}
          disabled={disabled}
        >
          <SelectTrigger size="sm" aria-label="Formato de salida">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {outputs.map((o) => (
              <SelectItem key={o.mime} value={o.mime}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {supportsQuality && !merged.lossless && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Calidad</span>
          <Slider
            aria-label="Calidad"
            min={1}
            max={100}
            step={1}
            value={[qualityValue]}
            disabled={disabled}
            onValueChange={([v]) =>
              onOptionsChange({ ...options, quality: v })
            }
            className="w-32"
          />
          <span className="w-8 text-right tabular-nums text-foreground">
            {qualityValue}
          </span>
        </div>
      )}

      {supportsLossless && (
        <label className="flex items-center gap-2 text-muted-foreground">
          <input
            type="checkbox"
            checked={Boolean(merged.lossless)}
            disabled={disabled}
            onChange={(e) =>
              onOptionsChange({ ...options, lossless: e.target.checked })
            }
            className="accent-primary"
          />
          Sin pérdida
        </label>
      )}
    </div>
  );
}

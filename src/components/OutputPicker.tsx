import { useEffect, useMemo, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { availableOutputsFor, engines, pick } from '../engines/registry';
import type { EncoderOptions } from '../engines/types';
import { labelForMime } from '../lib/jobs/context';

interface OutputPickerProps {
  idPrefix: string;
  sourceMime: string;
  targetMime: string;
  options: EncoderOptions;
  disabled?: boolean;
  /** Source image width in px. Undefined when the browser couldn't decode the file natively. */
  sourceWidth?: number;
  sourceHeight?: number;
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
  idPrefix,
  sourceMime,
  targetMime,
  options,
  disabled,
  sourceWidth,
  sourceHeight,
  onTargetChange,
  onOptionsChange,
}: OutputPickerProps) {
  const outputs = useMemo(() => availableOutputsFor(sourceMime), [sourceMime]);
  const route = pick(sourceMime, targetMime);
  const defaults = useMemo(() => findEncoderDefaults(targetMime), [targetMime]);
  const merged = { ...defaults, ...options };

  // Resize state. Off by default. When toggled on, the user can edit width
  // and height independently or via the % chips. The active size syncs to
  // options.resize so the worker picks it up at convert time.
  const [resizeOn, setResizeOn] = useState(false);
  const [keepRatio, setKeepRatio] = useState(true);
  const [resizeW, setResizeW] = useState(sourceWidth ?? 0);
  const [resizeH, setResizeH] = useState(sourceHeight ?? 0);

  // Reset resize inputs whenever the source changes (file replaced, etc.).
  useEffect(() => {
    setResizeW(sourceWidth ?? 0);
    setResizeH(sourceHeight ?? 0);
  }, [sourceWidth, sourceHeight]);

  // Sync resize state into encoder options. Strip the resize key cleanly when
  // the toggle is off or the inputs match the source size — no need to pay
  // for a no-op resize.
  useEffect(() => {
    const isMeaningful =
      resizeOn &&
      resizeW > 0 &&
      resizeH > 0 &&
      (resizeW !== sourceWidth || resizeH !== sourceHeight);
    if (isMeaningful) {
      onOptionsChange({ ...options, resize: { width: resizeW, height: resizeH } });
    } else if ('resize' in options) {
      const { resize: _drop, ...rest } = options;
      onOptionsChange(rest);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resizeOn, resizeW, resizeH]);

  if (!route) {
    return (
      <p className="text-xs text-destructive">
        No hay un conversor disponible para {labelForMime(sourceMime)} → {labelForMime(targetMime)}.
      </p>
    );
  }

  const supportsQuality = 'quality' in defaults;
  const supportsLossless = 'lossless' in defaults;
  const qualityValue = Number(merged.quality ?? 80);
  const canResize = sourceWidth !== undefined && sourceHeight !== undefined;
  const losslessId = `${idPrefix}-lossless-${route.encoder.id}`;
  const resizeId = `${idPrefix}-resize-${route.encoder.id}`;
  const resizeWidthId = `${idPrefix}-resize-w-${route.encoder.id}`;
  const resizeHeightId = `${idPrefix}-resize-h-${route.encoder.id}`;
  const resizeRatioId = `${idPrefix}-resize-ratio-${route.encoder.id}`;

  const onWidthChange = (next: number) => {
    setResizeW(next);
    if (keepRatio && sourceWidth && sourceHeight) {
      setResizeH(Math.max(1, Math.round((next * sourceHeight) / sourceWidth)));
    }
  };
  const onHeightChange = (next: number) => {
    setResizeH(next);
    if (keepRatio && sourceWidth && sourceHeight) {
      setResizeW(Math.max(1, Math.round((next * sourceWidth) / sourceHeight)));
    }
  };
  const applyPercent = (pctKey: string) => {
    if (!canResize || !sourceWidth || !sourceHeight) return;
    const pct = Number(pctKey) / 100;
    setResizeW(Math.max(1, Math.round(sourceWidth * pct)));
    setResizeH(Math.max(1, Math.round(sourceHeight * pct)));
  };
  const currentPercentValue =
    canResize && sourceWidth && sourceHeight
      ? [100, 75, 50, 25].find(
          (p) =>
            resizeW === Math.round((sourceWidth * p) / 100) &&
            resizeH === Math.round((sourceHeight * p) / 100),
        )?.toString() ?? ''
      : '';

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
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
          {route.encoder.qualityPresets && (
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={
                qualityValue === route.encoder.qualityPresets.high
                  ? 'high'
                  : qualityValue === route.encoder.qualityPresets.balanced
                    ? 'balanced'
                    : qualityValue === route.encoder.qualityPresets.small
                      ? 'small'
                      : ''
              }
              onValueChange={(key) => {
                if (!key) return;
                const v = route.encoder.qualityPresets![key as 'high' | 'balanced' | 'small'];
                onOptionsChange({ ...options, quality: v });
              }}
              disabled={disabled}
            >
              <ToggleGroupItem value="high">Alta</ToggleGroupItem>
              <ToggleGroupItem value="balanced">Equilibrado</ToggleGroupItem>
              <ToggleGroupItem value="small">Pequeño</ToggleGroupItem>
            </ToggleGroup>
          )}
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
        <div className="flex items-center gap-2">
          <Checkbox
            id={losslessId}
            checked={Boolean(merged.lossless)}
            disabled={disabled}
            onCheckedChange={(v) =>
              onOptionsChange({ ...options, lossless: v === true })
            }
          />
          <Label htmlFor={losslessId} className="text-muted-foreground">
            Sin pérdida
          </Label>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Switch
          id={resizeId}
          checked={resizeOn}
          disabled={disabled || !canResize}
          onCheckedChange={setResizeOn}
        />
        <Label
          htmlFor={resizeId}
          className={canResize ? 'text-muted-foreground' : 'text-muted-foreground/60'}
          title={canResize ? undefined : 'Tamaño no disponible para este formato'}
        >
          Redimensionar
        </Label>
      </div>
      </div>

      {resizeOn && canResize && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <Label htmlFor={resizeWidthId} className="text-muted-foreground">
              Ancho
            </Label>
            <Input
              id={resizeWidthId}
              type="number"
              min={1}
              value={resizeW}
              disabled={disabled}
              onChange={(e) => onWidthChange(Number(e.target.value))}
              className="h-8 w-20"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Label htmlFor={resizeHeightId} className="text-muted-foreground">
              Alto
            </Label>
            <Input
              id={resizeHeightId}
              type="number"
              min={1}
              value={resizeH}
              disabled={disabled}
              onChange={(e) => onHeightChange(Number(e.target.value))}
              className="h-8 w-20"
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id={resizeRatioId}
              checked={keepRatio}
              disabled={disabled}
              onCheckedChange={(v) => setKeepRatio(v === true)}
            />
            <Label
              htmlFor={resizeRatioId}
              className="text-muted-foreground"
            >
              Mantener proporción
            </Label>
          </div>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={currentPercentValue}
            onValueChange={(v) => v && applyPercent(v)}
            disabled={disabled}
          >
            <ToggleGroupItem value="100">100%</ToggleGroupItem>
            <ToggleGroupItem value="75">75%</ToggleGroupItem>
            <ToggleGroupItem value="50">50%</ToggleGroupItem>
            <ToggleGroupItem value="25">25%</ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}
    </div>
  );
}

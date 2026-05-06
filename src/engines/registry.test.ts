import { describe, expect, it } from 'vitest';
import { allInputMimes, availableOutputsFor, pick } from './registry';

describe('registry', () => {
  describe('pick', () => {
    it('returns a route for a supported source/target pair', () => {
      const route = pick('image/jpeg', 'image/webp');
      expect(route).not.toBeNull();
      expect(route?.engine.id).toBe('jsquash');
      expect(route?.decoder.id).toBe('jsquash-jpeg');
      expect(route?.encoder.id).toBe('jsquash-webp');
    });

    it('handles MIME aliases (image/jpg → jpeg)', () => {
      const route = pick('image/jpg', 'image/png');
      expect(route?.decoder.id).toBe('jsquash-jpeg');
      expect(route?.encoder.id).toBe('jsquash-png');
    });

    it('returns null when source MIME is unknown', () => {
      expect(pick('image/x-unknown', 'image/webp')).toBeNull();
    });

    it('returns null when target MIME is unsupported', () => {
      expect(pick('image/jpeg', 'image/heic')).toBeNull();
    });

    it('supports same-format conversion (re-encode pass)', () => {
      const route = pick('image/jpeg', 'image/jpeg');
      expect(route?.encoder.id).toBe('jsquash-jpeg');
    });

    it('routes cross-engine: vips decodes TIFF, jsquash encodes PNG', () => {
      const route = pick('image/tiff', 'image/png');
      expect(route?.decoder.id).toBe('vips-tiff');
      expect(route?.encoder.id).toBe('jsquash-png');
    });

    it('routes SVG via vips → any raster encoder', () => {
      const route = pick('image/svg+xml', 'image/webp');
      expect(route?.decoder.id).toBe('vips-svg');
      expect(route?.encoder.id).toBe('jsquash-webp');
    });

    it('routes a TIFF round-trip entirely through vips', () => {
      const route = pick('image/tiff', 'image/tiff');
      expect(route?.decoder.id).toBe('vips-tiff');
      expect(route?.encoder.id).toBe('vips-tiff');
    });
  });

  describe('availableOutputsFor', () => {
    it('lists every encoder across engines for a JPEG input', () => {
      const outputs = availableOutputsFor('image/jpeg');
      const mimes = outputs.map((o) => o.mime).sort();
      expect(mimes).toEqual([
        'image/avif',
        'image/gif',
        'image/jpeg',
        'image/jxl',
        'image/png',
        'image/tiff',
        'image/webp',
      ]);
    });

    it('returns the same set for a TIFF input (cross-engine)', () => {
      const outputs = availableOutputsFor('image/tiff');
      const mimes = outputs.map((o) => o.mime).sort();
      expect(mimes).toContain('image/png');
      expect(mimes).toContain('image/jpeg');
      expect(mimes).toContain('image/tiff');
    });

    it('returns an empty list for an unsupported input', () => {
      expect(availableOutputsFor('image/x-unknown')).toEqual([]);
    });

    it('deduplicates output MIMEs across engines', () => {
      const outputs = availableOutputsFor('image/jpeg');
      const mimes = outputs.map((o) => o.mime);
      expect(new Set(mimes).size).toBe(mimes.length);
    });
  });

  describe('allInputMimes', () => {
    it('returns the union of decoder input MIMEs across all engines', () => {
      const mimes = new Set(allInputMimes());
      // jsquash
      expect(mimes).toContain('image/jpeg');
      expect(mimes).toContain('image/jpg');
      expect(mimes).toContain('image/png');
      expect(mimes).toContain('image/webp');
      expect(mimes).toContain('image/avif');
      expect(mimes).toContain('image/jxl');
      // heic
      expect(mimes).toContain('image/heic');
      expect(mimes).toContain('image/heif');
      // gif
      expect(mimes).toContain('image/gif');
      // vips
      expect(mimes).toContain('image/tiff');
      expect(mimes).toContain('image/svg+xml');
    });
  });
});

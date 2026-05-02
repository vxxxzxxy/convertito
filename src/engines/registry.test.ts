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
      expect(pick('image/tiff', 'image/webp')).toBeNull();
    });

    it('returns null when target MIME is unsupported', () => {
      expect(pick('image/jpeg', 'image/heic')).toBeNull();
    });

    it('supports same-format conversion (re-encode pass)', () => {
      const route = pick('image/jpeg', 'image/jpeg');
      expect(route?.encoder.id).toBe('jsquash-jpeg');
    });
  });

  describe('availableOutputsFor', () => {
    it('lists all 5 jsquash outputs for a JPEG input', () => {
      const outputs = availableOutputsFor('image/jpeg');
      const mimes = outputs.map((o) => o.mime).sort();
      expect(mimes).toEqual([
        'image/avif',
        'image/jpeg',
        'image/jxl',
        'image/png',
        'image/webp',
      ]);
    });

    it('returns an empty list for an unsupported input', () => {
      expect(availableOutputsFor('image/tiff')).toEqual([]);
    });

    it('deduplicates output MIMEs across engines', () => {
      const outputs = availableOutputsFor('image/jpeg');
      const mimes = outputs.map((o) => o.mime);
      expect(new Set(mimes).size).toBe(mimes.length);
    });
  });

  describe('allInputMimes', () => {
    it('returns the union of decoder input MIMEs', () => {
      const mimes = allInputMimes().sort();
      expect(mimes).toEqual([
        'image/avif',
        'image/jpeg',
        'image/jpg',
        'image/jxl',
        'image/png',
        'image/webp',
      ]);
    });
  });
});

import { describe, expect, it } from 'vitest';
import { analyzeSvgDimensions, checkFileSize, checkPixelCount, combine, LIMITS } from './memory';

const MB = 1024 * 1024;

describe('memory checks', () => {
  describe('checkFileSize', () => {
    it('returns ok for small files', () => {
      expect(checkFileSize(1 * MB).level).toBe('ok');
    });

    it('warns above warnBytes threshold', () => {
      expect(checkFileSize(LIMITS.warnBytes + 1).level).toBe('warn');
    });

    it('blocks above blockBytes threshold', () => {
      const result = checkFileSize(LIMITS.blockBytes + 1);
      expect(result.level).toBe('block');
      expect(result.reason).toBeDefined();
    });
  });

  describe('checkPixelCount', () => {
    it('returns ok for normal images', () => {
      expect(checkPixelCount(1920, 1080).level).toBe('ok');
    });

    it('warns above warnPixels threshold', () => {
      const dim = Math.ceil(Math.sqrt(LIMITS.warnPixels + 1));
      expect(checkPixelCount(dim, dim).level).toBe('warn');
    });

    it('blocks above blockPixels threshold', () => {
      const dim = Math.ceil(Math.sqrt(LIMITS.blockPixels + 1));
      expect(checkPixelCount(dim, dim).level).toBe('block');
    });
  });

  describe('combine', () => {
    it('returns ok when all checks are ok', () => {
      expect(combine({ level: 'ok' }, { level: 'ok' }).level).toBe('ok');
    });

    it('escalates to warn when any check warns', () => {
      expect(combine({ level: 'ok' }, { level: 'warn', reason: 'big' }).level).toBe('warn');
    });

    it('escalates to block when any check blocks', () => {
      expect(
        combine({ level: 'warn', reason: 'big' }, { level: 'block', reason: 'too big' }).level,
      ).toBe('block');
    });

    it('joins reasons across all checks that have one', () => {
      const result = combine(
        { level: 'warn', reason: 'a' },
        { level: 'block', reason: 'b' },
        { level: 'ok' },
      );
      expect(result.reason).toContain('a');
      expect(result.reason).toContain('b');
    });

    it('returns no reason when no check provided one', () => {
      expect(combine({ level: 'ok' }).reason).toBeUndefined();
    });
  });
});

describe('memory checks (assumes navigator.deviceMemory undefined or >=4 in test env)', () => {
  it('uses full thresholds with no deviceMemory downgrade', () => {
    expect(checkFileSize(LIMITS.warnBytes - 1).level).toBe('ok');
  });
});

describe('analyzeSvgDimensions', () => {
  it('reads absolute SVG dimensions', () => {
    expect(analyzeSvgDimensions('<svg width="800" height="600" />')).toEqual({
      kind: 'absolute',
      width: 800,
      height: 600,
    });
  });

  it('derives missing height from width and viewBox ratio', () => {
    expect(analyzeSvgDimensions('<svg width="800" viewBox="0 0 16 9" />')).toEqual({
      kind: 'absolute',
      width: 800,
      height: 450,
    });
  });

  it('derives missing width from height and viewBox ratio', () => {
    expect(analyzeSvgDimensions('<svg height="450" viewBox="0 0 16 9" />')).toEqual({
      kind: 'absolute',
      width: 800,
      height: 450,
    });
  });

  it('treats percent sizing as viewBox-only', () => {
    expect(analyzeSvgDimensions('<svg width="100%" height="100%" viewBox="0 0 1200 800" />')).toEqual({
      kind: 'viewBox',
      width: 1200,
      height: 800,
    });
  });
});

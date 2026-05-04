/**
 * Lazy-loaded image resize via pica.
 *
 * pica is ~50 KB. Imported with `await import()` so it only enters the
 * worker bundle when a job actually needs to resize.
 *
 * Uses pica's `resizeBuffer` API which operates directly on RGBA bytes —
 * it never touches `<canvas>` or `getImageData`. That matters because
 * browsers with fingerprinting protection (Firefox `privacy.resistFingerprinting`,
 * Brave by default) block or randomize `canvas.getImageData()`, breaking
 * the canvas-based path with `Pica: cannot use getImageData on canvas`.
 */
export async function resizeImageData(
  image: ImageData,
  width: number,
  height: number,
): Promise<ImageData> {
  if (width === image.width && height === image.height) return image;
  const { default: Pica } = await import('pica');
  const pica = Pica();
  const src = new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.byteLength);
  const dst = await pica.resizeBuffer({
    src,
    width: image.width,
    height: image.height,
    toWidth: width,
    toHeight: height,
    // 0=nearest, 1=hamming, 2=lanczos2, 3=lanczos3 (default, best). 3 matches the
    // canvas path's default quality and is plenty fast for one-shot conversions.
    quality: 3,
  });
  return new ImageData(new Uint8ClampedArray(dst.buffer, dst.byteOffset, dst.byteLength), width, height);
}

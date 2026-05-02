import { allInputMimes, engines } from '../engines/registry';

/**
 * Pick a canonical MIME type for a File. Prefers the browser-provided
 * `file.type` when it matches a registered decoder; otherwise falls back to
 * extension lookup. Returns null if no decoder accepts the file.
 *
 * Why: Safari and some Linux browsers leave `file.type` empty for AVIF/JXL.
 */
export function detectMime(file: File): string | null {
  const known = allInputMimes();
  if (file.type && known.includes(file.type)) return file.type;
  const dot = file.name.lastIndexOf('.');
  if (dot < 0) return null;
  const ext = file.name.slice(dot + 1).toLowerCase();
  for (const engine of engines) {
    for (const decoder of engine.decoders) {
      if (decoder.inputExtensions.includes(ext)) {
        return decoder.inputMimes[0] ?? null;
      }
    }
  }
  return null;
}

export function replaceExtension(filename: string, newExt: string): string {
  const dot = filename.lastIndexOf('.');
  const base = dot < 0 ? filename : filename.slice(0, dot);
  return `${base}.${newExt}`;
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

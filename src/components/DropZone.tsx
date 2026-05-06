import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { labelForMime, useJobs } from '../lib/jobs/context';
import { inputExtensionsFor } from '../engines/registry';

export function DropZone() {
  const { addFiles, acceptedSourceMimes, state } = useJobs();
  const accept = useMemo(() => {
    const exts = inputExtensionsFor(acceptedSourceMimes).map((e) => `.${e}`);
    return [...acceptedSourceMimes, ...exts].join(',');
  }, [acceptedSourceMimes]);
  const formatList = useMemo(
    // Dedupe so MIME variants that map to the same label (e.g. image/tiff +
    // image/tif → "TIFF") only show once.
    () => Array.from(new Set(acceptedSourceMimes.map(labelForMime))).join(' · '),
    [acceptedSourceMimes],
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<string>('');
  const inputId = useId();

  // Wipe the status line when the user removes/cancels a job — the message
  // belongs to a previous drop and stops being relevant once the queue shrinks.
  const prevJobsLength = useRef(state.jobs.length);
  useEffect(() => {
    if (state.jobs.length < prevJobsLength.current) setStatus('');
    prevJobsLength.current = state.jobs.length;
  }, [state.jobs.length]);

  const handleFiles = useCallback(
    async (files: FileList | null | undefined) => {
      if (!files || files.length === 0) return;
      const r = await addFiles(Array.from(files));
      const parts: string[] = [];
      if (r.added > 0) parts.push(`Añadidos ${r.added}`);
      if (r.unsupported > 0) parts.push(`${r.unsupported} sin soporte`);
      if (r.blocked > 0) parts.push(`${r.blocked} demasiado grandes`);
      let msg = parts.length > 0 ? parts.join(' · ') : 'Ningún archivo añadido.';
      if (r.warnings.length > 0) {
        msg += ` — ${r.warnings.slice(0, 2).join(', ')}${r.warnings.length > 2 ? '…' : ''}`;
      }
      setStatus(msg);
    },
    [addFiles],
  );

  return (
    <div>
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={[
          'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition',
          dragOver
            ? 'border-primary bg-primary/10'
            : 'border-border bg-muted/40 hover:border-primary/60 hover:bg-primary/5',
        ].join(' ')}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mb-4 h-10 w-10 text-muted-foreground"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p className="text-base font-medium text-foreground">
          Arrastra imágenes aquí o haz click
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatList}
        </p>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          onChange={(e) => {
            handleFiles(e.target.files);
            // Reset so re-selecting the same file fires onChange again.
            e.target.value = '';
          }}
          className="sr-only"
        />
      </label>
      <p aria-live="polite" className="mt-2 min-h-[1.25rem] text-xs text-muted-foreground">
        {status}
      </p>
    </div>
  );
}

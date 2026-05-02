import { useCallback, useId, useRef, useState } from 'react';
import { useJobs } from '../lib/jobs/context';
import { allInputMimes } from '../engines/registry';

const ACCEPT = allInputMimes()
  .concat(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.jxl'])
  .join(',');

export function DropZone() {
  const { addFiles } = useJobs();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<string>('');
  const inputId = useId();

  const handleFiles = useCallback(
    (files: FileList | null | undefined) => {
      if (!files || files.length === 0) return;
      const r = addFiles(Array.from(files));
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
            ? 'border-emerald-400 bg-emerald-400/10'
            : 'border-zinc-700 bg-zinc-900/40 hover:border-zinc-500 hover:bg-zinc-900/60',
        ].join(' ')}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="mb-4 h-10 w-10 text-zinc-400"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        <p className="text-base font-medium text-zinc-100">
          Arrastra imágenes aquí o haz click
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          JPEG · PNG · WebP · AVIF · JPEG&nbsp;XL
        </p>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          onChange={(e) => {
            handleFiles(e.target.files);
            // Reset so re-selecting the same file fires onChange again.
            e.target.value = '';
          }}
          className="sr-only"
        />
      </label>
      <p aria-live="polite" className="mt-2 min-h-[1.25rem] text-xs text-zinc-500">
        {status}
      </p>
    </div>
  );
}

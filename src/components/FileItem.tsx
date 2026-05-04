import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Job } from '../lib/jobs/types';
import { useJobs } from '../lib/jobs/context';
import { formatBytes, replaceExtension, triggerDownload } from '../lib/files';
import { OutputPicker } from './OutputPicker';
import { JobProgress } from './JobProgress';

interface FileItemProps {
  job: Job;
}

export function FileItem({ job }: FileItemProps) {
  const { setTarget, setOptions, convert, cancel, remove } = useJobs();
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  // Generate a preview URL for the source file. We revoke when the file/job
  // changes so unloaded Job items don't leak.
  useEffect(() => {
    const url = URL.createObjectURL(job.file);
    setThumbUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [job.file]);

  const isRunning = job.status === 'running';
  const isPending = job.status === 'pending';
  const isFinal = job.status === 'done' || job.status === 'error' || job.status === 'cancelled';

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-start">
      <div className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-md bg-muted">
        {thumbUrl && (
          // eslint-disable-next-line jsx-a11y/alt-text
          <img src={thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <p className="truncate text-sm font-medium text-foreground" title={job.file.name}>
            {job.file.name}
          </p>
          <span className="text-xs text-muted-foreground">
            {formatBytes(job.file.size)} · {job.sourceMime.replace('image/', '')}
          </span>
        </div>
        <div className="mt-2">
          <OutputPicker
            sourceMime={job.sourceMime}
            targetMime={job.targetMime}
            options={job.options}
            disabled={isRunning}
            sourceWidth={job.sourceWidth}
            sourceHeight={job.sourceHeight}
            onTargetChange={(mime) => setTarget(job.id, mime)}
            onOptionsChange={(opts) => setOptions(job.id, opts)}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <JobProgress job={job} />
        </div>
      </div>
      <div className="flex items-center gap-2 self-start">
        {job.status === 'done' && job.output && (
          <button
            type="button"
            onClick={() => {
              const filename = replaceExtension(job.file.name, job.output!.extension);
              triggerDownload(job.output!.blob, filename);
            }}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            Descargar
          </button>
        )}
        {isPending && (
          <Button size="sm" onClick={() => convert(job.id)}>
            Convertir
          </Button>
        )}
        {isFinal && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => convert(job.id)}
            title="Volver a convertir con las opciones actuales"
          >
            Re-convertir
          </Button>
        )}
        {isRunning && (
          <button
            type="button"
            onClick={() => cancel(job.id)}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground/80 transition hover:border-foreground/30 hover:text-foreground"
          >
            Cancelar
          </button>
        )}
        <button
          type="button"
          onClick={() => remove(job.id)}
          aria-label={`Quitar ${job.file.name}`}
          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L10 8.94l3.47-3.47a.75.75 0 1 1 1.06 1.06L11.06 10l3.47 3.47a.75.75 0 1 1-1.06 1.06L10 11.06l-3.47 3.47a.75.75 0 0 1-1.06-1.06L8.94 10 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </li>
  );
}

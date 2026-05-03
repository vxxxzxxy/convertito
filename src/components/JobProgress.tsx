import { useEffect, useState } from 'react';
import type { Job } from '../lib/jobs/types';
import { formatBytes } from '../lib/files';

interface JobProgressProps {
  job: Job;
}

export function JobProgress({ job }: JobProgressProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (job.status !== 'running') return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [job.status]);

  if (job.status === 'queued') {
    return <span className="text-xs text-muted-foreground">En cola…</span>;
  }
  if (job.status === 'running') {
    const elapsed = job.startedAt ? ((now - job.startedAt) / 1000).toFixed(1) : '0.0';
    return (
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Convirtiendo… {elapsed}s
      </span>
    );
  }
  if (job.status === 'done' && job.output) {
    const ratio = job.output.bytes / job.file.size;
    const delta = (ratio * 100).toFixed(0);
    return (
      <span className="text-xs text-primary">
        Listo · {formatBytes(job.output.bytes)} ({delta}% del original)
      </span>
    );
  }
  if (job.status === 'cancelled') {
    return <span className="text-xs text-muted-foreground">Cancelado.</span>;
  }
  if (job.status === 'error') {
    return <span className="text-xs text-destructive">Error: {job.error}</span>;
  }
  return null;
}

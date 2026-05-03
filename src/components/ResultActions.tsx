import { useState } from 'react';
import { useJobs } from '../lib/jobs/context';
import { replaceExtension, triggerDownload } from '../lib/files';

export function ResultActions() {
  const { state, clearDone } = useJobs();
  const [zipping, setZipping] = useState(false);
  const doneJobs = state.jobs.filter((j) => j.status === 'done' && j.output);

  if (doneJobs.length === 0) return null;

  async function downloadZip() {
    if (doneJobs.length === 0 || zipping) return;
    setZipping(true);
    try {
      // Lazy-load client-zip so the bundle stays light when the feature is unused.
      const { downloadZip: makeZip } = await import('client-zip');
      const entries = doneJobs.map((j) => ({
        name: replaceExtension(j.file.name, j.output!.extension),
        lastModified: new Date(),
        input: j.output!.blob,
      }));
      const blob = await makeZip(entries).blob();
      triggerDownload(blob, 'convertito.zip');
    } finally {
      setZipping(false);
    }
  }

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-card px-4 py-3 text-sm">
      <span className="text-muted-foreground">
        {doneJobs.length} {doneJobs.length === 1 ? 'archivo listo' : 'archivos listos'}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={downloadZip}
          disabled={zipping || doneJobs.length === 0}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {zipping ? 'Empaquetando…' : 'Descargar todo (ZIP)'}
        </button>
        <button
          type="button"
          onClick={clearDone}
          disabled={zipping}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground/80 transition hover:border-foreground/30 hover:text-foreground disabled:opacity-50"
        >
          Limpiar listos
        </button>
      </div>
    </div>
  );
}

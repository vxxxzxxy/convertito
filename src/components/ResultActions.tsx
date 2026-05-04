import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useJobs } from '../lib/jobs/context';
import { replaceExtension, triggerDownload } from '../lib/files';

export function ResultActions() {
  const { state, convert, clearDone } = useJobs();
  const [zipping, setZipping] = useState(false);
  const doneJobs = state.jobs.filter((j) => j.status === 'done' && j.output);
  const pendingJobs = state.jobs.filter((j) => j.status === 'pending');

  // Show the bar when there's a bulk action that makes sense:
  // - 2+ pending → "Convertir todo" earns its keep (1 pending is already
  //   covered by the per-item button, no need to duplicate).
  // - any done → ZIP/clear actions.
  if (pendingJobs.length < 2 && doneJobs.length === 0) return null;

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

  function convertAll() {
    for (const job of pendingJobs) convert(job.id);
  }

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-card px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
        {pendingJobs.length >= 2 && (
          <span>{pendingJobs.length} por convertir</span>
        )}
        {doneJobs.length > 0 && (
          <span>
            {doneJobs.length} {doneJobs.length === 1 ? 'archivo listo' : 'archivos listos'}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {pendingJobs.length >= 2 && (
          <Button size="sm" onClick={convertAll}>
            Convertir todo
          </Button>
        )}
        {doneJobs.length > 0 && (
          <>
            <Button size="sm" onClick={downloadZip} disabled={zipping}>
              {zipping ? 'Empaquetando…' : 'Descargar todo (ZIP)'}
            </Button>
            <Button size="sm" variant="outline" onClick={clearDone} disabled={zipping}>
              Limpiar listos
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

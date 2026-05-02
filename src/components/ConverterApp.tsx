import { useEffect } from 'react';
import { JobsProvider, useJobs } from '../lib/jobs/context';
import { DropZone } from './DropZone';
import { FileItem } from './FileItem';
import { ResultActions } from './ResultActions';

function FileList() {
  const { state } = useJobs();

  // Debug panel visible in dev so we can see state without DevTools.
  const debugPanel = import.meta.env.DEV ? (
    <pre className="mt-3 overflow-x-auto rounded bg-rose-950/40 p-2 text-[10px] text-rose-200">
      [debug] jobs={state.jobs.length} active={state.activeId ?? 'none'}{'\n'}
      {state.jobs.map((j) => `  ${j.id.slice(0, 8)} ${j.sourceMime}→${j.targetMime} ${j.status}${j.error ? ' err=' + j.error : ''}`).join('\n')}
    </pre>
  ) : null;

  if (state.jobs.length === 0) return debugPanel;
  return (
    <>
      {debugPanel}
      <ul className="mt-6 space-y-3">
        {state.jobs.map((job) => (
          <FileItem key={job.id} job={job} />
        ))}
      </ul>
    </>
  );
}

function IsolationCheck() {
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (typeof self === 'undefined') return;
    if (!self.crossOriginIsolated) {
      // eslint-disable-next-line no-console
      console.warn(
        '[convertito] crossOriginIsolated is false. SharedArrayBuffer-based codecs (ffmpeg-mt) will not work. Check COOP/COEP headers.',
      );
    }
  }, []);
  return null;
}

export default function ConverterApp() {
  return (
    <JobsProvider>
      <IsolationCheck />
      <DropZone />
      <FileList />
      <ResultActions />
    </JobsProvider>
  );
}

import { useEffect } from 'react';
import { JobsProvider, useJobs } from '../lib/jobs/context';
import { DropZone } from './DropZone';
import { FileItem } from './FileItem';
import { ResultActions } from './ResultActions';

function FileList() {
  const { state } = useJobs();
  if (state.jobs.length === 0) return null;
  return (
    <ul className="mt-6 space-y-3">
      {state.jobs.map((job) => (
        <FileItem key={job.id} job={job} />
      ))}
    </ul>
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

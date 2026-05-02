import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import type { EncoderOptions } from '../../engines/types';
import { detectMime } from '../files';
import { checkFileSize } from '../memory';
import { spawnConvertWorker, transferConvertParams, type ConvertWorker } from '../workers';
import { initialJobsState, jobsReducer } from './reducer';
import type { Job, JobsState } from './types';

export interface AddFilesResult {
  added: number;
  unsupported: number;
  blocked: number;
  warnings: string[];
}

export interface JobsApi {
  state: JobsState;
  addFiles: (files: File[]) => AddFilesResult;
  setTarget: (id: string, targetMime: string) => void;
  setOptions: (id: string, options: EncoderOptions) => void;
  cancel: (id: string) => void;
  remove: (id: string) => void;
  clearDone: () => void;
}

const JobsContext = createContext<JobsApi | null>(null);

const DEFAULT_TARGET = 'image/webp';

export function JobsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(jobsReducer, initialJobsState);
  const workerRef = useRef<ConvertWorker | null>(null);
  // Hold the latest jobs in a ref so the runner effect can find the next
  // queued job without re-subscribing on every state mutation.
  const jobsRef = useRef(state.jobs);
  jobsRef.current = state.jobs;

  useEffect(() => {
    try {
      workerRef.current = spawnConvertWorker();
      // eslint-disable-next-line no-console
      console.log('[convertito] worker spawned ok');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[convertito] failed to spawn worker', e);
    }
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[convertito] state changed', {
      jobs: state.jobs.length,
      activeId: state.activeId,
      statuses: state.jobs.map((j) => j.status),
    });
  }, [state]);

  // Drive serial processing: whenever the worker is idle, pick up the next
  // queued job. The guard `activeId === null` and the per-job check
  // (status === 'queued') prevent double-starts even if the effect fires
  // multiple times.
  useEffect(() => {
    if (state.activeId !== null) return;
    const next = state.jobs.find((j) => j.status === 'queued');
    if (!next) return;
    void runJob(next);

    async function runJob(job: Job) {
      const worker = workerRef.current;
      if (!worker) return;
      dispatch({ type: 'START', id: job.id });
      try {
        const input = await job.file.arrayBuffer();
        const result = await worker.api.convert(
          transferConvertParams({
            input,
            sourceMime: job.sourceMime,
            targetMime: job.targetMime,
            options: job.options,
          }),
        );
        // If the user cancelled while we were awaiting, drop the result.
        const latest = jobsRef.current.find((j) => j.id === job.id);
        if (!latest || latest.status === 'cancelled' || latest.status === 'error') return;

        const blob = new Blob([result.bytes], { type: result.outputMime });
        const url = URL.createObjectURL(blob);
        dispatch({
          type: 'COMPLETE',
          id: job.id,
          output: {
            blob,
            url,
            extension: result.outputExtension,
            bytes: result.bytes.byteLength,
            mime: result.outputMime,
          },
        });
      } catch (err) {
        const latest = jobsRef.current.find((j) => j.id === job.id);
        if (latest?.status === 'cancelled') return;
        dispatch({
          type: 'ERROR',
          id: job.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }, [state.activeId, state.jobs]);

  // Revoke any remaining ObjectURLs on unmount.
  useEffect(
    () => () => {
      for (const job of jobsRef.current) {
        if (job.output) URL.revokeObjectURL(job.output.url);
      }
    },
    [],
  );

  const addFiles = useCallback((files: File[]): AddFilesResult => {
    const items: { file: File; sourceMime: string }[] = [];
    const warnings: string[] = [];
    let unsupported = 0;
    let blocked = 0;
    for (const file of files) {
      const mime = detectMime(file);
      if (!mime) {
        unsupported++;
        continue;
      }
      const memCheck = checkFileSize(file.size);
      if (memCheck.level === 'block') {
        blocked++;
        if (memCheck.reason) warnings.push(`${file.name}: ${memCheck.reason}`);
        continue;
      }
      if (memCheck.level === 'warn' && memCheck.reason) {
        warnings.push(`${file.name}: ${memCheck.reason}`);
      }
      items.push({ file, sourceMime: mime });
    }
    if (items.length > 0) {
      dispatch({
        type: 'ADD_FILES',
        payload: { items, defaultTarget: DEFAULT_TARGET },
      });
    }
    return { added: items.length, unsupported, blocked, warnings };
  }, []);

  const setTarget = useCallback(
    (id: string, targetMime: string) => dispatch({ type: 'SET_TARGET', id, targetMime }),
    [],
  );
  const setOptions = useCallback(
    (id: string, options: EncoderOptions) => dispatch({ type: 'SET_OPTIONS', id, options }),
    [],
  );
  const cancel = useCallback((id: string) => dispatch({ type: 'CANCEL', id }), []);
  const remove = useCallback((id: string) => dispatch({ type: 'REMOVE', id }), []);
  const clearDone = useCallback(() => dispatch({ type: 'CLEAR_DONE' }), []);

  const value = useMemo<JobsApi>(
    () => ({ state, addFiles, setTarget, setOptions, cancel, remove, clearDone }),
    [state, addFiles, setTarget, setOptions, cancel, remove, clearDone],
  );

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>;
}

export function useJobs(): JobsApi {
  const ctx = useContext(JobsContext);
  if (!ctx) throw new Error('useJobs must be used inside <JobsProvider>');
  return ctx;
}

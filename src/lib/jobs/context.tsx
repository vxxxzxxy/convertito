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
import { allInputMimes } from '../../engines/registry';
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
  addFiles: (files: File[]) => Promise<AddFilesResult>;
  setTarget: (id: string, targetMime: string) => void;
  setOptions: (id: string, options: EncoderOptions) => void;
  /** Start (or restart) the conversion for a job. Used by the "Convertir" / "Re-convertir" button. */
  convert: (id: string) => void;
  cancel: (id: string) => void;
  remove: (id: string) => void;
  clearDone: () => void;
  /** Source MIMEs this provider accepts. Resolved against the registry if no filter was passed. */
  acceptedSourceMimes: readonly string[];
}

const JobsContext = createContext<JobsApi | null>(null);

const FALLBACK_TARGET = 'image/webp';

const MIME_LABELS: Readonly<Record<string, string>> = {
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/avif': 'AVIF',
  'image/jxl': 'JPEG XL',
};

export function labelForMime(mime: string): string {
  return MIME_LABELS[mime] ?? mime;
}

export interface JobsProviderProps {
  children: ReactNode;
  /** Default output format for newly added files. Falls back to WebP. */
  defaultTargetMime?: string;
  /** Restrict which input MIMEs are accepted. If omitted, the full registry is allowed. */
  acceptedSourceMimes?: readonly string[];
}

export function JobsProvider({
  children,
  defaultTargetMime = FALLBACK_TARGET,
  acceptedSourceMimes,
}: JobsProviderProps) {
  const [state, dispatch] = useReducer(jobsReducer, initialJobsState);
  const workerRef = useRef<ConvertWorker | null>(null);
  // Hold the latest jobs in a ref so the runner effect can find the next
  // queued job without re-subscribing on every state mutation.
  const jobsRef = useRef(state.jobs);
  jobsRef.current = state.jobs;

  useEffect(() => {
    workerRef.current = spawnConvertWorker();
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

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

  // Capture latest config in a ref so the addFiles callback identity stays stable.
  const configRef = useRef({ defaultTargetMime, acceptedSourceMimes });
  configRef.current = { defaultTargetMime, acceptedSourceMimes };

  const addFiles = useCallback(async (files: File[]): Promise<AddFilesResult> => {
    const items: {
      file: File;
      sourceMime: string;
      sourceWidth?: number;
      sourceHeight?: number;
    }[] = [];
    const warnings: string[] = [];
    let unsupported = 0;
    let blocked = 0;
    const { defaultTargetMime: target, acceptedSourceMimes: accepted } = configRef.current;
    const acceptedSet = accepted ? new Set(accepted) : null;
    for (const file of files) {
      const mime = detectMime(file);
      if (!mime) {
        unsupported++;
        continue;
      }
      if (acceptedSet && !acceptedSet.has(mime)) {
        unsupported++;
        const allowed = accepted!.map(labelForMime).join(', ');
        warnings.push(`${file.name}: este conversor solo acepta ${allowed}`);
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
      // Sniff source dimensions via the browser's native decoder. Reads
      // headers only, ~ms even for large files. Fails gracefully on formats
      // the browser can't decode natively (e.g. JXL on Safari/Firefox) — the
      // resize UI will fall back to "unavailable for this file".
      let sourceWidth: number | undefined;
      let sourceHeight: number | undefined;
      try {
        const bitmap = await createImageBitmap(file);
        sourceWidth = bitmap.width;
        sourceHeight = bitmap.height;
        bitmap.close();
      } catch {
        /* unsupported native decode — leave dims undefined */
      }
      items.push({ file, sourceMime: mime, sourceWidth, sourceHeight });
    }
    if (items.length > 0) {
      dispatch({
        type: 'ADD_FILES',
        payload: { items, defaultTarget: target },
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
  const convert = useCallback((id: string) => dispatch({ type: 'CONVERT', id }), []);
  const cancel = useCallback((id: string) => dispatch({ type: 'CANCEL', id }), []);
  const remove = useCallback((id: string) => dispatch({ type: 'REMOVE', id }), []);
  const clearDone = useCallback(() => dispatch({ type: 'CLEAR_DONE' }), []);

  const resolvedAcceptedMimes = useMemo<readonly string[]>(
    () => acceptedSourceMimes ?? allInputMimes(),
    [acceptedSourceMimes],
  );

  const value = useMemo<JobsApi>(
    () => ({
      state,
      addFiles,
      setTarget,
      setOptions,
      convert,
      cancel,
      remove,
      clearDone,
      acceptedSourceMimes: resolvedAcceptedMimes,
    }),
    [
      state,
      addFiles,
      setTarget,
      setOptions,
      convert,
      cancel,
      remove,
      clearDone,
      resolvedAcceptedMimes,
    ],
  );

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>;
}

export function useJobs(): JobsApi {
  const ctx = useContext(JobsContext);
  if (!ctx) throw new Error('useJobs must be used inside <JobsProvider>');
  return ctx;
}

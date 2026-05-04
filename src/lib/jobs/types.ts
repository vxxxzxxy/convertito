import type { EncoderOptions } from '../../engines/types';

export type JobStatus = 'pending' | 'queued' | 'running' | 'done' | 'error' | 'cancelled';

export interface JobOutput {
  blob: Blob;
  /** ObjectURL — must be revoked on REMOVE / unmount to avoid leaks. */
  url: string;
  extension: string;
  bytes: number;
  mime: string;
}

export interface Job {
  id: string;
  file: File;
  sourceMime: string;
  /** Width of the source image in pixels. Undefined when the browser couldn't
   * decode the file natively to read its header (e.g. JXL on Safari/Firefox). */
  sourceWidth?: number;
  /** Height of the source image in pixels. See sourceWidth. */
  sourceHeight?: number;
  targetMime: string;
  options: EncoderOptions;
  status: JobStatus;
  output?: JobOutput;
  error?: string;
  startedAt?: number;
  endedAt?: number;
}

export interface JobsState {
  jobs: Job[];
  /** ID of the currently-running job; null when idle. v1 is serial. */
  activeId: string | null;
}

export type JobsAction =
  | {
      type: 'ADD_FILES';
      payload: {
        items: {
          file: File;
          sourceMime: string;
          sourceWidth?: number;
          sourceHeight?: number;
        }[];
        defaultTarget: string;
      };
    }
  | { type: 'SET_TARGET'; id: string; targetMime: string }
  | { type: 'SET_OPTIONS'; id: string; options: EncoderOptions }
  | { type: 'CONVERT'; id: string }
  | { type: 'START'; id: string }
  | { type: 'COMPLETE'; id: string; output: JobOutput }
  | { type: 'ERROR'; id: string; error: string }
  | { type: 'CANCEL'; id: string }
  | { type: 'REMOVE'; id: string }
  | { type: 'CLEAR_DONE' };

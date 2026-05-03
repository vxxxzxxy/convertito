import type { Job, JobsAction, JobsState } from './types';

export const initialJobsState: JobsState = { jobs: [], activeId: null };

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function patchJob(state: JobsState, id: string, patch: Partial<Job>): JobsState {
  return {
    ...state,
    jobs: state.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)),
  };
}

export function jobsReducer(state: JobsState, action: JobsAction): JobsState {
  switch (action.type) {
    case 'ADD_FILES': {
      const fresh: Job[] = action.payload.items.map(({ file, sourceMime }) => ({
        id: makeId(),
        file,
        sourceMime,
        targetMime: action.payload.defaultTarget,
        options: {},
        status: 'queued',
      }));
      return { ...state, jobs: [...state.jobs, ...fresh] };
    }
    case 'SET_TARGET': {
      // Changing the output format throws away the previous result and
      // re-queues so the runner produces a fresh blob in the new format.
      const job = state.jobs.find((j) => j.id === action.id);
      if (job?.output) URL.revokeObjectURL(job.output.url);
      return patchJob(state, action.id, {
        targetMime: action.targetMime,
        options: {},
        output: undefined,
        error: undefined,
        status: 'queued',
        startedAt: undefined,
        endedAt: undefined,
      });
    }
    case 'SET_OPTIONS':
      // Options are stored without re-running. The slider is chatty (onChange
      // fires per tick), so we don't want to re-encode 100 times during a drag.
      // The user clicks "Re-codificar" when they're happy with the values.
      return patchJob(state, action.id, { options: action.options });
    case 'REQUEUE': {
      const job = state.jobs.find((j) => j.id === action.id);
      if (job?.output) URL.revokeObjectURL(job.output.url);
      return patchJob(state, action.id, {
        status: 'queued',
        output: undefined,
        error: undefined,
        startedAt: undefined,
        endedAt: undefined,
      });
    }
    case 'START':
      return {
        ...state,
        activeId: action.id,
        jobs: state.jobs.map((j) =>
          j.id === action.id ? { ...j, status: 'running', startedAt: Date.now() } : j,
        ),
      };
    case 'COMPLETE':
      return {
        ...state,
        activeId: null,
        jobs: state.jobs.map((j) =>
          j.id === action.id
            ? { ...j, status: 'done', output: action.output, endedAt: Date.now() }
            : j,
        ),
      };
    case 'ERROR':
      return {
        ...state,
        activeId: null,
        jobs: state.jobs.map((j) =>
          j.id === action.id
            ? { ...j, status: 'error', error: action.error, endedAt: Date.now() }
            : j,
        ),
      };
    case 'CANCEL':
      return {
        ...state,
        activeId: state.activeId === action.id ? null : state.activeId,
        jobs: state.jobs.map((j) =>
          j.id === action.id && (j.status === 'running' || j.status === 'queued')
            ? { ...j, status: 'cancelled', endedAt: Date.now() }
            : j,
        ),
      };
    case 'REMOVE': {
      const job = state.jobs.find((j) => j.id === action.id);
      // Reducer side-effect: revoke the ObjectURL so we don't leak it.
      if (job?.output) URL.revokeObjectURL(job.output.url);
      return {
        ...state,
        activeId: state.activeId === action.id ? null : state.activeId,
        jobs: state.jobs.filter((j) => j.id !== action.id),
      };
    }
    case 'CLEAR_DONE': {
      for (const job of state.jobs) {
        if (job.status === 'done' && job.output) URL.revokeObjectURL(job.output.url);
      }
      return { ...state, jobs: state.jobs.filter((j) => j.status !== 'done') };
    }
    default:
      return state;
  }
}

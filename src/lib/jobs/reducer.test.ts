import { describe, expect, it, vi, beforeEach } from 'vitest';
import { initialJobsState, jobsReducer } from './reducer';
import type { JobOutput } from './types';

// Polyfill URL.revokeObjectURL so the reducer doesn't blow up in node.
const revokeSpy = vi.fn();
beforeEach(() => {
  revokeSpy.mockClear();
  if (typeof globalThis.URL === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).URL = {};
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).URL.revokeObjectURL = revokeSpy;
});

function fakeFile(name = 'a.jpg'): File {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], name, { type: 'image/jpeg' });
}

function fakeOutput(): JobOutput {
  return {
    blob: new Blob([new Uint8Array(10)], { type: 'image/webp' }),
    url: 'blob:fake-url',
    extension: 'webp',
    bytes: 10,
    mime: 'image/webp',
  };
}

describe('jobsReducer', () => {
  it('ADD_FILES appends pending jobs with the default target', () => {
    const next = jobsReducer(initialJobsState, {
      type: 'ADD_FILES',
      payload: {
        items: [{ file: fakeFile(), sourceMime: 'image/jpeg' }],
        defaultTarget: 'image/webp',
      },
    });
    expect(next.jobs).toHaveLength(1);
    expect(next.jobs[0]?.status).toBe('pending');
    expect(next.jobs[0]?.targetMime).toBe('image/webp');
    expect(next.jobs[0]?.options).toEqual({});
  });

  it('SET_TARGET resets options to defaults so stale knobs do not leak across formats', () => {
    let state = jobsReducer(initialJobsState, {
      type: 'ADD_FILES',
      payload: {
        items: [{ file: fakeFile(), sourceMime: 'image/jpeg' }],
        defaultTarget: 'image/webp',
      },
    });
    const id = state.jobs[0]!.id;
    state = jobsReducer(state, { type: 'SET_OPTIONS', id, options: { quality: 50 } });
    expect(state.jobs[0]?.options).toEqual({ quality: 50 });
    state = jobsReducer(state, { type: 'SET_TARGET', id, targetMime: 'image/avif' });
    expect(state.jobs[0]?.targetMime).toBe('image/avif');
    expect(state.jobs[0]?.options).toEqual({});
  });

  it('START sets activeId and marks job running with timestamp', () => {
    const seeded = jobsReducer(initialJobsState, {
      type: 'ADD_FILES',
      payload: {
        items: [{ file: fakeFile(), sourceMime: 'image/jpeg' }],
        defaultTarget: 'image/webp',
      },
    });
    const id = seeded.jobs[0]!.id;
    const next = jobsReducer(seeded, { type: 'START', id });
    expect(next.activeId).toBe(id);
    expect(next.jobs[0]?.status).toBe('running');
    expect(next.jobs[0]?.startedAt).toBeTypeOf('number');
  });

  it('COMPLETE clears activeId and stores the output', () => {
    let state = jobsReducer(initialJobsState, {
      type: 'ADD_FILES',
      payload: {
        items: [{ file: fakeFile(), sourceMime: 'image/jpeg' }],
        defaultTarget: 'image/webp',
      },
    });
    const id = state.jobs[0]!.id;
    state = jobsReducer(state, { type: 'START', id });
    state = jobsReducer(state, { type: 'COMPLETE', id, output: fakeOutput() });
    expect(state.activeId).toBeNull();
    expect(state.jobs[0]?.status).toBe('done');
    expect(state.jobs[0]?.output?.bytes).toBe(10);
  });

  it('ERROR records the message and clears activeId', () => {
    let state = jobsReducer(initialJobsState, {
      type: 'ADD_FILES',
      payload: {
        items: [{ file: fakeFile(), sourceMime: 'image/jpeg' }],
        defaultTarget: 'image/webp',
      },
    });
    const id = state.jobs[0]!.id;
    state = jobsReducer(state, { type: 'START', id });
    state = jobsReducer(state, { type: 'ERROR', id, error: 'boom' });
    expect(state.jobs[0]?.status).toBe('error');
    expect(state.jobs[0]?.error).toBe('boom');
    expect(state.activeId).toBeNull();
  });

  it('CANCEL only cancels jobs that are queued or running', () => {
    let state = jobsReducer(initialJobsState, {
      type: 'ADD_FILES',
      payload: {
        items: [{ file: fakeFile(), sourceMime: 'image/jpeg' }],
        defaultTarget: 'image/webp',
      },
    });
    const id = state.jobs[0]!.id;
    state = jobsReducer(state, { type: 'START', id });
    state = jobsReducer(state, { type: 'COMPLETE', id, output: fakeOutput() });
    state = jobsReducer(state, { type: 'CANCEL', id });
    // Already done — CANCEL must not regress to cancelled.
    expect(state.jobs[0]?.status).toBe('done');
  });

  it('REMOVE drops the job and revokes its ObjectURL', () => {
    let state = jobsReducer(initialJobsState, {
      type: 'ADD_FILES',
      payload: {
        items: [{ file: fakeFile(), sourceMime: 'image/jpeg' }],
        defaultTarget: 'image/webp',
      },
    });
    const id = state.jobs[0]!.id;
    state = jobsReducer(state, { type: 'START', id });
    state = jobsReducer(state, { type: 'COMPLETE', id, output: fakeOutput() });
    state = jobsReducer(state, { type: 'REMOVE', id });
    expect(state.jobs).toHaveLength(0);
    expect(revokeSpy).toHaveBeenCalledWith('blob:fake-url');
  });

  it('CLEAR_DONE removes only completed jobs and revokes their URLs', () => {
    let state = jobsReducer(initialJobsState, {
      type: 'ADD_FILES',
      payload: {
        items: [
          { file: fakeFile('a.jpg'), sourceMime: 'image/jpeg' },
          { file: fakeFile('b.jpg'), sourceMime: 'image/jpeg' },
        ],
        defaultTarget: 'image/webp',
      },
    });
    const ids = state.jobs.map((j) => j.id);
    // Finish job 0; leave job 1 queued.
    state = jobsReducer(state, { type: 'START', id: ids[0]! });
    state = jobsReducer(state, { type: 'COMPLETE', id: ids[0]!, output: fakeOutput() });
    state = jobsReducer(state, { type: 'CLEAR_DONE' });
    expect(state.jobs).toHaveLength(1);
    expect(state.jobs[0]?.id).toBe(ids[1]);
    expect(revokeSpy).toHaveBeenCalledTimes(1);
  });
});

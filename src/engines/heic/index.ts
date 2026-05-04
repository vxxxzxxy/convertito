import type { Engine } from '../types';
import { heicDecoder } from './decoders';

export const heicEngine: Engine = {
  id: 'heic',
  // jsquash is the primary image engine (priority 100); HEIC sits at 50 since
  // it covers a non-overlapping format. priority only matters when multiple
  // engines support the same source/target — currently no overlap.
  priority: 50,
  decoders: [heicDecoder],
  encoders: [],
};

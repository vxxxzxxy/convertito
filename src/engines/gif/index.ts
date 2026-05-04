import type { Engine } from '../types';
import { gifDecoder } from './decoders';
import { gifEncoder } from './encoders';

export const gifEngine: Engine = {
  id: 'gif',
  priority: 50,
  decoders: [gifDecoder],
  encoders: [gifEncoder],
};

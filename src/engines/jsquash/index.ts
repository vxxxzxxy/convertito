import type { Engine } from '../types';
import { jsquashDecoders } from './decoders';
import { jsquashEncoders } from './encoders';

export const jsquashEngine: Engine = {
  id: 'jsquash',
  priority: 100,
  decoders: jsquashDecoders,
  encoders: jsquashEncoders,
};

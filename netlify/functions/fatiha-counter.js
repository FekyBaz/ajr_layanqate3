import { withNetlifyRuntime } from './utils/runtime-adapter.js';
import { handler as coreHandler } from '../../server/functions/fatiha-counter.js';

export const handler = withNetlifyRuntime(coreHandler);

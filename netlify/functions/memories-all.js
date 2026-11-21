import { withNetlifyRuntime } from './utils/runtime-adapter.js';
import { handler as coreHandler } from '../../server/functions/memories-all.js';

export const handler = withNetlifyRuntime(coreHandler);

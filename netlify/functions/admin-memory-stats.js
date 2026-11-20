import { withNetlifyRuntime } from './utils/runtime-adapter.js';
import { handler as coreHandler } from '../../server/functions/admin-memory-stats.js';

export const handler = withNetlifyRuntime(coreHandler);

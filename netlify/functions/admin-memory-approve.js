import { withNetlifyRuntime } from './utils/runtime-adapter.js';
import { handler as coreHandler } from '../../server/functions/admin-memory-approve.js';

export const handler = withNetlifyRuntime(coreHandler);

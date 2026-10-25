import { withNetlifyRuntime } from './utils/runtime-adapter.js';
import { handler as coreHandler } from '../../server/functions/memory-create.js';

export const handler = withNetlifyRuntime(coreHandler);

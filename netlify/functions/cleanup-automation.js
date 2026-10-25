import { withNetlifyRuntime } from './utils/runtime-adapter.js';
import { handler as coreHandler } from '../../server/functions/cleanup-automation.js';

export const handler = withNetlifyRuntime(coreHandler);

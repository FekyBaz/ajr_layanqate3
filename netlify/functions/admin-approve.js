import { withNetlifyRuntime } from './utils/runtime-adapter.js';
import { handler as coreHandler } from '../../server/functions/admin-approve.js';

export const handler = withNetlifyRuntime(coreHandler);

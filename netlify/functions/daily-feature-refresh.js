import { withNetlifyRuntime } from './utils/runtime-adapter.js';
import { handler as coreHandler } from '../../server/functions/daily-feature-refresh.js';

export const handler = withNetlifyRuntime(coreHandler);

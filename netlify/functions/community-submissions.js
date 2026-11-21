import { withNetlifyRuntime } from './utils/runtime-adapter.js';
import { handler as coreHandler } from '../../server/functions/community-submissions.js';

export const handler = withNetlifyRuntime(coreHandler);

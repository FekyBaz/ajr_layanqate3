import { withNetlifyRuntime } from './utils/runtime-adapter.js';
import { handler as coreHandler } from '../../server/functions/community-submission-view.js';

export const handler = withNetlifyRuntime(coreHandler);

import { withNetlifyRuntime } from './utils/runtime-adapter.js';
import { handler as coreHandler } from '../../server/functions/community-share-track.js';

export const handler = withNetlifyRuntime(coreHandler);

import { withNetlifyRuntime } from './utils/runtime-adapter.js';
import { handler as coreHandler } from '../../server/functions/contact.js';

export const handler = withNetlifyRuntime(coreHandler);

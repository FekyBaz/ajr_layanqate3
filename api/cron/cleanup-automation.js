import { scheduledHandlerToVercel } from '../../server/vercel-adapter.js';
import { handler } from '../../server/functions/cleanup-automation.js';

export default scheduledHandlerToVercel(handler);

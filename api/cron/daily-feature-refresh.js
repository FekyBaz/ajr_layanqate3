import { scheduledHandlerToVercel } from '../../server/vercel-adapter.js';
import { handler } from '../../server/functions/daily-feature-refresh.js';

export default scheduledHandlerToVercel(handler);

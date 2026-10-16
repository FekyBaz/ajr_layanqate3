import { netlifyHandlerToVercel } from '../../../server/vercel-adapter.js';
import { handler } from '../../../server/functions/admin-memory-stats.js';

export default netlifyHandlerToVercel(handler);

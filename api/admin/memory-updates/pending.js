import { netlifyHandlerToVercel } from '../../../server/vercel-adapter.js';
import { handler } from '../../../server/functions/admin-memory-updates-pending.js';

export default netlifyHandlerToVercel(handler);

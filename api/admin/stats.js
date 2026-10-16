import { netlifyHandlerToVercel } from '../../server/vercel-adapter.js';
import { handler } from '../../server/functions/admin-stats.js';

export default netlifyHandlerToVercel(handler);

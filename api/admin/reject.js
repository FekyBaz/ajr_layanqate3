import { netlifyHandlerToVercel } from '../../server/vercel-adapter.js';
import { handler } from '../../server/functions/admin-reject.js';

export default netlifyHandlerToVercel(handler);

import { netlifyHandlerToVercel } from '../../server/vercel-adapter.js';
import { handler } from '../../server/functions/admin-approve.js';

export default netlifyHandlerToVercel(handler);

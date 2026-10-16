import { netlifyHandlerToVercel } from '../../server/vercel-adapter.js';
import { handler } from '../../server/functions/admin-feedback.js';

export default netlifyHandlerToVercel(handler);

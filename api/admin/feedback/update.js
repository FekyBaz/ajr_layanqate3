import { netlifyHandlerToVercel } from '../../../server/vercel-adapter.js';
import { handler } from '../../../server/functions/admin-feedback-update.js';

export default netlifyHandlerToVercel(handler);

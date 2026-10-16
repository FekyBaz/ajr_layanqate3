import { netlifyHandlerToVercel } from '../../server/vercel-adapter.js';
import { handler } from '../../server/functions/memories-recent.js';

export default netlifyHandlerToVercel(handler);

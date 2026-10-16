import { netlifyHandlerToVercel } from '../../server/vercel-adapter.js';
import { handler } from '../../server/functions/memories-all.js';

export default netlifyHandlerToVercel(handler);

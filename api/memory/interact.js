import { netlifyHandlerToVercel } from '../../server/vercel-adapter.js';
import { handler } from '../../server/functions/memory-interact.js';

export default netlifyHandlerToVercel(handler);

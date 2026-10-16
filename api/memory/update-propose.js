import { netlifyHandlerToVercel } from '../../server/vercel-adapter.js';
import { handler } from '../../server/functions/memory-update-propose.js';

export default netlifyHandlerToVercel(handler);

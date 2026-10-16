import { netlifyHandlerToVercel } from '../../server/vercel-adapter.js';
import { handler } from '../../server/functions/memory-create.js';

export default netlifyHandlerToVercel(handler);

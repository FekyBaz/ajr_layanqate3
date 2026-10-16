import { netlifyHandlerToVercel } from '../../server/vercel-adapter.js';
import { handler } from '../../server/functions/memory-view.js';

export default netlifyHandlerToVercel(handler);

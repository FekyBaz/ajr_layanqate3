import { netlifyHandlerToVercel } from '../../server/vercel-adapter.js';
import { handler } from '../../server/functions/ga-overview.js';

export default netlifyHandlerToVercel(handler);

import { netlifyHandlerToVercel } from '../../server/vercel-adapter.js';
import { handler } from '../../server/functions/ga-realtime.js';

export default netlifyHandlerToVercel(handler);

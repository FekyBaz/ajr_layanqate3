import { netlifyHandlerToVercel } from '../server/vercel-adapter.js';
import { handler } from '../server/functions/ga-config.js';

export default netlifyHandlerToVercel(handler);

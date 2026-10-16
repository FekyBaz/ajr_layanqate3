import { netlifyHandlerToVercel } from '../server/vercel-adapter.js';
import { handler } from '../server/functions/health.js';

export default netlifyHandlerToVercel(handler);

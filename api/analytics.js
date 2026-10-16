import { netlifyHandlerToVercel } from '../server/vercel-adapter.js';
import { handler } from '../server/functions/analytics.js';

export default netlifyHandlerToVercel(handler);

import { netlifyHandlerToVercel } from '../../server/vercel-adapter.js';
import { handler } from '../../server/functions/analytics-dashboard.js';

export default netlifyHandlerToVercel(handler);

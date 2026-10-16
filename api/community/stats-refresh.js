import { netlifyHandlerToVercel } from '../../server/vercel-adapter.js';
import { handler } from '../../server/functions/community-stats-refresh.js';

export default netlifyHandlerToVercel(handler);

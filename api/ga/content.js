import { netlifyHandlerToVercel } from '../../server/vercel-adapter.js';
import { handler } from '../../server/functions/ga-content.js';

export default netlifyHandlerToVercel(handler);

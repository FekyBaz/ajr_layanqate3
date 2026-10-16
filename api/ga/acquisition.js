import { netlifyHandlerToVercel } from '../../server/vercel-adapter.js';
import { handler } from '../../server/functions/ga-acquisition.js';

export default netlifyHandlerToVercel(handler);

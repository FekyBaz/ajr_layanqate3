import { netlifyHandlerToVercel } from '../../server/vercel-adapter.js';
import { handler } from '../../server/functions/community-share-track.js';

export default netlifyHandlerToVercel(handler);

import { netlifyHandlerToVercel } from '../server/vercel-adapter.js';
import { handler } from '../server/functions/contact.js';

export default netlifyHandlerToVercel(handler);

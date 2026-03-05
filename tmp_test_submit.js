
import { handler } from '../netlify/functions/submit.js';

const mockEvent = {
    httpMethod: 'POST',
    headers: {
        origin: 'http://localhost:8888',
        'x-forwarded-for': '127.0.0.1'
    },
    body: JSON.stringify({
        message: 'سبحان الله وبحمده سبحان الله العظيم',
        content_type: 'dhikr',
        author_name: 'Test User'
    })
};

// Set dummy env vars for local script test if needed
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy';

console.log('Running mock handler test...');
handler(mockEvent, {})
    .then(response => {
        console.log('Response Status:', response.statusCode);
        console.log('Response Body:', JSON.parse(response.body));
    })
    .catch(err => {
        console.error('Test Failed:', err);
    });

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env manually to avoid extra dependencies
const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
        let key = match[1];
        let value = match[2] || '';
        // Remove surrounding quotes
        if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
            value = value.substring(1, value.length - 1);
        }
        if (value.length > 0 && value.charAt(0) === "'" && value.charAt(value.length - 1) === "'") {
            value = value.substring(1, value.length - 1);
        }
        env[key] = value;
    }
});

const supabaseUrl = env.SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
// Wait, is there a SUPABASE_ANON_KEY in .env? Let's check.
const anonKey = env.SUPABASE_ANON_KEY || serviceRoleKey; // Use serviceRoleKey or fallback

console.log('Supabase URL:', supabaseUrl);
console.log('Using key type:', env.SUPABASE_ANON_KEY ? 'Anon' : 'Service Role');

const supabase = createClient(supabaseUrl, anonKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    }
});

async function run() {
    try {
        console.log('Testing select on memories table...');
        const { data, error, count } = await supabase
            .from('memories')
            .select('id, deceased_name, slug, approved_at', { count: 'exact' })
            .limit(5);

        if (error) {
            console.error('Query error:', error);
        } else {
            console.log('Query success! Count:', count);
            console.log('Data:', data);
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

run();

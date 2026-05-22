import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = '.env';
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
        let key = match[1];
        let value = match[2] || '';
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

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    }
});

async function run() {
    try {
        console.log('Testing query on memory_updates table...');
        const { data, error } = await supabase
            .from('memory_updates')
            .select('id')
            .limit(1);

        if (error) {
            console.log('Table memory_updates check failed:', error.message);
            if (error.message.includes('relation "public.memory_updates" does not exist') || error.message.includes('does not exist')) {
                console.log('STATUS: NOT_EXISTS');
            } else {
                console.log('STATUS: ERROR');
            }
        } else {
            console.log('STATUS: EXISTS');
            console.log('Data sample:', data);
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

run();

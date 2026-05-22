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

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    }
});

async function run() {
    try {
        console.log('--- Checking community_stats ---');
        const { data: statsData, error: statsError } = await supabase
            .from('community_stats')
            .select('*');

        if (statsError) {
            console.error('Stats error:', statsError);
        } else {
            console.log('Stats data:', statsData);
        }

        console.log('\n--- Checking sum from submissions ---');
        const { data: sumData, error: sumError } = await supabase
            .from('submissions')
            .select('post_count, status');

        if (sumError) {
            console.error('Sum error:', sumError);
        } else {
            const count = sumData.length;
            const totalShares = sumData.reduce((acc, curr) => acc + (curr.post_count || 0), 0);
            const approved = sumData.filter(s => s.status === 'Approved' || s.status === 'Posted');
            console.log(`Total submissions: ${count}`);
            console.log(`Approved/Posted submissions: ${approved.length}`);
            console.log(`Total shares in submissions table: ${totalShares}`);
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

run();

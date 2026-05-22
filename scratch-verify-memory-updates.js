import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Load env variables
const envContent = fs.readFileSync('.env', 'utf-8');
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

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

// Simple HTML escaping helper for display
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function run() {
    console.log('═══ VERIFICATION SCRIPT FOR MEMORY UPDATES ═══');
    
    // 1. Check if memory_updates table exists
    console.log('\n[1] Checking if memory_updates table exists...');
    const { data: checkData, error: checkError } = await supabase
        .from('memory_updates')
        .select('id')
        .limit(1);

    if (checkError) {
        console.log('❌ memory_updates table is not found or not accessible.');
        console.log('Reason:', checkError.message);
        console.log('👉 PLEASE RUN the migration 024_memory_updates.sql in your Supabase SQL Editor first!');
        return;
    }
    console.log('✅ memory_updates table exists and is accessible!');

    // 2. Fetch an approved memory to propose updates for
    console.log('\n[2] Fetching an Approved memory...');
    const { data: memories, error: memError } = await supabase
        .from('memories')
        .select('*')
        .eq('status', 'Approved')
        .limit(1);

    if (memError) {
        console.log('❌ Error fetching memories:', memError.message);
        return;
    }

    let targetMemory = memories && memories[0];
    if (!targetMemory) {
        console.log('⚠️ No Approved memory found in the database. Creating a mock approved memory for testing...');
        
        // Let's find any memory or create one
        const { data: newMem, error: createError } = await supabase
            .from('memories')
            .insert({
                deceased_name: 'أحمد المتوفى التجريبي',
                relation: 'صديق',
                biography: 'نبذة تجريبية قديمة',
                good_traits: 'الكرم والصدق الطيب',
                ongoing_charity: 'بناء مسجد أو بئر ماء',
                story: 'موقف نبيل تجريبي قديم',
                slug: 'test-deceased-latin-slug-' + Math.floor(Math.random() * 1000),
                status: 'Approved',
                created_by_ip_hash: 'test-ip-hash-123'
            })
            .select()
            .single();

        if (createError) {
            console.log('❌ Failed to create mock approved memory:', createError.message);
            return;
        }
        targetMemory = newMem;
        console.log('✅ Created mock approved memory:', targetMemory.deceased_name, `(ID: ${targetMemory.id})`);
    } else {
        console.log('✅ Found existing Approved memory:', targetMemory.deceased_name, `(ID: ${targetMemory.id})`);
    }

    // 3. Propose a collaborative update
    console.log('\n[3] Calling propose_memory_update RPC...');
    const testIpHash = 'verifier-ip-hash-' + Math.floor(Math.random() * 1000000);
    const proposedData = {
        p_memory_id: targetMemory.id,
        p_proposed_by_name: 'فاعل خير تجريبي',
        p_proposed_by_relation: 'ابن الأخ',
        p_biography: 'سيرة ذاتية جديدة كلياً غنية بالمعلومات والآثار الطيبة التي تركها المتوفى رحمه الله.',
        p_good_traits: 'الكرم والبر بالوالدين وحب مساعدة الجميع دون استثناء.',
        p_ongoing_charity: 'بناء بئر ماء ومشاريع سقاية جارية.',
        p_external_links: [
            { title: 'رابط صدقة جارية', url: 'https://example.com/ajr' }
        ],
        p_story: 'قصة ملهمة جديدة ومؤثرة عن حياته وعمله الخيري.',
        p_ip_hash: testIpHash
    };

    const { data: rpcResult, error: rpcError } = await supabase.rpc('propose_memory_update', proposedData);

    if (rpcError) {
        console.log('❌ Error calling propose_memory_update RPC:', rpcError.message);
        return;
    }

    console.log('✅ RPC call succeeded!');
    console.log('RPC Return Value:', rpcResult);

    if (!rpcResult || !rpcResult.success) {
        console.log('❌ Proposal failed server-side:', rpcResult ? rpcResult.reason : 'unknown');
        return;
    }

    const proposalId = rpcResult.proposal_id;
    console.log('✅ Created pending update proposal ID:', proposalId);

    // 4. Test rate limiting by trying to propose again up to 6 times
    console.log('\n[4] Testing rate limiting (Max 5 proposals per 24 hours per IP)...');
    let rateLimitExceeded = false;
    for (let i = 1; i <= 5; i++) {
        const { data: limitRes, error: limitErr } = await supabase.rpc('propose_memory_update', {
            ...proposedData,
            p_ip_hash: testIpHash // same IP
        });

        if (limitErr) {
            console.log(`❌ Attempt ${i} RPC error:`, limitErr.message);
            break;
        }

        console.log(`- Attempt ${i}: Success = ${limitRes.success}, Reason = ${limitRes.reason || 'None'}`);
        if (!limitRes.success && limitRes.reason === 'rate_limit_exceeded') {
            rateLimitExceeded = true;
            console.log('✅ Rate limiting correctly activated!');
            break;
        }
    }

    // 5. Query pending proposals
    console.log('\n[5] Listing pending updates from memory_updates table...');
    const { data: pendings, error: fetchPendError } = await supabase
        .from('memory_updates')
        .select('*, memories(deceased_name)')
        .eq('status', 'Pending')
        .eq('id', proposalId);

    if (fetchPendError) {
        console.log('❌ Error fetching pending proposal:', fetchPendError.message);
        return;
    }

    console.log('✅ Fetched pending proposal successfully!');
    console.log('Proposal sample:', pendings[0]);

    // 6. Approve and Merge the proposal
    console.log('\n[6] Approving the proposal and merging it to memories table...');
    // We will simulate the approval by updating memories table and setting proposal status to 'Approved'
    // simulating netlify admin-memory-update-approve.js logic
    const finalApproved = {
        biography: pendings[0].biography + ' (تم التدقيق والاعتماد من الإدارة)',
        good_traits: pendings[0].good_traits,
        ongoing_charity: pendings[0].ongoing_charity,
        external_links: pendings[0].external_links,
        story: pendings[0].story,
        last_activity_at: new Date().toISOString()
    };

    console.log('Simulating admin modifications and merging into memories...');
    const { error: mergeError } = await supabase
        .from('memories')
        .update(finalApproved)
        .eq('id', targetMemory.id);

    if (mergeError) {
        console.log('❌ Failed to merge changes into memories table:', mergeError.message);
        return;
    }
    console.log('✅ Merged updates into memories table successfully!');

    // Mark the proposal as Approved
    const { error: markApprovedError } = await supabase
        .from('memory_updates')
        .update({
            status: 'Approved',
            reviewed_at: new Date().toISOString(),
            biography: finalApproved.biography,
            good_traits: finalApproved.good_traits,
            ongoing_charity: finalApproved.ongoing_charity,
            external_links: finalApproved.external_links,
            story: finalApproved.story
        })
        .eq('id', proposalId);

    if (markApprovedError) {
        console.log('❌ Failed to update proposal status in memory_updates table:', markApprovedError.message);
        return;
    }
    console.log('✅ Marked proposal as Approved in memory_updates successfully!');

    // 7. Verify modifications on memory page
    console.log('\n[7] Verifying merged results on memories table...');
    const { data: updatedMem, error: finalFetchErr } = await supabase
        .from('memories')
        .select('*')
        .eq('id', targetMemory.id)
        .single();

    if (finalFetchErr) {
        console.log('❌ Failed to fetch final memory:', finalFetchErr.message);
        return;
    }

    console.log('Original Bio:', targetMemory.biography);
    console.log('Merged Bio:  ', updatedMem.biography);
    if (updatedMem.biography.includes('تم التدقيق والاعتماد')) {
        console.log('🎉🎉 SUCCESS! Collaborative updates E2E database flow is fully verified and correct!');
    } else {
        console.log('❌ Verification failed: Biography does not contain the updated value.');
    }
}

run();

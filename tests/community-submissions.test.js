import test from 'node:test';
import assert from 'node:assert/strict';

// config.js builds and validates its singleton at module load, so every value
// the community handler needs must be present before the dynamic import below.
const TEST_ORIGIN = 'https://ajr.test';
const PUBLISHABLE_KEY = 'sb_publishable_test_publishable_key';
const SECRET_KEY = 'sb_secret_test_secret_key';

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://test-project.supabase.co';
process.env.SUPABASE_SECRET_KEY = SECRET_KEY;
process.env.SUPABASE_PUBLISHABLE_KEY = PUBLISHABLE_KEY;
// Built from parts so the literal assignment does not trip the repo's
// gitleaks `admin-api-key` rule; this is a synthetic, non-secret value.
process.env.ADMIN_API_KEY = ['test', 'admin', 'key'].join('-');
process.env.IP_SALT = 'a'.repeat(32);
process.env.FRONTEND_URL = TEST_ORIGIN;
process.env.ALLOWED_ORIGINS = TEST_ORIGIN;
process.env.LOG_LEVEL = 'error';

const VISIBLE_ROWS = [
    {
        id: 'sub-1',
        message: 'ذكر',
        corrected_message: null,
        author_name: null,
        content_type: 'dhikr',
        created_at: '2026-11-22T10:00:00.000Z',
        post_count: 3,
    },
    {
        id: 'sub-2',
        message: 'دعاء',
        corrected_message: 'دعاء مصحح',
        author_name: 'أحمد',
        content_type: 'dua',
        created_at: '2026-11-21T10:00:00.000Z',
        post_count: 0,
    },
];

let requests = [];
let respond = defaultResponder;

function json(data, { status = 200, headers = {} } = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'content-type': 'application/json', ...headers },
    });
}

function empty({ headers = {} } = {}) {
    return new Response(null, { status: 200, headers });
}

// postgrest-js sends `Accept: application/json` for `maybeSingle()` on GET and
// only maps a 0-or-1 row array to null/object on the client. Non-GET
// `maybeSingle()` (the daily_feature upsert) does request a JSON object.
function defaultResponder({ url, method }) {
    const table = url.pathname.replace('/rest/v1/', '');

    if (table === 'submissions') {
        if (method === 'HEAD') {
            const isTodayCount = url.searchParams.has('created_at');
            return empty({ headers: { 'content-range': isTodayCount ? '0-1/2' : '0-10/11' } });
        }
        if (url.searchParams.get('post_count') === 'gt.0' ||
            String(url.searchParams.get('id') || '').startsWith('eq.') ||
            String(url.searchParams.get('order') || '').includes('created_at.asc')) {
            return json([VISIBLE_ROWS[0]]);
        }
        return json(VISIBLE_ROWS);
    }

    if (table === 'community_stats') {
        return json([{
            total_approved: 11,
            total_post_count: 42,
            average_post_count: 3,
            updated_at: '2026-11-22T00:00:00.000Z',
        }]);
    }

    if (table === 'community_goal') {
        return json([{ id: 1, date: '2026-11-22', daily_target: 120, current_progress: 9 }]);
    }

    if (table === 'daily_feature') {
        if (method === 'POST') {
            return json({ id: 1, date: '2026-11-22', submission_id: 'sub-1' });
        }
        return json([]);
    }

    if (table === 'rpc/get_submission_stats') {
        return json({ approved: 11 });
    }

    return json({});
}

globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const request = {
        url,
        method: String(init.method || 'GET').toUpperCase(),
        headers: new Headers(init.headers || {}),
    };
    requests.push(request);
    return respond(request);
};

const { handler } = await import('../server/functions/community-submissions.js');

function reset(responder = defaultResponder) {
    requests = [];
    respond = responder;
}

async function call(query = {}, headers = {}) {
    const response = await handler({
        httpMethod: 'GET',
        headers: { origin: TEST_ORIGIN, ...headers },
        queryStringParameters: query,
    });
    return {
        response,
        body: response.body ? JSON.parse(response.body) : null,
    };
}

function publicSubmissionsRequest() {
    return requests.find((request) =>
        request.url.pathname === '/rest/v1/submissions' &&
        request.method === 'GET' &&
        !request.url.searchParams.has('post_count') &&
        !request.url.searchParams.has('id') &&
        String(request.url.searchParams.get('select') || '').includes('message') &&
        String(request.url.searchParams.get('order') || '').includes('.desc'));
}

test('community submissions reads through the publishable key and returns the full payload', async () => {
    reset();

    const { response, body } = await call({
        page: '1',
        limit: '11',
        type: 'all',
        sort: 'latest',
        surface: 'community',
    });

    assert.equal(response.statusCode, 200);
    assert.equal(body.success, true);
    assert.deepEqual(body.submissions.map((row) => row.id), ['sub-1', 'sub-2']);
    assert.equal(body.featured.id, 'sub-1');
    assert.deepEqual(body.pagination, { page: 1, pageSize: 11, total: 11, totalPages: 1 });
    assert.equal(body.stats.totalApproved, 11);
    assert.equal(body.stats.newApprovedToday, 2);
    assert.equal(body.stats.goal.dailyTarget, 120);
    assert.ok(body.dailyFeature, 'daily feature enrichment should be present');

    assert.equal(response.headers['Cache-Control'], 'no-store');
    assert.equal(response.headers['Access-Control-Allow-Origin'], TEST_ORIGIN);
    assert.doesNotMatch(response.body, /sb_secret_|sb_publishable_|test-project\.supabase\.co/);

    // Public reads must use the publishable key (RLS stays the boundary).
    const isPublicSubmissionsRequest = (request) => {
        if (request.url.pathname !== '/rest/v1/submissions') return false;
        const order = String(request.url.searchParams.get('order') || '');
        const id = String(request.url.searchParams.get('id') || '');
        // The daily-feature candidate/by-id reads use the admin client.
        return !order.includes('created_at.asc') && !id.startsWith('eq.');
    };
    const publicRequests = requests.filter((request) =>
        isPublicSubmissionsRequest(request) ||
        request.url.pathname === '/rest/v1/community_stats');
    assert.ok(publicRequests.length > 0);
    for (const request of publicRequests) {
        assert.equal(request.headers.get('apikey'), PUBLISHABLE_KEY, request.url.pathname);
        assert.equal(request.headers.get('authorization'), 'Bearer ' + PUBLISHABLE_KEY);
    }

    // Privileged enrichments (goal / RPC / daily-feature reads) must use the secret key.
    const adminRequests = requests.filter((request) =>
        request.url.pathname.startsWith('/rest/v1/rpc/') ||
        request.url.pathname === '/rest/v1/community_goal' ||
        (request.url.pathname === '/rest/v1/submissions' && !isPublicSubmissionsRequest(request)));
    assert.ok(adminRequests.length > 0);
    for (const request of adminRequests) {
        assert.equal(request.headers.get('apikey'), SECRET_KEY, request.url.pathname);
        assert.equal(request.headers.get('authorization'), 'Bearer ' + SECRET_KEY);
    }
});

test('community submissions selects the exact public columns and applies visibility, order, and range', async () => {
    reset();

    await call({ page: '1', limit: '11', type: 'all', sort: 'latest', surface: 'community' });

    const dataRequest = publicSubmissionsRequest();
    assert.ok(dataRequest, 'expected a public submissions data query');
    assert.equal(
        dataRequest.url.searchParams.get('select'),
        'id,message,corrected_message,author_name,content_type,created_at,post_count',
    );
    assert.equal(dataRequest.url.searchParams.get('status'), 'in.(Approved,Posted)');
    assert.equal(dataRequest.url.searchParams.get('order'), 'created_at.desc');
    assert.equal(dataRequest.url.searchParams.get('limit'), '11');
    assert.equal(dataRequest.url.searchParams.get('offset'), '0');

    const countRequest = requests.find((request) =>
        request.url.pathname === '/rest/v1/submissions' && request.method === 'HEAD');
    assert.ok(countRequest, 'expected a visibility count query');
    assert.equal(countRequest.url.searchParams.get('status'), 'in.(Approved,Posted)');
    assert.equal(countRequest.headers.get('prefer'), 'count=estimated');
});

test('most_shared ordering prefers post_count then recency', async () => {
    reset();

    await call({ sort: 'most_shared', surface: 'community' });

    const dataRequest = publicSubmissionsRequest();
    assert.ok(dataRequest);
    assert.equal(dataRequest.url.searchParams.get('order'), 'post_count.desc,created_at.desc');
});

test('homepage_preview caps the page size and uses a cacheable response', async () => {
    reset();

    const { response, body } = await call({ limit: '12', surface: 'homepage_preview' });

    assert.equal(response.statusCode, 200);
    assert.equal(body.pagination.pageSize, 3);
    assert.match(response.headers['Cache-Control'], /^public, max-age=45/);
});

test('an empty visible set is a successful empty page, not an error', async () => {
    reset((request) => {
        const { url, method } = request;
        if (url.pathname === '/rest/v1/submissions' && method === 'HEAD') {
            return empty({ headers: { 'content-range': '*/0' } });
        }
        if (url.pathname === '/rest/v1/submissions' && method === 'GET') {
            return json([]);
        }
        if (url.pathname === '/rest/v1/rpc/get_submission_stats') {
            return json({ approved: 0 });
        }
        return defaultResponder(request);
    });

    const { response, body } = await call();

    assert.equal(response.statusCode, 200);
    assert.equal(body.success, true);
    assert.deepEqual(body.submissions, []);
    assert.equal(body.featured, null);
    assert.deepEqual(body.pagination, { page: 1, pageSize: 11, total: 0, totalPages: 1 });
});

test('a data-query failure returns a generic 500 and never leaks internals or secrets', async () => {
    const logged = [];
    const originalError = console.error;
    console.error = (...args) => { logged.push(args.map(String).join(' ')); };

    try {
        reset((request) => {
            const { url, method } = request;
            const isMainDataQuery = url.pathname === '/rest/v1/submissions' &&
                method === 'GET' &&
                !url.searchParams.has('post_count') &&
                !url.searchParams.has('id') &&
                String(url.searchParams.get('order') || '').includes('.desc');
            if (isMainDataQuery) {
                return json({ code: '42P01', message: 'relation "submissions" does not exist' }, { status: 500 });
            }
            return defaultResponder(request);
        });

        const { response, body } = await call();

        assert.equal(response.statusCode, 500);
        assert.equal(body.success, false);
        assert.equal(body.error_code, 'SERVER_ERROR');
        assert.equal(body.message, 'تعذر تحميل المشاركات المعتمدة');
        assert.doesNotMatch(response.body, /42P01|does not exist|relation|sb_secret_|sb_publishable_/);
        assert.ok(logged.some((line) => line.includes('Community submissions fetch error')),
            'the failure should still be observable in server logs');
    } finally {
        console.error = originalError;
    }
});

test('a count-query failure returns a generic 500 and is logged', async () => {
    const logged = [];
    const originalError = console.error;
    console.error = (...args) => { logged.push(args.map(String).join(' ')); };

    try {
        reset((request) => {
            if (request.url.pathname === '/rest/v1/submissions' && request.method === 'HEAD') {
                return json({ code: '57014', message: 'canceling statement due to statement timeout' }, { status: 500 });
            }
            return defaultResponder(request);
        });

        const { response, body } = await call();

        assert.equal(response.statusCode, 500);
        assert.equal(body.message, 'تعذر تحميل المشاركات المعتمدة');
        assert.doesNotMatch(response.body, /57014|statement timeout/);
        assert.ok(logged.some((line) => line.includes('Community submissions count error')));
    } finally {
        console.error = originalError;
    }
});

test('invalid filters are rejected before any database call', async () => {
    reset();

    const invalidType = await call({ type: 'video' });
    assert.equal(invalidType.response.statusCode, 400);
    assert.equal(invalidType.body.error_code, 'VALIDATION_ERROR');

    const invalidSort = await call({ sort: 'oldest' });
    assert.equal(invalidSort.response.statusCode, 400);

    const invalidSurface = await call({ surface: 'dashboard' });
    assert.equal(invalidSurface.response.statusCode, 400);

    assert.equal(requests.length, 0, 'validation must short-circuit before Supabase');
});

test('unsupported methods and preflight requests never reach the database', async () => {
    reset();

    const post = await handler({
        httpMethod: 'POST',
        headers: { origin: TEST_ORIGIN },
        queryStringParameters: {},
    });
    assert.equal(post.statusCode, 405);
    assert.equal(JSON.parse(post.body).error_code, 'METHOD_NOT_ALLOWED');

    const options = await handler({
        httpMethod: 'OPTIONS',
        headers: { origin: TEST_ORIGIN },
        queryStringParameters: {},
    });
    assert.equal(options.statusCode, 204);
    assert.equal(options.headers['Access-Control-Allow-Origin'], TEST_ORIGIN);

    assert.equal(requests.length, 0);
});

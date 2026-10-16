import test from 'node:test';
import assert from 'node:assert/strict';
import {
    netlifyHandlerToVercel,
    scheduledHandlerToVercel,
} from '../server/vercel-adapter.js';

function mockResponse() {
    return {
        headers: {},
        statusCode: 200,
        body: undefined,
        headersSent: false,
        setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
        end(body = '') { this.body = body; this.headersSent = true; },
    };
}

test('HTTP adapter maps request URL, headers, method, and JSON body', async () => {
    let capturedEvent;
    const handler = netlifyHandlerToVercel(async (event) => {
        capturedEvent = event;
        return {
            statusCode: 201,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accepted: true }),
        };
    });
    const req = {
        method: 'POST',
        url: '/api/submit?source=test',
        headers: { host: 'example.vercel.app', origin: 'https://example.vercel.app' },
        body: { message: 'test' },
    };
    const res = mockResponse();

    await handler(req, res);

    assert.equal(capturedEvent.httpMethod, 'POST');
    assert.equal(capturedEvent.path, '/api/submit');
    assert.deepEqual(capturedEvent.queryStringParameters, { source: 'test' });
    assert.equal(capturedEvent.body, JSON.stringify({ message: 'test' }));
    assert.equal(capturedEvent.headers.origin, 'https://example.vercel.app');
    assert.equal(res.statusCode, 201);
    assert.equal(res.body, JSON.stringify({ accepted: true }));
});

test('cron adapter rejects requests without a valid secret', async (t) => {
    const originalSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = 'test-cron-secret';
    t.after(() => {
        if (originalSecret === undefined) delete process.env.CRON_SECRET;
        else process.env.CRON_SECRET = originalSecret;
    });

    let invoked = false;
    const handler = scheduledHandlerToVercel(async () => {
        invoked = true;
        return { statusCode: 200, body: 'ok' };
    });
    const res = mockResponse();

    await handler({
        method: 'GET',
        url: '/api/cron/test',
        headers: { host: 'example.vercel.app' },
    }, res);

    assert.equal(res.statusCode, 401);
    assert.equal(invoked, false);
});

test('cron adapter invokes scheduled handlers without exposing an HTTP method', async (t) => {
    const originalSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = 'test-cron-secret';
    t.after(() => {
        if (originalSecret === undefined) delete process.env.CRON_SECRET;
        else process.env.CRON_SECRET = originalSecret;
    });

    let capturedEvent;
    const handler = scheduledHandlerToVercel(async (event) => {
        capturedEvent = event;
        return { statusCode: 200, headers: { 'Content-Type': 'text/plain' }, body: 'done' };
    });
    const res = mockResponse();

    await handler({
        method: 'GET',
        url: '/api/cron/test?now=1',
        headers: {
            host: 'example.vercel.app',
            authorization: 'Bearer test-cron-secret',
        },
    }, res);

    assert.equal(capturedEvent.httpMethod, undefined);
    assert.deepEqual(capturedEvent.queryStringParameters, { now: '1' });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body, 'done');
});

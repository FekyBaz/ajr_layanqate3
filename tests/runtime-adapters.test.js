import test from 'node:test';
import assert from 'node:assert/strict';
import { withNetlifyRuntime } from '../netlify/functions/utils/runtime-adapter.js';
import { netlifyHandlerToVercel } from '../server/vercel-adapter.js';

test('Netlify adapter normalizes headers and injects platform client IP', async () => {
    let capturedEvent;
    const originalEvent = {
        httpMethod: 'POST',
        headers: {
            'X-NF-Client-Connection-IP': '203.0.113.7',
            'CF-IPCountry': 'EG',
            Origin: 'https://ajr.example',
        },
        body: '{"message":"test"}',
    };
    const handler = withNetlifyRuntime(async (event) => {
        capturedEvent = event;
        return { statusCode: 200, body: 'ok' };
    });

    await handler(originalEvent, { requestId: 'test-request' });

    assert.equal(capturedEvent.clientIP, '203.0.113.7');
    assert.equal(capturedEvent.clientCountry, 'EG');
    assert.equal(capturedEvent.headers.origin, 'https://ajr.example');
    assert.equal(capturedEvent.httpMethod, 'POST');
    assert.equal(capturedEvent.body, originalEvent.body);
    assert.equal(originalEvent.clientIP, undefined, 'adapter should not mutate the provider event');
});

test('Vercel adapter normalizes the trusted client IP before calling a shared handler', async () => {
    let capturedEvent;
    const handler = netlifyHandlerToVercel(async (event) => {
        capturedEvent = event;
        return { statusCode: 200, body: 'ok' };
    });
    const res = {
        headers: {},
        statusCode: 200,
        body: undefined,
        headersSent: false,
        setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
        end(body = '') { this.body = body; this.headersSent = true; },
    };

    await handler({
        method: 'GET',
        url: '/api/test',
        headers: {
            host: 'example.vercel.app',
            'x-vercel-forwarded-for': '198.51.100.8, 10.0.0.1',
            'x-vercel-ip-country': 'EG',
            'x-forwarded-for': '192.0.2.99',
        },
    }, res);

    assert.equal(capturedEvent.clientIP, '198.51.100.8');
    assert.equal(capturedEvent.clientCountry, 'EG');
    assert.equal(capturedEvent.httpMethod, 'GET');
    assert.equal(res.statusCode, 200);
});

# Backend Runtime Portability

## Decision

The business handlers under `server/functions/` are the canonical implementation for the routed API endpoints. Files under `netlify/functions/` are deployment entry points only; they must not contain duplicate business logic. The Vercel catch-all dispatcher calls the same canonical handlers.

The shared handler contract remains intentionally small and compatible with the request shape already used by the application:

- Request event: `httpMethod`, normalized lowercase `headers`, `body`, `path`, `rawUrl`, `queryStringParameters`, normalized `clientIP`, and normalized `clientCountry`.
- Handler result: `{ statusCode, headers, body }`.
- Application handlers own validation, authorization, database operations, response bodies, and status codes.
- Runtime adapters own raw-request conversion, trusted client-IP extraction, and writing the result to the runtime response.

This is a shared Node.js function contract, not a claim that every handler can run unchanged in an Edge Runtime or an arbitrary language runtime. Shared code currently uses Node.js APIs and Supabase's JavaScript client.

## Runtime boundaries

### Netlify

Each routed function in `netlify/functions/` imports its matching handler from `server/functions/` and wraps it with `withNetlifyRuntime`. The adapter normalizes headers and maps Netlify's platform client-IP header to `event.clientIP`. It also maps available proxy country metadata to `event.clientCountry`.

### Vercel

`server/vercel-adapter.js` converts Vercel's request/response objects into the shared handler contract. Its platform-specific client-IP and country headers are resolved before the handler runs. `server/vercel-router.js` maps public API paths to canonical handlers; `vercel.json` owns Vercel routes and cron schedules.

### Shared application code

`server/functions/utils/shared.js` consumes normalized `event.clientIP` and a provider-neutral deployment-origin allowlist. Analytics handlers consume `event.clientCountry`. Shared application logic should not inspect Netlify- or Vercel-specific headers. Keep provider headers, framework request objects, response writers, and cron authentication at runtime boundaries.

## Portability rules

1. New business endpoints are implemented once under `server/functions/`.
2. Netlify and Vercel entry points should only adapt their platform event, dispatch to the shared handler, and translate the returned response.
3. Never copy a handler into a second platform directory. Add a route mapping and a thin entry point instead.
4. Runtime-specific environment-variable names are allowed only at an adapter/config boundary. Business logic should depend on validated, provider-neutral configuration.
5. Do not assume a shared handler makes scheduling, secrets, domains, deployment protection, logs, or failover portable. Those remain deployment concerns.
6. Keep database schema migrations explicit and separate from deploy hooks; never auto-apply production migrations during a deployment.

## Validation and rollout

- Run `npm test`, `npm run lint`, and the migration guard in CI.
- Verify every route in `server/vercel-router.js` maps to exactly one canonical handler and that each Netlify entry point delegates to it.
- Test each deployment in Preview/staging with isolated Supabase credentials. Include authorization failures, rate limits, scheduled requests, public reads, writes, CORS, and the memory Open Graph route.
- Keep Netlify as rollback until Vercel runtime checks pass with real staging configuration. A successful build or `/api/health` configuration check alone does not establish database connectivity or public reachability from Egyptian networks.
- Do not move DNS/custom domains or delete the rollback configuration as part of the portability refactor.

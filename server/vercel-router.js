/**
 * Hobby-plan-safe API dispatcher for Vercel.
 *
 * Vercel counts each JavaScript entry under /api as a Serverless Function.
 * Dispatching by pathname keeps this project below Hobby's 12-function cap,
 * while preserving the existing public API paths and handler implementations.
 */
import { netlifyHandlerToVercel, scheduledHandlerToVercel } from './vercel-adapter.js';
import { handler as adminApprove } from './functions/admin-approve.js';
import { handler as adminFeedback } from './functions/admin-feedback.js';
import { handler as adminFeedbackUpdate } from './functions/admin-feedback-update.js';
import { handler as adminMemoryUpdateApprove } from './functions/admin-memory-update-approve.js';
import { handler as adminMemoryUpdateReject } from './functions/admin-memory-update-reject.js';
import { handler as adminMemoryUpdatesPending } from './functions/admin-memory-updates-pending.js';
import { handler as adminMemoryApprove } from './functions/admin-memory-approve.js';
import { handler as adminMemoryPending } from './functions/admin-memory-pending.js';
import { handler as adminMemoryReject } from './functions/admin-memory-reject.js';
import { handler as adminMemoryStats } from './functions/admin-memory-stats.js';
import { handler as adminPending } from './functions/admin-pending.js';
import { handler as adminReject } from './functions/admin-reject.js';
import { handler as adminStats } from './functions/admin-stats.js';
import { handler as analytics } from './functions/analytics.js';
import { handler as analyticsDashboard } from './functions/analytics-dashboard.js';
import { handler as communityShareTrack } from './functions/community-share-track.js';
import { handler as communityStatsRefresh } from './functions/community-stats-refresh.js';
import { handler as communitySubmissionView } from './functions/community-submission-view.js';
import { handler as communitySubmissions } from './functions/community-submissions.js';
import { handler as contact } from './functions/contact.js';
import { handler as cleanupAutomation } from './functions/cleanup-automation.js';
import { handler as dailyFeatureRefresh } from './functions/daily-feature-refresh.js';
import { handler as fatihaCounter } from './functions/fatiha-counter.js';
import { handler as gaConfig } from './functions/ga-config.js';
import { handler as gaAcquisition } from './functions/ga-acquisition.js';
import { handler as gaContent } from './functions/ga-content.js';
import { handler as gaOverview } from './functions/ga-overview.js';
import { handler as gaRealtime } from './functions/ga-realtime.js';
import { handler as health } from './functions/health.js';
import { handler as memoriesAll } from './functions/memories-all.js';
import { handler as memoriesRecent } from './functions/memories-recent.js';
import { handler as memoryCreate } from './functions/memory-create.js';
import { handler as memoryInteract } from './functions/memory-interact.js';
import { handler as memoryUpdatePropose } from './functions/memory-update-propose.js';
import { handler as memoryView } from './functions/memory-view.js';
import { handler as submit } from './functions/submit.js';

const ROUTE_DEFINITIONS = [
    { path: '/api/admin/approve', handler: adminApprove },
    { path: '/api/admin/feedback', handler: adminFeedback },
    { path: '/api/admin/feedback/update', handler: adminFeedbackUpdate },
    { path: '/api/admin/memory-update/approve', handler: adminMemoryUpdateApprove },
    { path: '/api/admin/memory-update/reject', handler: adminMemoryUpdateReject },
    { path: '/api/admin/memory-updates/pending', handler: adminMemoryUpdatesPending },
    { path: '/api/admin/memory/approve', handler: adminMemoryApprove },
    { path: '/api/admin/memory/pending', handler: adminMemoryPending },
    { path: '/api/admin/memory/reject', handler: adminMemoryReject },
    { path: '/api/admin/memory/stats', handler: adminMemoryStats },
    { path: '/api/admin/pending', handler: adminPending },
    { path: '/api/admin/reject', handler: adminReject },
    { path: '/api/admin/stats', handler: adminStats },
    { path: '/api/analytics', handler: analytics },
    { path: '/api/analytics/dashboard', handler: analyticsDashboard },
    { path: '/api/community/share-track', handler: communityShareTrack },
    { path: '/api/community/stats-refresh', handler: communityStatsRefresh },
    { path: '/api/community/submission-view', handler: communitySubmissionView },
    { path: '/api/community/submissions', handler: communitySubmissions },
    { path: '/api/contact', handler: contact },
    { path: '/api/cron/cleanup-automation', handler: cleanupAutomation, scheduled: true },
    { path: '/api/cron/daily-feature-refresh', handler: dailyFeatureRefresh, scheduled: true },
    { path: '/api/fatiha-counter', handler: fatihaCounter },
    { path: '/api/ga-config', handler: gaConfig },
    { path: '/api/ga/acquisition', handler: gaAcquisition },
    { path: '/api/ga/content', handler: gaContent },
    { path: '/api/ga/overview', handler: gaOverview },
    { path: '/api/ga/realtime', handler: gaRealtime },
    { path: '/api/health', handler: health },
    { path: '/api/memories/all', handler: memoriesAll },
    { path: '/api/memories/recent', handler: memoriesRecent },
    { path: '/api/memory/create', handler: memoryCreate },
    { path: '/api/memory/interact', handler: memoryInteract },
    { path: '/api/memory/update-propose', handler: memoryUpdatePropose },
    { path: '/api/memory/view', handler: memoryView },
    { path: '/api/submit', handler: submit },
];

const ROUTES = new Map(ROUTE_DEFINITIONS.map(({ path, handler, scheduled }) => [
    path,
    scheduled ? scheduledHandlerToVercel(handler) : netlifyHandlerToVercel(handler),
]));

export const API_ROUTE_PATHS = Object.freeze(ROUTE_DEFINITIONS.map(({ path }) => path));

export default function vercelApiRouter(req, res) {
    const host = String(req.headers?.host || 'localhost');
    let pathname;

    try {
        const proto = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim();
        pathname = new URL(req.url || '/', `${proto}://${host}`).pathname;
    } catch {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, message: 'Invalid request URL', error_code: 'BAD_REQUEST' }));
        return;
    }

    while (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
    const route = ROUTES.get(pathname);

    if (!route) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.statusCode = 404;
        res.end(JSON.stringify({ success: false, message: 'Not found', error_code: 'NOT_FOUND' }));
        return;
    }

    return route(req, res);
}

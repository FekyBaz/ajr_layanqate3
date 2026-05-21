(function () {
    'use strict';

    const API_BASE = window.location.origin;
    let currentPeriod = '30d';

    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPeriod = btn.dataset.period;
            loadAnalytics();
        });
    });

    async function loadAnalytics() {
        const loading = document.getElementById('analyticsLoading');
        const content = document.getElementById('analyticsContent');
        loading.hidden = false;
        content.hidden = true;

        try {
            const response = await fetch(`${API_BASE}/api/analytics/dashboard?period=${currentPeriod}`, {
                headers: { 'X-Admin-Key': getAdminKey() },
            });

            if (!response.ok) throw new Error('Failed to load analytics');

            const result = await response.json();
            if (!result.success) throw new Error(result.message);

            renderDashboard(result);
            loading.hidden = true;
            content.hidden = false;
        } catch (err) {
            loading.textContent = 'فشل تحميل التحليلات. تأكد من تسجيل الدخول.';
        }
    }

    function getAdminKey() {
        return sessionStorage.getItem('adminKey') || '';
    }

    function renderDashboard(data) {
        renderOverview(data.overview);
        renderDailyTrend(data.overview.daily_trend);
        renderTrafficSources(data.traffic_sources);
        renderTopPages(data.top_pages);
        renderDevices(data.devices);
        renderGeography(data.geography);
        renderFunnels(data.funnels);
        renderRetention(data.retention);
    }

    function renderOverview(overview) {
        const container = document.getElementById('overviewStats');
        const stats = [
            { label: 'مشاهدات الصفحة', value: overview.page_views },
            { label: 'زوار فريدون', value: overview.unique_visitors },
            { label: 'زوار عائدين', value: overview.returning_visitors },
            { label: 'إجمالي الأحداث', value: overview.total_events },
            { label: 'أحداث/جلسة', value: overview.avg_events_per_session },
        ];
        container.innerHTML = stats.map(s => `
            <div class="stat-card">
                <div class="stat-value">${s.value.toLocaleString('ar-EG')}</div>
                <div class="stat-label">${s.label}</div>
            </div>
        `).join('');
    }

    function renderDailyTrend(trend) {
        const container = document.getElementById('dailyTrend');
        if (!trend || trend.length === 0) {
            container.innerHTML = '<p class="empty">لا توجد بيانات بعد</p>';
            return;
        }
        const maxViews = Math.max(...trend.map(d => d.views), 1);
        container.innerHTML = trend.slice(-14).map((d, i) => `
            <div class="bar-row">
                <span class="bar-label">${d.date}</span>
                <div class="bar-track"><div class="bar-fill" id="daily-bar-${i}"></div></div>
                <span class="bar-value">${d.views}</span>
            </div>
        `).join('');
        trend.slice(-14).forEach((d, i) => {
            const el = document.getElementById(`daily-bar-${i}`);
            if (el) el.style.width = `${(d.views / maxViews * 100).toFixed(1)}%`;
        });
    }

    function renderTrafficSources(sources) {
        const container = document.getElementById('trafficSources');
        if (!sources || sources.length === 0) {
            container.innerHTML = '<p class="empty">لا توجد بيانات بعد</p>';
            return;
        }
        const maxCount = Math.max(...sources.map(s => s.count), 1);
        container.innerHTML = sources.slice(0, 10).map((s, i) => `
            <div class="bar-row">
                <span class="bar-label">${s.source}</span>
                <div class="bar-track"><div class="bar-fill" id="source-bar-${i}"></div></div>
                <span class="bar-value">${s.count}</span>
            </div>
        `).join('');
        sources.slice(0, 10).forEach((s, i) => {
            const el = document.getElementById(`source-bar-${i}`);
            if (el) el.style.width = `${(s.count / maxCount * 100).toFixed(1)}%`;
        });
    }

    function renderTopPages(pages) {
        const container = document.getElementById('topPages');
        if (!pages || pages.length === 0) {
            container.innerHTML = '<tr><td colspan="3" class="empty">لا توجد بيانات بعد</td></tr>';
            return;
        }
        container.innerHTML = pages.slice(0, 10).map(p => `
            <tr>
                <td class="table-path">${p.path}</td>
                <td>${p.title || '—'}</td>
                <td>${p.views.toLocaleString('ar-EG')}</td>
            </tr>
        `).join('');
    }

    function renderDevices(devices) {
        const container = document.getElementById('devices');
        if (!devices || !devices.devices) {
            container.innerHTML = '<p class="empty">لا توجد بيانات بعد</p>';
            return;
        }
        const maxCount = Math.max(
            ...(devices.devices.map(d => d.count)),
            ...(devices.browsers.map(d => d.count)),
            1
        );
        container.innerHTML = `
            <h3 class="device-section-title">الأجهزة</h3>
            ${renderBarList(devices.devices, maxCount, 'device-bar-')}
            <h3 class="device-section-title">المتصفحات</h3>
            ${renderBarList(devices.browsers, maxCount, 'browser-bar-')}
        `;
    }

    function renderBarList(items, maxCount, prefix) {
        if (!items || items.length === 0) return '<p class="empty">—</p>';
        const html = items.slice(0, 8).map((d, i) => `
            <div class="bar-row">
                <span class="bar-label">${d.name}</span>
                <div class="bar-track"><div class="bar-fill" id="${prefix}${i}"></div></div>
                <span class="bar-value">${d.count}</span>
            </div>
        `).join('');
        setTimeout(() => {
            items.slice(0, 8).forEach((d, i) => {
                const el = document.getElementById(`${prefix}${i}`);
                if (el) el.style.width = `${(d.count / maxCount * 100).toFixed(1)}%`;
            });
        }, 0);
        return html;
    }

    function renderGeography(countries) {
        const container = document.getElementById('geography');
        if (!countries || countries.length === 0) {
            container.innerHTML = '<p class="empty">لا توجد بيانات بعد</p>';
            return;
        }
        const maxCount = Math.max(...countries.map(c => c.count), 1);
        container.innerHTML = countries.slice(0, 15).map((c, i) => `
            <div class="bar-row">
                <span class="bar-label">${c.country}</span>
                <div class="bar-track"><div class="bar-fill" id="geo-bar-${i}"></div></div>
                <span class="bar-value">${c.count}</span>
            </div>
        `).join('');
        countries.slice(0, 15).forEach((c, i) => {
            const el = document.getElementById(`geo-bar-${i}`);
            if (el) el.style.width = `${(c.count / maxCount * 100).toFixed(1)}%`;
        });
    }

    function renderFunnels(funnels) {
        const container = document.getElementById('funnels');
        if (!funnels) {
            container.innerHTML = '<p class="empty">لا توجد بيانات بعد</p>';
            return;
        }
        const l2i = funnels.landing_to_interaction || {};
        const l2s = funnels.landing_to_submission || {};
        const iRate = l2i.total > 0 ? Math.round(l2i.converted / l2i.total * 100) : 0;
        const sRate = l2s.total > 0 ? Math.round(l2s.converted / l2s.total * 100) : 0;

        container.innerHTML = `
            <div class="funnel-step">
                <span class="funnel-step-name">زيارة الصفحة الرئيسية</span>
                <span class="funnel-step-count">${(l2i.total || 0).toLocaleString('ar-EG')}</span>
                <span class="funnel-step-rate">100%</span>
            </div>
            <div class="funnel-step">
                <span class="funnel-step-name">تفاعل مع الصفحة</span>
                <span class="funnel-step-count">${(l2i.converted || 0).toLocaleString('ar-EG')}</span>
                <span class="funnel-step-rate">${iRate}%</span>
            </div>
            <div class="funnel-step">
                <span class="funnel-step-name">إرسال مشاركة</span>
                <span class="funnel-step-count">${(l2s.converted || 0).toLocaleString('ar-EG')}</span>
                <span class="funnel-step-rate">${sRate}%</span>
            </div>
        `;
    }

    function renderRetention(retention) {
        const container = document.getElementById('retention');
        if (!retention) {
            container.innerHTML = '<p class="empty">لا توجد بيانات بعد</p>';
            return;
        }
        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${retention.returning_rate || 0}%</div>
                    <div class="stat-label">نسبة الزوار العائدين</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${(retention.repeat_sessions || 0).toLocaleString('ar-EG')}</div>
                    <div class="stat-label">جلسات عائدين</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${(retention.total_sessions || 0).toLocaleString('ar-EG')}</div>
                    <div class="stat-label">إجمالي الجلسات</div>
                </div>
            </div>
        `;
    }

    loadAnalytics();
})();

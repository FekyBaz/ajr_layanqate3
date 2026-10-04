(function () {
    'use strict';

    var API_BASE = window.location.origin;
    var currentPeriod = '30d';
    var refreshTimer = null;
    var CONFIGURED = { ga4: false };

    var EL = {};

    function qs(id) { return document.getElementById(id); }

    function init() {
        EL.loading = qs('analyticsLoading');
        EL.content = qs('analyticsContent');
        EL.lastUpdate = qs('lastUpdate');
        EL.realtimeActive = qs('realtimeActive');
        EL.gaOverview = qs('gaOverview');
        EL.customOverview = qs('customOverview');
        EL.gaAcquisition = qs('gaAcquisition');
        EL.customSources = qs('customSources');
        EL.gaTopPages = qs('gaTopPages');
        EL.customTopPages = qs('customTopPages');
        EL.gaDevices = qs('gaDevices');
        EL.gaGeography = qs('gaGeography');
        EL.customFunnels = qs('customFunnels');
        EL.customRetention = qs('customRetention');
        EL.customFeatureUsage = qs('customFeatureUsage');
        EL.insights = qs('insights');
        EL.gaConfig = qs('gaConfig');
        EL.gaWarning = qs('gaWarning');

        document.querySelectorAll('.period-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                document.querySelectorAll('.period-btn').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                currentPeriod = btn.dataset.period;
                loadDashboard();
            });
        });

        loadDashboard();
        startRealtimePolling();
    }

    async function fetchJSON(url) {
        // Timeout-bounded (lib/fetch-utils.js when loaded, see #145).
        var doFetch = globalThis.FetchUtils
            ? globalThis.FetchUtils.fetchWithTimeout
            : fetch;
        var response = await doFetch(API_BASE + url, {
            headers: { 'X-Admin-Key': getAdminKey() },
        });
        if (!response.ok) {
            var errMsg = 'HTTP ' + response.status;
            try {
                var errData = await response.json();
                if (errData && errData.message) {
                    errMsg = errData.message;
                }
            } catch (e) {}
            throw new Error(errMsg);
        }
        var data = await response.json();
        if (!data.success) throw new Error(data.message || 'API error');
        return data;
    }

    function getAdminKey() {
        return sessionStorage.getItem('adminKey') || '';
    }

    async function loadDashboard() {
        EL.loading.hidden = false;
        EL.content.hidden = true;

        try {
            var [custom, gaOverview, gaContent, gaAcquisition] = await Promise.all([
                fetchJSON('/api/analytics/dashboard?period=' + currentPeriod),
                fetchJSON('/api/ga/overview?period=' + currentPeriod).catch(function (err) { return { error: err.message || err }; }),
                fetchJSON('/api/ga/content?period=' + currentPeriod).catch(function (err) { return { error: err.message || err }; }),
                fetchJSON('/api/ga/acquisition?period=' + currentPeriod).catch(function (err) { return { error: err.message || err }; }),
            ]);

            CONFIGURED.ga4 = gaOverview && gaOverview.configured === true;

            renderGAOverview(gaOverview);
            renderCustomOverview(custom);
            renderGAAcquisition(gaAcquisition);
            renderCustomSources(custom);
            renderGATopPages(gaContent);
            renderCustomTopPages(custom);
            renderGADevices(gaContent);
            renderGAGeography(gaContent);
            renderCustomFunnels(custom);
            renderCustomRetention(custom);
            renderCustomFeatureUsage(custom);
            renderInsights({ custom: custom, ga: gaOverview, acq: gaAcquisition, configured: CONFIGURED.ga4 });
            applyBarWidths(document);

            EL.loading.hidden = true;
            EL.content.hidden = false;
            EL.lastUpdate.textContent = new Date().toLocaleString('ar-SA');
        } catch (err) {
            EL.loading.textContent = 'فشل تحميل التحليلات. تأكد من تسجيل الدخول.';
        }
    }

    function startRealtimePolling() {
        pollRealtime();
        refreshTimer = setInterval(pollRealtime, 30000);
    }

    async function pollRealtime() {
        try {
            var data = await fetchJSON('/api/ga/realtime');
            if (data && data.configured && data.realtime) {
                EL.realtimeActive.textContent = data.realtime.active_users || 0;
            }
        } catch (e) {}
    }

    function renderGAOverview(data) {
        if (!data || data.error || !data.configured) {
            EL.gaWarning.hidden = false;
            if (data && data.error) {
                EL.gaWarning.innerHTML = '⚙️ <strong>فشل الاتصال بـ Google Analytics 4:</strong> ' + esc(data.error) + '<br><small>تأكد من تفعيل Analytics Data API في Google Cloud Console، وإعطاء حساب الخدمة (Service Account Email) صلاحية القراءة (Viewer) داخل حساب Google Analytics الخاص بك.</small>';
            } else {
                EL.gaWarning.innerHTML = '⚙️ <strong>Google Analytics غير مهيأ</strong> — قم بتعيين <code>GA4_PROPERTY_ID</code> مع حساب الخدمة (<code>GOOGLE_SERVICE_ACCOUNT_JSON</code>) أو بيانات OAuth (<code>GOOGLE_CLIENT_ID</code> + <code>GOOGLE_CLIENT_SECRET</code> + <code>GOOGLE_REFRESH_TOKEN</code>) في متغيرات Netlify البيئية.';
            }
            EL.gaOverview.innerHTML = '';
            EL.gaOverview.parentElement.hidden = false;
            EL.gaConfig.hidden = false;
            return;
        }
        EL.gaWarning.hidden = true;
        EL.gaConfig.hidden = true;
        EL.gaOverview.parentElement.hidden = false;
        var o = data.overview || {};
        EL.gaOverview.innerHTML = [
            { label: 'المستخدمون النشطون', value: o.active_users },
            { label: 'الجلسات', value: o.sessions },
            { label: 'مشاهدات الصفحة', value: o.page_views },
            { label: 'مدة الجلسة', value: o.avg_session_duration },
            { label: 'معدل الارتداد', value: o.bounce_rate + '%' },
            { label: 'مستخدمون جدد', value: o.new_users },
        ].map(function (s) {
            return '<div class="stat-card"><div class="stat-value">' + s.value.toLocaleString('ar-EG') + '</div><div class="stat-label">' + s.label + '</div></div>';
        }).join('');
    }

    function renderCustomOverview(data) {
        var o = data.overview || {};
        EL.customOverview.innerHTML = [
            { label: 'زوار فريدون', value: o.unique_visitors },
            { label: 'زوار عائدون', value: o.returning_visitors },
            { label: 'إجمالي الأحداث', value: o.total_events },
            { label: 'أحداث/جلسة', value: o.avg_events_per_session },
        ].map(function (s) {
            return '<div class="stat-card"><div class="stat-value">' + (s.value || 0).toLocaleString('ar-EG') + '</div><div class="stat-label">' + s.label + '</div></div>';
        }).join('');
    }

    // CSP-safe widths: templates carry data-bar-width, applied programmatically below (#108).
    function applyBarWidths(root) {
        (root || document).querySelectorAll('.bar-fill[data-bar-width]').forEach(function (bar) {
            bar.style.width = bar.getAttribute('data-bar-width') + '%';
            bar.removeAttribute('data-bar-width');
        });
    }

    function renderTable(container, items, columns, emptyMsg) {
        if (!items || items.length === 0) {
            container.innerHTML = '<tr><td colspan="' + columns.length + '" class="empty">' + (emptyMsg || 'لا توجد بيانات بعد') + '</td></tr>';
            return;
        }
        container.innerHTML = items.map(function (item) {
            return '<tr>' + columns.map(function (col) {
                var val = item[col.key];
                if (val === undefined || val === null) val = '—';
                if (col.format === 'number') val = val.toLocaleString('ar-EG');
                if (col.format === 'pct') val = val + '%';
                if (col.class) return '<td class="' + col.class + '">' + esc(String(val)) + '</td>';
                return '<td>' + esc(String(val)) + '</td>';
            }).join('') + '</tr>';
        }).join('');
    }

    function renderGAAcquisition(data) {
        if (!data || data.error || !data.configured) { 
            EL.gaAcquisition.innerHTML = '<p class="empty">' + (data && data.error ? 'فشل تحميل قنوات الاكتساب: ' + esc(data.error) : 'GA4 غير مهيأ') + '</p>'; 
            return; 
        }
        var acq = data.acquisition || {};
        var channels = acq.channels || [];
        var sources = acq.sources || [];
        var maxChan = Math.max.apply(null, channels.map(function (c) { return c.sessions; }), 1);
        var maxSrc = Math.max.apply(null, sources.map(function (c) { return c.sessions; }), 1);
        var html = '';
        if (channels.length > 0) {
            html += '<h4 class="subsection-title">القنوات</h4>';
            channels.slice(0, 8).forEach(function (c, i) {
                html += '<div class="bar-row"><span class="bar-label">' + esc(c.channel) + '</span><div class="bar-track"><div class="bar-fill" data-bar-width="' + (c.sessions / maxChan * 100).toFixed(1) + '%"></div></div><span class="bar-value">' + c.sessions.toLocaleString('ar-EG') + '</span></div>';
            });
        }
        if (sources.length > 0) {
            html += '<h4 class="subsection-title">المصادر</h4>';
            sources.slice(0, 8).forEach(function (s, i) {
                html += '<div class="bar-row"><span class="bar-label">' + esc(s.source) + '</span><div class="bar-track"><div class="bar-fill" data-bar-width="' + (s.sessions / maxSrc * 100).toFixed(1) + '%"></div></div><span class="bar-value">' + s.sessions.toLocaleString('ar-EG') + '</span></div>';
            });
        }
        if (!html) html = '<p class="empty">لا توجد بيانات بعد</p>';
        EL.gaAcquisition.innerHTML = html;
    }

    function renderCustomSources(data) {
        var sources = data.traffic_sources || [];
        if (sources.length === 0) { EL.customSources.innerHTML = '<p class="empty">لا توجد بيانات بعد</p>'; return; }
        var max = Math.max.apply(null, sources.map(function (s) { return s.count; }), 1);
        EL.customSources.innerHTML = sources.slice(0, 10).map(function (s, i) {
            return '<div class="bar-row"><span class="bar-label">' + esc(s.source || 'مباشر') + '</span><div class="bar-track"><div class="bar-fill" data-bar-width="' + (s.count / max * 100).toFixed(1) + '%"></div></div><span class="bar-value">' + s.count.toLocaleString('ar-EG') + '</span></div>';
        }).join('');
    }

    function renderGATopPages(data) {
        if (!data || data.error || !data.configured) {
            EL.gaTopPages.parentElement.hidden = false;
            EL.gaTopPages.innerHTML = '<tr><td colspan="4" class="empty">' + (data && data.error ? 'فشل تحميل الصفحات الأكثر زيارة: ' + esc(data.error) : 'GA4 غير مهيأ') + '</td></tr>';
            return;
        }
        EL.gaTopPages.parentElement.hidden = false;
        var pages = (data.top_pages || []).slice(0, 10);
        renderTable(EL.gaTopPages, pages, [
            { key: 'path', label: 'المسار', class: 'table-path' },
            { key: 'title', label: 'العنوان' },
            { key: 'views', label: 'المشاهدات', format: 'number' },
            { key: 'users', label: 'المستخدمون', format: 'number' },
        ]);
    }

    function renderCustomTopPages(data) {
        var pages = data.top_pages || [];
        renderTable(EL.customTopPages, pages, [
            { key: 'path', label: 'المسار', class: 'table-path' },
            { key: 'title', label: 'العنوان' },
            { key: 'views', label: 'المشاهدات', format: 'number' },
        ]);
    }

    function renderGADevices(data) {
        if (!data || data.error || !data.configured) { EL.gaDevices.innerHTML = '<p class="empty">' + (data && data.error ? 'فشل تحميل الأجهزة والمتصفحات: ' + esc(data.error) : 'GA4 غير مهيأ') + '</p>'; return; }
        var devices = data.devices || {};
        var allDevices = devices.devices || [];
        var browsers = devices.browsers || [];
        var maxD = Math.max.apply(null, allDevices.map(function (d) { return d.users; }), 1);
        var maxB = Math.max.apply(null, browsers.map(function (b) { return b.users; }), 1);
        var html = '';
        if (allDevices.length > 0) {
            html += '<h4 class="subsection-title">الأجهزة</h4>';
            allDevices.forEach(function (d) {
                html += '<div class="bar-row"><span class="bar-label">' + esc(d.category) + '</span><div class="bar-track"><div class="bar-fill" data-bar-width="' + (d.users / maxD * 100).toFixed(1) + '%"></div></div><span class="bar-value">' + d.users.toLocaleString('ar-EG') + '</span></div>';
            });
        }
        if (browsers.length > 0) {
            html += '<h4 class="subsection-title">المتصفحات</h4>';
            browsers.slice(0, 6).forEach(function (b) {
                html += '<div class="bar-row"><span class="bar-label">' + esc(b.name) + '</span><div class="bar-track"><div class="bar-fill" data-bar-width="' + (b.users / maxB * 100).toFixed(1) + '%"></div></div><span class="bar-value">' + b.users.toLocaleString('ar-EG') + '</span></div>';
            });
        }
        if (!html) html = '<p class="empty">لا توجد بيانات بعد</p>';
        EL.gaDevices.innerHTML = html;
    }

    function renderGAGeography(data) {
        if (!data || data.error || !data.configured) { EL.gaGeography.innerHTML = '<p class="empty">' + (data && data.error ? 'فشل تحميل الدول: ' + esc(data.error) : 'GA4 غير مهيأ') + '</p>'; return; }
        var geo = data.geography || [];
        if (geo.length === 0) { EL.gaGeography.innerHTML = '<p class="empty">لا توجد بيانات بعد</p>'; return; }
        var max = Math.max.apply(null, geo.map(function (g) { return g.users; }), 1);
        EL.gaGeography.innerHTML = geo.slice(0, 15).map(function (g) {
            return '<div class="bar-row"><span class="bar-label">' + esc(g.country) + '</span><div class="bar-track"><div class="bar-fill" data-bar-width="' + (g.users / max * 100).toFixed(1) + '%"></div></div><span class="bar-value">' + g.users.toLocaleString('ar-EG') + '</span></div>';
        }).join('');
    }

    function renderCustomFunnels(data) {
        var funnels = data.funnels;
        if (!funnels) { EL.customFunnels.innerHTML = '<p class="empty">لا توجد بيانات بعد</p>'; return; }
        var l2i = funnels.landing_to_interaction || {};
        var l2s = funnels.landing_to_submission || {};
        var iRate = l2i.total > 0 ? Math.round(l2i.converted / l2i.total * 100) : 0;
        var sRate = l2s.total > 0 ? Math.round(l2s.converted / l2s.total * 100) : 0;
        EL.customFunnels.innerHTML = [
            { name: 'زيارة الصفحة الرئيسية', count: l2i.total || 0, rate: '100%' },
            { name: 'تفاعل مع الصفحة', count: l2i.converted || 0, rate: iRate + '%' },
            { name: 'إرسال مشاركة', count: l2s.converted || 0, rate: sRate + '%' },
        ].map(function (s) {
            return '<div class="funnel-step"><span class="funnel-step-name">' + s.name + '</span><span class="funnel-step-count">' + s.count.toLocaleString('ar-EG') + '</span><span class="funnel-step-rate">' + s.rate + '</span></div>';
        }).join('');
    }

    function renderCustomRetention(data) {
        var r = data.retention || {};
        EL.customRetention.innerHTML =
            '<div class="stats-grid">' +
            '<div class="stat-card"><div class="stat-value">' + (r.returning_rate || 0) + '%</div><div class="stat-label">نسبة الزوار العائدين</div></div>' +
            '<div class="stat-card"><div class="stat-value">' + (r.repeat_sessions || 0).toLocaleString('ar-EG') + '</div><div class="stat-label">جلسات عائدين</div></div>' +
            '<div class="stat-card"><div class="stat-value">' + (r.total_sessions || 0).toLocaleString('ar-EG') + '</div><div class="stat-label">إجمالي الجلسات</div></div>' +
            '</div>';
    }

    function renderCustomFeatureUsage(data) {
        var usage = data.feature_usage || {};
        var entries = Object.entries(usage).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10);
        if (entries.length === 0) { EL.customFeatureUsage.innerHTML = '<p class="empty">لا توجد بيانات بعد</p>'; return; }
        var max = Math.max.apply(null, entries.map(function (e) { return e[1]; }), 1);
        EL.customFeatureUsage.innerHTML = entries.map(function (e, i) {
            return '<div class="bar-row"><span class="bar-label">' + esc(e[0]) + '</span><div class="bar-track"><div class="bar-fill" data-bar-width="' + (e[1] / max * 100).toFixed(1) + '%"></div></div><span class="bar-value">' + e[1].toLocaleString('ar-EG') + '</span></div>';
        }).join('');
    }

    function renderInsights(data) {
        var insights = [];
        var configured = data.configured || false;

        var custom = data.custom || {};
        var ga = data.ga;
        var overview = custom.overview || {};

        if (ga && ga.configured) {
            var o = ga.overview || {};
            if (o.bounce_rate > 70) insights.push({ icon: '⚠️', text: 'معدل الارتداد مرتفع (' + o.bounce_rate + '%) — قد يحتاج المحتوى إلى تحسين', type: 'warning' });
            if (o.bounce_rate < 40) insights.push({ icon: '✅', text: 'معدل ارتداد منخفض (' + o.bounce_rate + '%) — المحتوى جذاب', type: 'success' });
            if (o.avg_session_duration_sec < 30) insights.push({ icon: '⏱️', text: 'مدة الجلسة قصيرة (أقل من 30 ثانية)', type: 'warning' });
            if (o.avg_session_duration_sec > 120) insights.push({ icon: '⏱️', text: 'مدة الجلسة ممتازة — المستخدمون يتفاعلون', type: 'success' });
            if (o.active_users < 10) insights.push({ icon: '📈', text: 'حجم الزيارات لا يزال منخفضاً — ركز على تحسين الظهور في البحث', type: 'info' });
        } else {
            insights.push({ icon: '⚙️', text: 'Google Analytics 4 غير مهيأ — تعيين GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN في متغيرات Netlify البيئية', type: 'info' });
        }

        if (overview.unique_visitors > 0 && overview.returning_visitors > 0) {
            var returnPct = Math.round(overview.returning_visitors / overview.unique_visitors * 100);
            if (returnPct > 30) insights.push({ icon: '🔄', text: 'نسبة الزوار العائدين ' + returnPct + '% — المستخدمون يعودون للموقع', type: 'success' });
        }

        if (overview.total_events > 0 && overview.page_views > 0) {
            var eventsPerView = (overview.total_events / overview.page_views).toFixed(1);
            if (eventsPerView > 3) insights.push({ icon: '🎯', text: 'معدل التفاعل ' + eventsPerView + ' حدث/مشاهدة — المستخدمون يتفاعلون بشكل جيد', type: 'success' });
        }

        if (insights.length === 0) {
            insights.push({ icon: '📊', text: 'اجمع المزيد من البيانات للحصول على تحليلات دقيقة', type: 'info' });
        }

        EL.insights.innerHTML = insights.map(function (ins) {
            return '<div class="insight-card insight-' + ins.type + '"><span class="insight-icon">' + ins.icon + '</span><span class="insight-text">' + ins.text + '</span></div>';
        }).join('');
    }

    function esc(str) {
        if (typeof str !== 'string') return String(str || '');
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

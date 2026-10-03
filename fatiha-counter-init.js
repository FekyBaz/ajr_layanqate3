(function () {
    'use strict';

    (async function () {
        try {
            const res = await fetch('/.netlify/functions/fatiha-counter');
            if (res.ok) {
                const data = await res.json();
                // Unified envelope exposes top-level `count` (legacy `data.total_fatihas` fallback)
                const count = Number(data?.count ?? data?.data?.total_fatihas ?? 0);
                const countEl = document.getElementById('homepageGlobalFatihaCounter');
                if (countEl && count > 0) {
                    countEl.textContent = `قُرِئَت الفاتحة ${count.toLocaleString('ar-EG')} مرة للشهداء`;
                } else if (countEl) {
                    countEl.hidden = true;
                }
            }
        } catch (e) {
            const countEl = document.getElementById('homepageGlobalFatihaCounter');
            if (countEl) countEl.hidden = true;
        }
    })();
})();

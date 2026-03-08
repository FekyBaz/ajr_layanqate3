(function () {
    'use strict';

    const PRODUCTION_API_URL = '';
    const isProduction = !window.location.hostname.includes('localhost') &&
        !window.location.hostname.includes('127.0.0.1');
    const API_BASE = isProduction ? PRODUCTION_API_URL : 'http://localhost:8888';

    const stateEl = document.getElementById('memoriesState');
    const listEl = document.getElementById('memoriesList');
    const paginationEl = document.getElementById('memoriesPagination');
    const prevBtn = document.getElementById('memoriesPrev');
    const nextBtn = document.getElementById('memoriesNext');
    const pageInfoEl = document.getElementById('memoriesPageInfo');

    if (!stateEl || !listEl || !paginationEl || !prevBtn || !nextBtn || !pageInfoEl) return;

    const pageSize = 12;
    let currentPage = 1;

    function createCard(memory) {
        const card = document.createElement('article');
        card.className = 'recent-memories__card';

        const name = document.createElement('h2');
        name.className = 'recent-memories__name';
        name.textContent = memory.deceased_name;

        const sub = document.createElement('p');
        sub.className = 'recent-memories__subtitle';
        sub.textContent = `صدقة جارية على روح ${memory.deceased_name}`;

        const link = document.createElement('a');
        link.className = 'btn btn-secondary recent-memories__btn';
        link.href = `/memory/${encodeURIComponent(memory.slug)}`;
        link.textContent = 'عرض الصفحة';

        card.appendChild(name);
        card.appendChild(sub);
        card.appendChild(link);

        return card;
    }

    async function loadMemories(page = 1) {
        stateEl.hidden = false;
        stateEl.textContent = 'جارٍ تحميل الصفحات...';
        listEl.hidden = true;

        try {
            const response = await fetch(`${API_BASE}/api/memories/all?page=${page}&pageSize=${pageSize}`);
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'تعذر تحميل الصفحات');
            }

            const memories = result.data || [];
            const pagination = result.pagination || { page: 1, totalPages: 1 };

            listEl.innerHTML = '';

            if (memories.length === 0) {
                stateEl.textContent = 'لا توجد صفحات منشورة بعد.';
                paginationEl.hidden = true;
                return;
            }

            memories.forEach(memory => {
                listEl.appendChild(createCard(memory));
            });

            currentPage = pagination.page || page;
            pageInfoEl.textContent = `الصفحة ${currentPage} من ${pagination.totalPages || 1}`;
            prevBtn.disabled = currentPage <= 1;
            nextBtn.disabled = currentPage >= (pagination.totalPages || 1);

            stateEl.hidden = true;
            listEl.hidden = false;
            paginationEl.hidden = (pagination.totalPages || 1) <= 1;

        } catch (err) {
            stateEl.hidden = false;
            stateEl.textContent = 'حدث خطأ أثناء تحميل الصفحات. حاول مرة أخرى لاحقًا.';
            paginationEl.hidden = true;
        }
    }

    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            loadMemories(currentPage - 1);
        }
    });

    nextBtn.addEventListener('click', () => {
        loadMemories(currentPage + 1);
    });

    loadMemories();
})();

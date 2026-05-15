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

    const totalBadge = document.getElementById('totalMemoriesBadge');
    const totalCountEl = document.getElementById('totalMemoriesCount');
    const searchInput = document.getElementById('memoriesSearchInput');
    const searchClear = document.getElementById('memoriesSearchClear');

    if (!stateEl || !listEl || !paginationEl || !prevBtn || !nextBtn || !pageInfoEl) return;

    const pageSize = 16;
    let currentPage = 1;
    let currentSearch = '';
    let searchDebounceTimeout = null;

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag] || tag));
    }

    function createCard(memory) {
        const card = document.createElement('article');
        card.className = 'memory-premium-card';

        let dateStr = '';
        if (memory.approved_at) {
            try {
                const date = new Date(memory.approved_at);
                dateStr = date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
            } catch (e) {}
        }

        const cleanName = escapeHtml(memory.deceased_name);
        const cleanSlug = encodeURIComponent(memory.slug);

        card.innerHTML = `
            <div class="memory-premium-card__header">
                <span class="memory-premium-card__badge">
                    <span aria-hidden="true">🕊️</span> صدقة جارية
                </span>
                ${dateStr ? `<span class="memory-premium-card__date">${dateStr}</span>` : ''}
            </div>
            <div class="memory-premium-card__body">
                <h2 class="memory-premium-card__name">${cleanName}</h2>
                <p class="memory-premium-card__dua">اللهم اغفر له وارحمه وأسكنه فسيح جناتك</p>
            </div>
            <div class="memory-premium-card__footer">
                <a href="/memory/${cleanSlug}" class="btn memory-premium-card__btn">
                    <span>اقرأ وادعُ له</span>
                    <span aria-hidden="true">📖</span>
                </a>
            </div>
        `;

        return card;
    }

    async function loadMemories(page = 1) {
        stateEl.hidden = false;
        stateEl.innerHTML = '<span class="spinner" aria-hidden="true"></span> جارٍ تحميل الصفحات...';
        listEl.hidden = true;

        try {
            const queryParams = new URLSearchParams({
                page,
                pageSize,
                search: currentSearch
            });

            const response = await fetch(`${API_BASE}/api/memories/all?${queryParams}`);
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'تعذر تحميل الصفحات');
            }

            const memories = result.data || [];
            const pagination = result.pagination || { page: 1, totalPages: 1, total: 0 };

            if (totalBadge && totalCountEl && pagination.total > 0) {
                totalCountEl.textContent = pagination.total;
                totalBadge.hidden = false;
            }

            listEl.innerHTML = '';

            if (memories.length === 0) {
                if (currentSearch) {
                    stateEl.textContent = `لا توجد نتائج مطابقة لـ "${currentSearch}".`;
                } else {
                    stateEl.textContent = 'لا توجد صفحات منشورة بعد.';
                }
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

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearch = e.target.value.trim();
            if (searchClear) {
                searchClear.hidden = currentSearch.length === 0;
            }

            if (searchDebounceTimeout) clearTimeout(searchDebounceTimeout);
            searchDebounceTimeout = setTimeout(() => {
                currentPage = 1;
                loadMemories(currentPage);
            }, 350);
        });
    }

    if (searchClear && searchInput) {
        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            currentSearch = '';
            searchClear.hidden = true;
            searchInput.focus();
            currentPage = 1;
            loadMemories(currentPage);
        });
    }

    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            loadMemories(currentPage - 1);
            window.scrollTo({ top: document.querySelector('.memories-controls')?.offsetTop - 50, behavior: 'smooth' });
        }
    });

    nextBtn.addEventListener('click', () => {
        loadMemories(currentPage + 1);
        window.scrollTo({ top: document.querySelector('.memories-controls')?.offsetTop - 50, behavior: 'smooth' });
    });

    loadMemories();
})();

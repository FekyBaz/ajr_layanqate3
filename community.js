const API_ENDPOINT = '/.netlify/functions/community-submissions';

const badgeLabels = {
    dhikr: 'ذكر',
    dua: 'دعاء',
    ayah: 'آية',
    hadith: 'حديث',
};

const state = {
    type: 'all',
    sort: 'latest',
    page: 1,
};

const elements = {
    stateMessage: document.getElementById('stateMessage'),
    submissionsContainer: document.getElementById('submissionsContainer'),
    approvedCount: document.getElementById('approvedCount'),
    pagination: document.getElementById('pagination'),
    pageInfo: document.getElementById('pageInfo'),
    prevPage: document.getElementById('prevPage'),
    nextPage: document.getElementById('nextPage'),
    filterTabs: document.getElementById('filterTabs'),
    sortSelect: document.getElementById('sortSelect'),
    featuredSection: document.getElementById('featuredSection'),
    featuredCard: document.getElementById('featuredCard'),
};

function formatDate(dateValue) {
    return new Intl.DateTimeFormat('ar-EG', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    }).format(new Date(dateValue));
}

function resolveMessage(item) {
    return item.corrected_message || item.message;
}

function createCard(item) {
    const badge = badgeLabels[item.content_type] || item.content_type;
    const sharesMarkup = item.post_count > 0
        ? `<p class="shares">🕊 تمت المشاركة ${item.post_count} مرة</p>`
        : '';

    return `
        <article class="submission-card card-enter">
            <span class="content-badge badge-${item.content_type}">${badge}</span>
            <p class="submission-message">"${resolveMessage(item)}"</p>
            <p class="submission-author">— ${item.author_name || 'عبدٌ يرجو الأجر'}</p>
            <div class="submission-meta">
                <time datetime="${item.created_at}">${formatDate(item.created_at)}</time>
                ${sharesMarkup}
            </div>
        </article>
    `;
}

async function fetchSubmissions() {
    elements.stateMessage.textContent = 'جارٍ تحميل المشاركات...';
    elements.stateMessage.hidden = false;
    elements.submissionsContainer.innerHTML = '';

    const query = new URLSearchParams({
        page: String(state.page),
        type: state.type,
        sort: state.sort,
    });

    try {
        const response = await fetch(`${API_ENDPOINT}?${query.toString()}`);
        if (!response.ok) {
            throw new Error('Request failed');
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message || 'Unexpected API response');
        }

        renderResponse(result);
    } catch (err) {
        elements.stateMessage.textContent = 'تعذر تحميل المشاركات حاليًا. حاول مرة أخرى لاحقًا.';
        elements.pagination.hidden = true;
    }
}

function renderFeatured(featured) {
    if (!featured) {
        elements.featuredSection.hidden = true;
        return;
    }

    elements.featuredSection.hidden = false;
    elements.featuredCard.innerHTML = createCard(featured);
}

function renderResponse(result) {
    const { submissions, pagination, featured } = result;

    elements.approvedCount.textContent = `إجمالي المشاركات المعتمدة: ${pagination.total}`;
    renderFeatured(featured);

    if (!submissions.length) {
        elements.stateMessage.textContent = 'لا توجد مشاركات معتمدة ضمن هذا التصنيف حتى الآن.';
        elements.pagination.hidden = true;
        return;
    }

    elements.stateMessage.hidden = true;
    elements.submissionsContainer.innerHTML = submissions.map(createCard).join('');

    elements.pagination.hidden = false;
    elements.pageInfo.textContent = `صفحة ${pagination.page} من ${pagination.totalPages}`;
    elements.prevPage.disabled = pagination.page <= 1;
    elements.nextPage.disabled = pagination.page >= pagination.totalPages;
}

function setActiveTab(type) {
    document.querySelectorAll('.tab').forEach((button) => {
        button.classList.toggle('is-active', button.dataset.type === type);
    });
}

elements.filterTabs.addEventListener('click', (event) => {
    const button = event.target.closest('.tab');
    if (!button) return;

    state.type = button.dataset.type;
    state.page = 1;
    setActiveTab(state.type);
    fetchSubmissions();
});

elements.sortSelect.addEventListener('change', (event) => {
    state.sort = event.target.value;
    state.page = 1;
    fetchSubmissions();
});

elements.prevPage.addEventListener('click', () => {
    if (state.page > 1) {
        state.page -= 1;
        fetchSubmissions();
    }
});

elements.nextPage.addEventListener('click', () => {
    state.page += 1;
    fetchSubmissions();
});

fetchSubmissions();

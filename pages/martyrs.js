import { fetchMartyrs } from '../lib/fetchMartyrs.js';
import { normalizeData } from '../lib/normalizeData.js';
import { calculateStats } from '../lib/calculateStats.js';
import { renderStatsSection } from '../components/StatsSection.js';
import { renderChartsSection } from '../components/ChartsSection.js';
import { renderMartyrsList } from '../components/MartyrsList.js';
import { renderLoadMoreButton } from '../components/LoadMoreButton.js';

const INITIAL_BATCH = 100;
const BATCH_SIZE = 100;
const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
const FATIHA_TABLE = 'fatiha_counter';
const FATIHA_ROW_ID = 1;
const FATIHA_SYNC_INTERVAL_MS = 15000;

const FILTERS = {
  all: 'الكل',
  children: 'الأطفال',
  female: 'النساء',
  male: 'الرجال',
  elderly: 'كبار السن'
};

let allMartyrs = [];
let visibleCount = INITIAL_BATCH;
let isLoadingMore = false;
let activeFilter = 'all';
let searchTerm = '';

let app = null;
let heroCount = null;
let loading = null;
let error = null;
let statsContainer = null;
let chartsContainer = null;
let controlsContainer = null;
let listContainer = null;
let loadMoreContainer = null;
let fatihaButton = null;
let fatihaCount = null;
let currentFatihaCount = 0;
let fatihaSyncTimer = null;
let isUpdatingFatiha = false;

function showError(message) {
  error.textContent = message;
  error.hidden = false;
}

function hideError() {
  error.hidden = true;
}

function toggleLoading(isLoading) {
  loading.hidden = !isLoading;
}

function isSearchActive() {
  return searchTerm.trim().length > 0;
}

function applyFilter(martyr) {
  if (activeFilter === 'children') return typeof martyr.age === 'number' && martyr.age <= 18;
  if (activeFilter === 'male') return martyr.gender === 'm';
  if (activeFilter === 'female') return martyr.gender === 'f';
  if (activeFilter === 'elderly') return typeof martyr.age === 'number' && martyr.age > 60;
  return true;
}

function applySearch(martyr) {
  if (!isSearchActive()) return true;
  return martyr.arabicName.toLocaleLowerCase('ar').includes(searchTerm.toLocaleLowerCase('ar').trim());
}

function getFilteredMartyrs() {
  return allMartyrs.filter((martyr) => applyFilter(martyr) && applySearch(martyr));
}

function renderControls() {
  controlsContainer.innerHTML = `
    <section class="controls-section" aria-label="البحث والتصفية">
      <label class="sr-only" for="martyrs-search">ابحث عن اسم شهيد</label>
      <input id="martyrs-search" class="search-input" type="search" placeholder="ابحث عن اسم شهيد..." value="${searchTerm}">
      <div class="filter-buttons" role="group" aria-label="تصفية الشهداء">
        ${Object.entries(FILTERS)
          .map(
            ([key, label]) =>
              `<button class="filter-button ${activeFilter === key ? 'active' : ''}" type="button" data-filter="${key}">${label}</button>`
          )
          .join('')}
      </div>
    </section>
  `;

  const searchInput = controlsContainer.querySelector('#martyrs-search');
  searchInput?.addEventListener('input', (event) => {
    searchTerm = event.target.value || '';
    renderPage();
  });

  controlsContainer.querySelectorAll('.filter-button').forEach((button) => {
    button.addEventListener('click', () => {
      activeFilter = button.dataset.filter || 'all';
      visibleCount = INITIAL_BATCH;
      renderPage();
    });
  });
}

function getSupabaseHeaders() {
  const anonKey = getSupabaseAnonKey();
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'Content-Type': 'application/json'
  };
}

function getSupabaseAnonKey() {
  return (
    window.__SUPABASE_ANON_KEY__ ||
    document.querySelector('meta[name="supabase-anon-key"]')?.content ||
    ''
  );
}

function renderFatihaCount(count = currentFatihaCount) {
  currentFatihaCount = Number.isFinite(count) && count >= 0 ? count : 0;
  fatihaCount.textContent = `تمت قراءة الفاتحة ${currentFatihaCount.toLocaleString('ar-EG')} مرة`;
}

function isSupabaseReady() {
  return Boolean(SUPABASE_URL && getSupabaseAnonKey());
}

async function fetchGlobalFatihaCount() {
  if (!isSupabaseReady()) {
    throw new Error('لم يتم ضبط إعدادات Supabase للعداد العام.');
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${FATIHA_TABLE}?select=count&id=eq.${FATIHA_ROW_ID}&limit=1`,
    {
      headers: getSupabaseHeaders(),
      cache: 'no-store'
    }
  );

  if (!response.ok) {
    throw new Error('تعذر تحميل عداد الفاتحة العام.');
  }

  const [row] = await response.json();
  return Number(row?.count) || 0;
}

async function incrementGlobalFatihaCount() {
  if (!isSupabaseReady()) {
    throw new Error('لم يتم ضبط إعدادات Supabase للعداد العام.');
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${FATIHA_TABLE}?id=eq.${FATIHA_ROW_ID}`,
    {
      method: 'PATCH',
      headers: {
        ...getSupabaseHeaders(),
        Prefer: 'return=representation'
      },
      body: JSON.stringify({ count: currentFatihaCount + 1 })
    }
  );

  if (!response.ok) {
    throw new Error('تعذر تحديث عداد الفاتحة العام.');
  }

  const [row] = await response.json();
  return Number(row?.count) || currentFatihaCount;
}

async function syncGlobalFatihaCount({ silent = true } = {}) {
  try {
    const count = await fetchGlobalFatihaCount();
    renderFatihaCount(count);
  } catch (syncError) {
    if (!silent) showError(syncError.message || 'تعذر مزامنة عداد الفاتحة.');
  }
}

function initializeFatihaCounter() {
  renderFatihaCount(0);
  if (!isSupabaseReady()) {
    fatihaButton.disabled = true;
    fatihaCount.textContent = 'عداد الفاتحة العام غير متاح حاليًا.';
    return;
  }

  syncGlobalFatihaCount({ silent: false });

  if (fatihaSyncTimer) clearInterval(fatihaSyncTimer);
  fatihaSyncTimer = setInterval(() => {
    if (!document.hidden) syncGlobalFatihaCount();
  }, FATIHA_SYNC_INTERVAL_MS);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncGlobalFatihaCount();
  });

  fatihaButton?.addEventListener('click', async () => {
    if (isUpdatingFatiha) return;
    isUpdatingFatiha = true;
    fatihaButton.disabled = true;

    const previousCount = currentFatihaCount;
    renderFatihaCount(previousCount + 1);

    try {
      const updatedCount = await incrementGlobalFatihaCount();
      renderFatihaCount(updatedCount);
    } catch (updateError) {
      renderFatihaCount(previousCount);
      showError(updateError.message || 'تعذر تحديث عداد الفاتحة العام.');
    } finally {
      isUpdatingFatiha = false;
      fatihaButton.disabled = false;
    }
  });
}

function renderPage() {
  const filteredMartyrs = getFilteredMartyrs();
  const shouldIgnorePagination = isSearchActive();
  const visibleMartyrs = shouldIgnorePagination ? filteredMartyrs : filteredMartyrs.slice(0, visibleCount);

  heroCount.textContent = `${allMartyrs.length.toLocaleString('ar-EG')} شهيدًا`;

  renderControls();
  renderMartyrsList(listContainer, visibleMartyrs);

  listContainer.classList.remove('fade-in');
  requestAnimationFrame(() => listContainer.classList.add('fade-in'));

  renderLoadMoreButton(loadMoreContainer, {
    isVisible: !shouldIgnorePagination && visibleCount < filteredMartyrs.length,
    isLoading: isLoadingMore,
    onClick: loadMore
  });
}

function loadMore() {
  if (isLoadingMore) return;

  isLoadingMore = true;
  renderPage();

  requestAnimationFrame(() => {
    const filteredTotal = getFilteredMartyrs().length;
    visibleCount = Math.min(visibleCount + BATCH_SIZE, filteredTotal);
    isLoadingMore = false;
    renderPage();
  });
}

async function initMartyrsPage() {
  app = document.getElementById('martyrs-app');
  heroCount = document.getElementById('hero-count');
  loading = document.getElementById('loading-state');
  error = document.getElementById('error-state');
  statsContainer = document.getElementById('stats-container');
  chartsContainer = document.getElementById('charts-container');
  controlsContainer = document.getElementById('controls-container');
  listContainer = document.getElementById('list-container');
  loadMoreContainer = document.getElementById('load-more-container');
  fatihaButton = document.getElementById('fatiha-button');
  fatihaCount = document.getElementById('fatiha-count');

  toggleLoading(true);
  hideError();

  try {
    const rawDataset = await fetchMartyrs();
    allMartyrs = normalizeData(rawDataset);

    const stats = calculateStats(allMartyrs);
    renderStatsSection(statsContainer, stats);
    if (stats) renderChartsSection(chartsContainer, stats);

    renderPage();
    initializeFatihaCounter();

    if (app) app.hidden = false;
  } catch (err) {
    showError(err.message || 'حدث خطأ غير متوقع أثناء تحميل البيانات.');
  } finally {
    toggleLoading(false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initMartyrsPage();
});

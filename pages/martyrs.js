import { fetchMartyrs } from '../lib/fetchMartyrs.js';
import { normalizeData } from '../lib/normalizeData.js';
import { calculateStats } from '../lib/calculateStats.js';
import { renderStatsSection } from '../components/StatsSection.js';
import { renderChartsSection } from '../components/ChartsSection.js';
import { renderMartyrsList } from '../components/MartyrsList.js';
import { renderLoadMoreButton } from '../components/LoadMoreButton.js';

const INITIAL_BATCH = 100;
const BATCH_SIZE = 100;
const FATIHA_KEY = 'fatiha_count';

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

function getFatihaCount() {
  const rawValue = localStorage.getItem(FATIHA_KEY);
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function renderFatihaCount() {
  fatihaCount.textContent = `تمت قراءة الفاتحة ${getFatihaCount().toLocaleString('ar-EG')} مرة`;
}

function initializeFatihaCounter() {
  renderFatihaCount();
  fatihaButton?.addEventListener('click', () => {
    const nextCount = getFatihaCount() + 1;
    localStorage.setItem(FATIHA_KEY, String(nextCount));
    renderFatihaCount();
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

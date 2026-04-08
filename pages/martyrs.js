import { fetchMartyrs } from '../lib/fetchMartyrs.js';
import { normalizeData } from '../lib/normalizeData.js';
import { calculateStats } from '../lib/calculateStats.js';
import { renderStatsSection } from '../components/StatsSection.js';
import { renderMartyrsList } from '../components/MartyrsList.js';
import { renderLoadMoreButton } from '../components/LoadMoreButton.js';

const INITIAL_BATCH = 100;
const BATCH_SIZE = 100;

const app = document.getElementById('martyrs-app');
const heroCount = document.getElementById('hero-count');
const loading = document.getElementById('loading-state');
const error = document.getElementById('error-state');
const statsContainer = document.getElementById('stats-container');
const listContainer = document.getElementById('list-container');
const loadMoreContainer = document.getElementById('load-more-container');

let allMartyrs = [];
let visibleCount = INITIAL_BATCH;
let isLoadingMore = false;

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

function renderPage() {
  const visibleMartyrs = allMartyrs.slice(0, visibleCount);

  heroCount.textContent = `${allMartyrs.length.toLocaleString('ar-EG')} شهيدًا`;

  renderMartyrsList(listContainer, visibleMartyrs);

  listContainer.classList.remove('fade-in');
  requestAnimationFrame(() => listContainer.classList.add('fade-in'));

  renderLoadMoreButton(loadMoreContainer, {
    isVisible: visibleCount < allMartyrs.length,
    isLoading: isLoadingMore,
    onClick: loadMore
  });
}

function loadMore() {
  if (isLoadingMore) return;

  isLoadingMore = true;
  renderPage();

  requestAnimationFrame(() => {
    visibleCount = Math.min(visibleCount + BATCH_SIZE, allMartyrs.length);
    isLoadingMore = false;
    renderPage();
  });
}

async function initMartyrsPage() {
  toggleLoading(true);
  hideError();

  try {
    const rawDataset = await fetchMartyrs();
    allMartyrs = normalizeData(rawDataset);

    const stats = calculateStats(allMartyrs);
    renderStatsSection(statsContainer, stats);

    renderPage();

    app.hidden = false;
  } catch (err) {
    showError(err.message || 'حدث خطأ غير متوقع أثناء تحميل البيانات.');
  } finally {
    toggleLoading(false);
  }
}

initMartyrsPage();

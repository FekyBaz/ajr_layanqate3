import { fetchMartyrs } from '../lib/fetchMartyrs.js';
import { normalizeData } from '../lib/normalizeData.js';
import { calculateStats } from '../lib/calculateStats.js';
import { renderStatsSection } from '../components/StatsSection.js';
import { renderChartsSection } from '../components/ChartsSection.js';
import { renderMartyrsList } from '../components/MartyrsList.js';
import { renderLoadMoreButton } from '../components/LoadMoreButton.js';

const INITIAL_BATCH = 100;
const BATCH_SIZE = 100;
const FATIHA_COUNTER_ENDPOINT = '/.netlify/functions/fatiha-counter';
const FATIHA_SYNC_INTERVAL_MS = 15000;
const FATIHA_COOLDOWN_SECONDS = 10;

const FILTERS = {
  all: 'الكل',
  children: 'الأطفال',
  female: 'النساء',
  male: 'الرجال',
  elderly: 'كبار السن'
};

const DUAS = [
  'اللهم تقبله في الشهداء',
  'اللهم اغفر له وارحمه',
  'اللهم اجعل مثواه الجنة',
  'اللهم اربط على قلوب أهله'
];

let allMartyrs = [];
let visibleCount = INITIAL_BATCH;
let isLoadingMore = false;
let activeFilter = 'all';
let searchTerm = '';
let filteredCache = [];
let searchDebounceTimer = null;
let selectedMartyrId = null;
let shouldScrollToSelected = false;

let app = null;
let heroCount = null;
let loading = null;
let error = null;
let statsContainer = null;
let chartsContainer = null;
let controlsContainer = null;
let listContainer = null;
let loadMoreContainer = null;
let featuredContainer = null;
let fatihaButton = null;
let fatihaCount = null;
let fatihaCooldownMessage = null;
let duaToast = null;
let schemaScript = null;
let currentFatihaCount = 0;
let fatihaSyncTimer = null;
let fatihaCooldownTimer = null;
let isUpdatingFatiha = false;
let shareToast = null;

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

function normalizeArabic(text = '') {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0617-\u061A\u06D6-\u06ED]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\u0600-\u06FF\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isOneEditAway(source, target) {
  const lenDiff = Math.abs(source.length - target.length);
  if (lenDiff > 1) return false;

  let i = 0;
  let j = 0;
  let edits = 0;

  while (i < source.length && j < target.length) {
    if (source[i] === target[j]) {
      i += 1;
      j += 1;
      continue;
    }

    edits += 1;
    if (edits > 1) return false;

    if (source.length > target.length) {
      i += 1;
    } else if (target.length > source.length) {
      j += 1;
    } else {
      i += 1;
      j += 1;
    }
  }

  if (i < source.length || j < target.length) edits += 1;
  return edits <= 1;
}

function fuzzyMatch(normalizedName, normalizedQuery) {
  if (!normalizedQuery) return true;
  if (normalizedName.includes(normalizedQuery)) return true;

  const nameParts = normalizedName.split(' ');
  const queryParts = normalizedQuery.split(' ');

  return queryParts.every((part) => {
    if (!part) return true;

    return nameParts.some((namePart) => {
      if (!namePart) return false;
      if (namePart.startsWith(part)) return true;
      if (part.length >= 3 && namePart.includes(part)) return true;
      if (part.length <= 8) return isOneEditAway(namePart.slice(0, part.length + 1), part);
      return false;
    });
  });
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
  const query = normalizeArabic(searchTerm);
  return fuzzyMatch(martyr.searchKey, query);
}

function getFilteredMartyrs() {
  filteredCache = allMartyrs.filter((martyr) => applyFilter(martyr) && applySearch(martyr));
  return filteredCache;
}

function closeDuaToast() {
  if (duaToast) {
    duaToast.remove();
    duaToast = null;
  }
}

function closeShareToast() {
  if (shareToast) {
    shareToast.remove();
    shareToast = null;
  }
}

function showShareToast(message) {
  closeShareToast();
  shareToast = document.createElement('div');
  shareToast.className = 'share-toast';
  shareToast.innerHTML = `<p>${message}</p><button type="button" aria-label="إغلاق">✕</button>`;
  document.body.appendChild(shareToast);
  shareToast.querySelector('button')?.addEventListener('click', closeShareToast);
  setTimeout(closeShareToast, 3200);
}

async function shareMartyr(_, shareUrl) {
  const title = 'شهيد من غزة';
  const text = 'اللهم تقبل هذا الشهيد في جناتك';
  const url = shareUrl;

  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ title, text, url });
      return;
    }

    await navigator.clipboard.writeText(url);
    showShareToast('تم نسخ الرابط للمشاركة');
  } catch (shareError) {
    if (shareError?.name === 'AbortError') return;

    try {
      await navigator.clipboard.writeText(url);
      showShareToast('تم نسخ الرابط للمشاركة');
    } catch (_) {
      showError('تعذر فتح نافذة المشاركة أو نسخ الرابط.');
    }
  }
}

function showDuaToast() {
  closeDuaToast();
  const randomDua = DUAS[Math.floor(Math.random() * DUAS.length)];
  duaToast = document.createElement('div');
  duaToast.className = 'dua-toast';
  duaToast.innerHTML = `<p>${randomDua}</p><button type="button" aria-label="إغلاق">✕</button>`;
  document.body.appendChild(duaToast);
  duaToast.querySelector('button')?.addEventListener('click', closeDuaToast);
  setTimeout(closeDuaToast, 4200);
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
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      searchTerm = event.target.value || '';
      renderPage();
    }, 120);
  });

  controlsContainer.querySelectorAll('.filter-button').forEach((button) => {
    button.addEventListener('click', () => {
      activeFilter = button.dataset.filter || 'all';
      visibleCount = INITIAL_BATCH;
      renderPage();
    });
  });
}

function animateCount(targetCount) {
  const startValue = currentFatihaCount;
  const start = performance.now();
  const duration = 500;

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const nextValue = Math.round(startValue + (targetCount - startValue) * progress);
    fatihaCount.textContent = `تمت قراءة الفاتحة ${nextValue.toLocaleString('ar-EG')} مرة`;

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      currentFatihaCount = targetCount;
    }
  }

  requestAnimationFrame(tick);
}

function renderFatihaCount(count = currentFatihaCount) {
  const safeCount = Number.isFinite(count) && count >= 0 ? count : 0;
  animateCount(safeCount);
  fatihaCount.classList.remove('pulse');
  requestAnimationFrame(() => fatihaCount.classList.add('pulse'));
}

async function fetchGlobalFatihaCount() {
  const response = await fetch(FATIHA_COUNTER_ENDPOINT, { cache: 'no-store' });
  if (!response.ok) throw new Error('تعذر تحميل عداد الفاتحة العام.');
  const payload = await response.json();
  return Number(payload?.count) || 0;
}

async function incrementGlobalFatihaCount() {
  const response = await fetch(FATIHA_COUNTER_ENDPOINT, { method: 'POST' });
  if (!response.ok) throw new Error('تعذر تحديث عداد الفاتحة العام.');
  const payload = await response.json();
  return Number(payload?.count) || currentFatihaCount;
}

function setFatihaCooldown(secondsLeft) {
  const endsAt = Date.now() + secondsLeft * 1000;
  sessionStorage.setItem('fatihaCooldownEndsAt', String(endsAt));

  if (fatihaCooldownTimer) clearInterval(fatihaCooldownTimer);

  const tick = () => {
    const remaining = Math.ceil((endsAt - Date.now()) / 1000);
    if (remaining <= 0) {
      sessionStorage.removeItem('fatihaCooldownEndsAt');
      fatihaButton.disabled = false;
      fatihaCooldownMessage.textContent = '';
      clearInterval(fatihaCooldownTimer);
      return;
    }

    fatihaButton.disabled = true;
    fatihaCooldownMessage.textContent = `يمكنك القراءة مرة أخرى خلال ${remaining.toLocaleString('ar-EG')} ثواني`;
  };

  tick();
  fatihaCooldownTimer = setInterval(tick, 1000);
}

function restoreCooldownFromSession() {
  const storedEndsAt = Number(sessionStorage.getItem('fatihaCooldownEndsAt'));
  if (!storedEndsAt || Number.isNaN(storedEndsAt)) return;
  const secondsLeft = Math.ceil((storedEndsAt - Date.now()) / 1000);
  if (secondsLeft > 0) setFatihaCooldown(secondsLeft);
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
  syncGlobalFatihaCount({ silent: false });
  restoreCooldownFromSession();

  if (fatihaSyncTimer) clearInterval(fatihaSyncTimer);
  fatihaSyncTimer = setInterval(() => {
    if (!document.hidden) syncGlobalFatihaCount();
  }, FATIHA_SYNC_INTERVAL_MS);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncGlobalFatihaCount();
  });

  fatihaButton?.addEventListener('click', async () => {
    if (isUpdatingFatiha || fatihaButton.disabled) return;
    isUpdatingFatiha = true;

    const previousCount = currentFatihaCount;
    renderFatihaCount(previousCount + 1);
    setFatihaCooldown(FATIHA_COOLDOWN_SECONDS);

    try {
      const updatedCount = await incrementGlobalFatihaCount();
      renderFatihaCount(updatedCount);
    } catch (updateError) {
      renderFatihaCount(previousCount);
      showError(updateError.message || 'تعذر تحديث عداد الفاتحة العام.');
    } finally {
      isUpdatingFatiha = false;
    }
  });
}

function getMartyrOfDay(martyrs) {
  if (!martyrs.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  let hash = 0;
  for (let i = 0; i < today.length; i += 1) hash = (hash * 31 + today.charCodeAt(i)) >>> 0;
  return martyrs[hash % martyrs.length];
}

function renderMartyrOfDay() {
  const martyr = getMartyrOfDay(allMartyrs);
  if (!martyr || !featuredContainer) return;
  featuredContainer.innerHTML = `
    <section class="featured-martyr" aria-label="شهيد اليوم">
      <h2>🕊 شهيد اليوم</h2>
      <h3>${martyr.arabicName}</h3>
      <p>${typeof martyr.age === 'number' ? `${martyr.age} سنة` : 'العمر غير متوفر'} • ${martyr.gender === 'f' ? 'أنثى' : 'ذكر'}</p>
      <p>اللهم اجعل مثواه الجنة واربط على قلوب أهله.</p>
      <button class="fatiha-button featured-fatiha-button" type="button">اقرأ له الفاتحة</button>
    </section>
  `;

  featuredContainer.querySelector('button')?.addEventListener('click', () => {
    fatihaButton?.click();
  });
}

function updateSeoMetadata(martyrs) {
  const title = `شهداء غزة | ${martyrs.length.toLocaleString('ar-EG')} اسم`;
  const description = 'صفحة توثيقية لشهداء غزة تتضمن البحث الذكي، الإحصائيات، ومشاركة رابط كل شهيد.';

  document.title = title;

  const ensureMeta = (name, value, attr = 'name') => {
    let tag = document.querySelector(`meta[${attr}="${name}"]`);
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute(attr, name);
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', value);
  };

  ensureMeta('description', description);
  ensureMeta('og:title', title, 'property');
  ensureMeta('og:description', description, 'property');
  ensureMeta('og:type', 'website', 'property');
  ensureMeta('og:url', window.location.href, 'property');

  const items = martyrs.slice(0, 200).map((martyr, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    item: {
      '@type': 'Person',
      name: martyr.arabicName,
      description: `${typeof martyr.age === 'number' ? `العمر ${martyr.age}` : 'العمر غير متوفر'} - شهيد من غزة`
    }
  }));

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'شهداء غزة',
    itemListElement: items
  };

  if (!schemaScript) {
    schemaScript = document.createElement('script');
    schemaScript.type = 'application/ld+json';
    document.head.appendChild(schemaScript);
  }

  schemaScript.textContent = JSON.stringify(schema);
}

function renderPage() {
  const filteredMartyrs = getFilteredMartyrs();
  const shouldIgnorePagination = isSearchActive();
  const visibleMartyrs = shouldIgnorePagination ? filteredMartyrs : filteredMartyrs.slice(0, visibleCount);

  heroCount.textContent = `${allMartyrs.length.toLocaleString('ar-EG')} شهيدًا`;

  renderControls();
  renderMartyrsList(listContainer, visibleMartyrs, {
    selectedId: selectedMartyrId,
    scrollToId: shouldScrollToSelected ? selectedMartyrId : null,
    onDuaClick: showDuaToast,
    onShareClick: shareMartyr
  });

  shouldScrollToSelected = false;

  renderLoadMoreButton(loadMoreContainer, {
    isVisible: !shouldIgnorePagination && visibleCount < filteredMartyrs.length,
    isLoading: isLoadingMore,
    onClick: loadMore
  });

  updateSeoMetadata(visibleMartyrs);
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

function detectSelectedMartyr() {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) return;
  selectedMartyrId = id;
  shouldScrollToSelected = true;
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
  featuredContainer = document.getElementById('featured-martyr-container');
  fatihaButton = document.getElementById('fatiha-button');
  fatihaCount = document.getElementById('fatiha-count');
  fatihaCooldownMessage = document.getElementById('fatiha-cooldown');

  toggleLoading(true);
  hideError();

  try {
    const rawDataset = await fetchMartyrs();
    allMartyrs = normalizeData(rawDataset).map((martyr) => ({
      ...martyr,
      searchKey: normalizeArabic(martyr.arabicName)
    }));

    detectSelectedMartyr();

    const stats = calculateStats(allMartyrs);
    renderMartyrOfDay();
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

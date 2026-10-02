// Single source: lib/escape.js (classic script loaded before the module),
// with fallback so the list still renders if the shared lib is missing.
const EscapeHtmlLib = globalThis.EscapeLib || {
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  },
};

function escapeHtml(text) {
  return EscapeHtmlLib.escapeHtml(text);
}

function getGenderLabel(gender) {
  if (gender === 'm') return 'ذكر';
  if (gender === 'f') return 'أنثى';
  return 'غير محدد';
}

function getAgeCategory(age) {
  if (typeof age !== 'number') return 'غير محدد';
  if (age <= 18) return 'طفل';
  if (age <= 60) return 'بالغ';
  return 'كبير السن';
}

function getAgeLabel(age) {
  if (typeof age !== 'number') return 'العمر غير متوفر';
  return `${age} سنة`;
}

function getBirthYearLabel(birthYear) {
  if (typeof birthYear !== 'number') return 'تاريخ الميلاد غير متوفر';
  return `مواليد ${birthYear}`;
}

const DEFAULT_ROW_HEIGHT = 186;
const OVERSCAN_ROWS = 3;

const virtualizationState = {
  scrollTop: 0,
  rowHeight: DEFAULT_ROW_HEIGHT,
  resizeObserver: null,
  boundContainer: null
};

function getColumnsCount(container) {
  const width = container?.clientWidth || window.innerWidth;
  if (width >= 1400) return 4;
  if (width >= 1024) return 3;
  if (width >= 640) return 2;
  return 1;
}

function buildShareUrl(martyrId) {
  return `${window.location.origin}/martyrs?id=${encodeURIComponent(String(martyrId))}`;
}

function renderItem(martyr, { selectedId }) {
  const isSelected = String(selectedId || '') === String(martyr.id);
  const safeName = escapeHtml(martyr.arabicName);
  const safeId = escapeHtml(String(martyr.id));

  return `
    <li class="martyr-item ${isSelected ? 'highlighted' : ''}" data-id="${safeId}">
      <h3 class="martyr-name">${safeName}</h3>
      <p class="martyr-meta">${getGenderLabel(martyr.gender)} • ${getAgeCategory(martyr.age)}</p>
      <p class="martyr-age">${getAgeLabel(martyr.age)}</p>
      <p class="martyr-birth-year">${getBirthYearLabel(martyr.birthYear)}</p>
      <div class="martyr-actions">
        <button class="dua-button" type="button" data-dua-id="${safeId}">🤲 ادعُ له</button>
        <button class="share-link" type="button" data-share-id="${safeId}">🔗 مشاركة</button>
      </div>
      ${isSelected ? '<p class="martyr-details-panel">اللهم اجعل مثواه الجنة واربط على قلوب أهله.</p>' : ''}
    </li>
  `;
}

function bindVirtualScroll(container, martyrs, renderVirtualList, options) {
  if (virtualizationState.boundContainer !== container) {
    virtualizationState.boundContainer = container;

    container.addEventListener('scroll', () => {
      virtualizationState.scrollTop = container.scrollTop;
      renderVirtualList();
    });

    if (virtualizationState.resizeObserver) virtualizationState.resizeObserver.disconnect();
    virtualizationState.resizeObserver = new ResizeObserver(() => {
      renderVirtualList();
    });
    virtualizationState.resizeObserver.observe(container);
  }

  if (options.scrollToId) {
    const index = martyrs.findIndex((martyr) => String(martyr.id) === String(options.scrollToId));
    if (index >= 0) {
      const columns = getColumnsCount(container);
      const targetRow = Math.floor(index / columns);
      const top = targetRow * virtualizationState.rowHeight;
      container.scrollTo({ top: Math.max(0, top - virtualizationState.rowHeight), behavior: 'smooth' });
      virtualizationState.scrollTop = container.scrollTop;
    }
  }
}

export function renderMartyrsList(container, martyrs, options = {}) {
  const selectedId = options.selectedId || null;

  if (!martyrs.length) {
    container.innerHTML = `
      <section class="martyrs-list-section" aria-label="قائمة الشهداء">
        <p class="empty-state">لا توجد نتائج مطابقة.</p>
      </section>
    `;
    return;
  }

  function renderVirtualList() {
    const columns = getColumnsCount(container);
    const rowHeight = virtualizationState.rowHeight;
    const totalRows = Math.ceil(martyrs.length / columns);
    const viewportHeight = Math.max(container.clientHeight || 560, 420);
    const visibleRows = Math.ceil(viewportHeight / rowHeight);
    const startRow = Math.max(0, Math.floor(virtualizationState.scrollTop / rowHeight) - OVERSCAN_ROWS);
    const endRow = Math.min(totalRows, startRow + visibleRows + OVERSCAN_ROWS * 2);

    const startIndex = startRow * columns;
    const endIndex = Math.min(martyrs.length, endRow * columns);
    const topPad = startRow * rowHeight;
    const bottomPad = Math.max(0, (totalRows - endRow) * rowHeight);

    const listMarkup = martyrs.slice(startIndex, endIndex).map((martyr) => renderItem(martyr, { selectedId })).join('');

    container.innerHTML = `
      <section class="martyrs-list-section" aria-label="قائمة الشهداء">
        <div class="virtual-spacer" style="height:${topPad}px"></div>
        <ul class="martyrs-list" data-virtualized="true">${listMarkup}</ul>
        <div class="virtual-spacer" style="height:${bottomPad}px"></div>
      </section>
    `;

    const firstItem = container.querySelector('.martyr-item');
    if (firstItem) {
      const measured = firstItem.getBoundingClientRect().height + 12;
      if (Number.isFinite(measured) && measured > 80) {
        virtualizationState.rowHeight = measured;
      }
    }

    container.querySelectorAll('.dua-button').forEach((button) => {
      button.addEventListener('click', () => {
        if (typeof options.onDuaClick === 'function') {
          options.onDuaClick(button.dataset.duaId);
        }
      });
    });

    container.querySelectorAll('[data-share-id]').forEach((button) => {
      button.addEventListener('click', () => {
        if (typeof options.onShareClick === 'function') {
          options.onShareClick(button.dataset.shareId, buildShareUrl(button.dataset.shareId));
        }
      });
    });
  }

  bindVirtualScroll(container, martyrs, renderVirtualList, options);
  renderVirtualList();
}

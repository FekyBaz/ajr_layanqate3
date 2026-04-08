export function renderLoadMoreButton(container, { isVisible, isLoading, onClick }) {
  if (!isVisible) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <button class="load-more-button" type="button" ${isLoading ? 'disabled' : ''}>
      ${isLoading ? 'جاري التحميل...' : 'عرض المزيد'}
    </button>
  `;

  const button = container.querySelector('button');
  button?.addEventListener('click', onClick);
}

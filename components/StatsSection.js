function createStatCard(label, value) {
  return `
    <article class="stat-card">
      <h3>${label}</h3>
      <p>${value.toLocaleString('ar-EG')}</p>
    </article>
  `;
}

export function renderStatsSection(container, stats) {
  const cards = [
    ['إجمالي الشهداء', stats.total],
    ['الذكور', stats.males],
    ['الإناث', stats.females],
    ['الأطفال', stats.children],
    ['البالغون', stats.adults],
    ['كبار السن', stats.elderly]
  ]
    .map(([label, value]) => createStatCard(label, value))
    .join('');

  container.innerHTML = `
    <section class="stats-section" aria-label="إحصائيات الشهداء">
      ${cards}
    </section>
  `;
}

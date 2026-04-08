let genderChart = null;
let ageChart = null;
let decadeChart = null;
let lastSignature = '';

function getStatsSignature(stats) {
  return [stats.males, stats.females, stats.children, stats.adults, stats.elderly, JSON.stringify(stats.byDecade || {})].join('-');
}

function getThemeColor(variableName, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
  return value || fallback;
}

function getDecadeData(byDecade = {}) {
  const sorted = Object.entries(byDecade)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .slice(-7);

  return {
    labels: sorted.map(([decade]) => `${decade}s`),
    values: sorted.map(([, count]) => count)
  };
}

export function renderChartsSection(container, stats) {
  if (!container || !stats || typeof Chart === 'undefined') return;

  const nextSignature = getStatsSignature(stats);
  if (lastSignature === nextSignature && container.childElementCount > 0) return;

  container.innerHTML = `
    <section class="charts-section" aria-label="الرسوم البيانية">
      <article class="chart-card">
        <h3>توزيع الشهداء حسب الجنس</h3>
        <canvas id="gender-chart" aria-label="توزيع الذكور والإناث" role="img"></canvas>
      </article>
      <article class="chart-card">
        <h3>توزيع الشهداء حسب الفئة العمرية</h3>
        <canvas id="age-chart" aria-label="توزيع الأعمار" role="img"></canvas>
        <div class="age-categories-explanation" aria-label="شرح الفئات العمرية">
          <h4>الفئات العمرية:</h4>
          <ul>
            <li><strong>الأطفال:</strong> حتى 18 سنة</li>
            <li><strong>البالغون:</strong> من 19 إلى 60 سنة</li>
            <li><strong>كبار السن:</strong> أكثر من 60 سنة</li>
          </ul>
        </div>
      </article>
      <article class="chart-card chart-card-wide">
        <h3>التوزيع حسب عقد الميلاد</h3>
        <canvas id="decade-chart" aria-label="توزيع الشهداء حسب عقود الميلاد" role="img"></canvas>
      </article>
    </section>
  `;

  const genderCtx = container.querySelector('#gender-chart');
  const ageCtx = container.querySelector('#age-chart');
  const decadeCtx = container.querySelector('#decade-chart');

  if (genderChart) genderChart.destroy();
  if (ageChart) ageChart.destroy();
  if (decadeChart) decadeChart.destroy();

  const accentPrimary = getThemeColor('--color-accent-primary', '#8c6a35');
  const accentHover = getThemeColor('--color-accent-hover', '#74562b');
  const gold = getThemeColor('--color-gold', '#c8a673');

  genderChart = new Chart(genderCtx, {
    type: 'pie',
    data: {
      labels: ['الذكور', 'الإناث'],
      datasets: [{ data: [stats.males, stats.females], backgroundColor: [accentPrimary, gold] }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
  });

  ageChart = new Chart(ageCtx, {
    type: 'bar',
    data: {
      labels: ['الأطفال', 'البالغون', 'كبار السن'],
      datasets: [{ data: [stats.children, stats.adults, stats.elderly], backgroundColor: [gold, accentPrimary, accentHover] }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });

  const decadeData = getDecadeData(stats.byDecade);
  decadeChart = new Chart(decadeCtx, {
    type: 'bar',
    data: {
      labels: decadeData.labels,
      datasets: [{ data: decadeData.values, backgroundColor: accentPrimary, borderRadius: 6 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });

  lastSignature = nextSignature;
}

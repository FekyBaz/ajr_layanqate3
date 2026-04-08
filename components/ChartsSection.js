let genderChart = null;
let ageChart = null;
let lastSignature = '';

function getStatsSignature(stats) {
  return [stats.males, stats.females, stats.children, stats.adults, stats.elderly].join('-');
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
      </article>
    </section>
  `;

  const genderCtx = container.querySelector('#gender-chart');
  const ageCtx = container.querySelector('#age-chart');

  if (genderChart) genderChart.destroy();
  if (ageChart) ageChart.destroy();

  genderChart = new Chart(genderCtx, {
    type: 'pie',
    data: {
      labels: ['الذكور', 'الإناث'],
      datasets: [
        {
          data: [stats.males, stats.females],
          backgroundColor: ['#0f766e', '#14b8a6']
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });

  ageChart = new Chart(ageCtx, {
    type: 'bar',
    data: {
      labels: ['الأطفال', 'البالغون', 'كبار السن'],
      datasets: [
        {
          data: [stats.children, stats.adults, stats.elderly],
          backgroundColor: ['#14b8a6', '#0f766e', '#115e59']
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });

  lastSignature = nextSignature;
}

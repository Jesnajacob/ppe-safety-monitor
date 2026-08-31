/**
 * dashboard.js — Load and render dashboard statistics and charts.
 */

// ── Chart defaults
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = '#1e3453';
Chart.defaults.font.family = 'Inter, sans-serif';
Chart.defaults.font.size = 12;

let ppeChart, violationsChart, trendChart;

async function loadDashboard() {
  try {
    const res = await authFetch('/api/dashboard/stats');
    if (!res?.ok) throw new Error('Failed to load');
    const data = await res.json();

    renderKPIs(data.kpis);
    renderScoreRing(data.kpis.safety_score);
    renderPPEChart(data.ppe_compliance);
    renderViolationsTypeChart(data.violations_by_type);
    renderTrendChart(data.violations_trend);
    renderRecentViolations(data.recent_violations);
  } catch (err) {
    console.error('Dashboard error:', err);
    showToast('Dashboard Error', 'Could not load stats. Is the backend running?', 'error');
    // Show demo data
    renderKPIs({ total_workers: 127, safe_workers: 109, ppe_violations: 14,
                 zone_violations: 4, safety_score: 88.5, total_analyses: 23, total_violations: 18 });
    renderScoreRing(88.5);
    renderPPEChart({ helmet: 94, vest: 91, gloves: 78, shoes: 89 });
    renderViolationsTypeChart({ 'Missing Gloves': 8, 'Missing Safety Vest': 5,
      'Restricted Area': 4, 'Missing Helmet': 3, 'Missing Shoes': 2 });
    renderTrendChart([
      {day:'Mon',count:2},{day:'Tue',count:5},{day:'Wed',count:3},
      {day:'Thu',count:7},{day:'Fri',count:1},{day:'Sat',count:4},{day:'Sun',count:2},
    ]);
    renderRecentViolations([]);
  }
}

function renderKPIs(kpis) {
  const grid = document.getElementById('kpi-grid');
  grid.innerHTML = `
    <div class="kpi-card kpi-blue">
      <div class="kpi-icon">👷</div>
      <div class="kpi-value" id="kpi-workers">${kpis.total_workers.toLocaleString()}</div>
      <div class="kpi-label">Total Workers Detected</div>
      <div class="kpi-trend">↑ ${kpis.total_analyses} analyses run</div>
    </div>
    <div class="kpi-card kpi-green">
      <div class="kpi-icon">✅</div>
      <div class="kpi-value">${kpis.safe_workers.toLocaleString()}</div>
      <div class="kpi-label">Safe Workers</div>
      <div class="kpi-trend">↑ ${kpis.total_workers > 0 ? Math.round(kpis.safe_workers/kpis.total_workers*100) : 0}% compliance rate</div>
    </div>
    <div class="kpi-card kpi-red">
      <div class="kpi-icon">🚨</div>
      <div class="kpi-value">${kpis.ppe_violations.toLocaleString()}</div>
      <div class="kpi-label">PPE Violations</div>
      <div class="kpi-trend down">⚠ Requires attention</div>
    </div>
    <div class="kpi-card kpi-orange">
      <div class="kpi-icon">🚧</div>
      <div class="kpi-value">${kpis.zone_violations.toLocaleString()}</div>
      <div class="kpi-label">Zone Violations</div>
      <div class="kpi-trend down">⚠ Restricted areas</div>
    </div>
    <div class="kpi-card kpi-purple">
      <div class="kpi-icon">🎯</div>
      <div class="kpi-value">${kpis.safety_score.toFixed(1)}%</div>
      <div class="kpi-label">Safety Score</div>
      <div class="kpi-trend">${kpis.safety_score >= 75 ? '↑ Good standing' : '↓ Needs improvement'}</div>
    </div>
  `;
}

function renderScoreRing(score) {
  document.getElementById('score-number').textContent = score.toFixed(1) + '%';
  const grade = getSafetyGrade(score);
  const gradeEl = document.getElementById('score-grade');
  gradeEl.textContent = grade.label;
  gradeEl.className = `score-grade ${grade.cls}`;
  animateScoreRing('score-ring-fill', score);
}

function renderPPEChart(ppe) {
  const ctx = document.getElementById('ppe-chart').getContext('2d');
  if (ppeChart) ppeChart.destroy();
  ppeChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['🪖 Helmet', '🦺 Safety Vest', '🧤 Gloves', '👟 Safety Shoes'],
      datasets: [{
        label: 'Compliance %',
        data: [ppe.helmet, ppe.vest, ppe.gloves, ppe.shoes],
        backgroundColor: [
          'rgba(59,130,246,0.7)',
          'rgba(34,197,94,0.7)',
          'rgba(245,158,11,0.7)',
          'rgba(168,85,247,0.7)',
        ],
        borderColor: ['#3b82f6','#22c55e','#f59e0b','#a855f7'],
        borderWidth: 1,
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true, max: 100,
          grid: { color: '#1e3453' },
          ticks: { callback: v => v + '%' },
        },
        x: { grid: { display: false } },
      },
    },
  });
}

function renderViolationsTypeChart(byType) {
  const ctx = document.getElementById('violations-type-chart').getContext('2d');
  if (violationsChart) violationsChart.destroy();
  const labels = Object.keys(byType);
  const values = Object.values(byType);
  violationsChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: ['#ef4444','#f59e0b','#f97316','#a855f7','#06b6d4'],
        borderColor: '#0d1b2e',
        borderWidth: 3,
        hoverBorderWidth: 1,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { padding: 12, boxWidth: 12 } },
      },
      cutout: '65%',
    },
  });
}

function renderTrendChart(trend) {
  const ctx = document.getElementById('trend-chart').getContext('2d');
  if (trendChart) trendChart.destroy();
  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: trend.map(d => d.day || d.date?.slice(5) || ''),
      datasets: [{
        label: 'Violations',
        data: trend.map(d => d.count),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239,68,68,0.08)',
        borderWidth: 2,
        pointBackgroundColor: '#ef4444',
        pointRadius: 4,
        fill: true,
        tension: 0.4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: '#1e3453' }, ticks: { stepSize: 1 } },
        x: { grid: { display: false } },
      },
    },
  });
}

function renderRecentViolations(violations) {
  const tbody = document.getElementById('recent-violations-tbody');
  if (!violations || violations.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7">
      <div class="empty-state" style="padding:30px;">
        <div class="empty-icon" style="font-size:32px;">✅</div>
        <h3>No recent violations</h3>
        <p>Run an analysis to detect violations</p>
      </div>
    </td></tr>`;
    return;
  }
  tbody.innerHTML = violations.map(v => `
    <tr>
      <td class="table-id">${v.violation_id || '—'}</td>
      <td class="table-worker">${v.worker_label}</td>
      <td>${v.violation_type}</td>
      <td><span class="badge ${getSeverityClass(v.severity)}">${v.severity}</span></td>
      <td class="text-muted">${v.location}</td>
      <td class="table-time">${formatTime(v.detected_at)}</td>
      <td><span class="badge ${getStatusClass(v.status)}">${v.status}</span></td>
    </tr>
  `).join('');
}

// ── Init
document.addEventListener('DOMContentLoaded', () => {
  if (!authGuard()) return;
  initSidebar('dashboard');
  initTopbar('Dashboard', 'Real-time safety monitoring overview');
  loadDashboard();
  // Auto-refresh every 60 seconds
  setInterval(loadDashboard, 60000);
});

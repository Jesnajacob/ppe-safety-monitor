/**
 * reports.js — Generate and display workplace safety reports.
 */

Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = '#1e3453';
Chart.defaults.font.family = 'Inter, sans-serif';

let currentPeriod = 'weekly';
let trendChart, scoreChart;

function switchPeriod(period) {
  currentPeriod = period;
  ['daily','weekly','monthly','all'].forEach(p => {
    document.getElementById(`tab-${p}`).classList.toggle('active', p === period);
  });
  loadReport(period);
}

async function loadReport(period) {
  // Show skeletons
  const grid = document.getElementById('report-summary-grid');
  grid.innerHTML = Array(6).fill(`<div class="report-stat-card skeleton" style="height:90px;"></div>`).join('');

  try {
    const res = await authFetch(`/api/reports/summary?period=${period}`);
    if (!res?.ok) throw new Error();
    const data = await res.json();
    renderSummary(data);
    renderInsights(data);
    renderCharts(data);
  } catch {
    // Demo fallback
    const demo = getDemoData(period);
    renderSummary(demo);
    renderInsights(demo);
    renderCharts(demo);
    showToast('Demo Mode', 'Showing demo report data', 'info', 3000);
  }
}

function getDemoData(period) {
  const multipliers = { daily: 1, weekly: 7, monthly: 30, all: 90 };
  const m = multipliers[period] || 7;
  return {
    period,
    total_inspections: 3 * m,
    total_workers: 8 * m,
    safe_workers: 7 * m,
    total_violations: m,
    ppe_violations: Math.round(m * 0.7),
    zone_violations: Math.round(m * 0.3),
    ppe_compliance_pct: 87.5,
    safety_score: 88.5,
    most_common_violation: 'Missing Gloves',
    highest_violation_zone: 'Zone A',
    daily_data: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
      violations: Math.floor(Math.random() * 6),
      inspections: Math.floor(Math.random() * 4),
    })),
  };
}

function renderSummary(data) {
  const grid = document.getElementById('report-summary-grid');
  grid.innerHTML = `
    <div class="report-stat-card">
      <div class="report-stat-icon">🔍</div>
      <div class="report-stat-value highlight-value">${data.total_inspections}</div>
      <div class="report-stat-label">Total Inspections</div>
    </div>
    <div class="report-stat-card">
      <div class="report-stat-icon">👷</div>
      <div class="report-stat-value">${data.total_workers}</div>
      <div class="report-stat-label">Workers Detected</div>
    </div>
    <div class="report-stat-card">
      <div class="report-stat-icon">✅</div>
      <div class="report-stat-value highlight-safe">${data.safe_workers}</div>
      <div class="report-stat-label">Safe Workers</div>
    </div>
    <div class="report-stat-card">
      <div class="report-stat-icon">🦺</div>
      <div class="report-stat-value" style="color:var(--blue-light);">${data.ppe_compliance_pct.toFixed(1)}%</div>
      <div class="report-stat-label">PPE Compliance</div>
    </div>
    <div class="report-stat-card">
      <div class="report-stat-icon">⚠️</div>
      <div class="report-stat-value highlight-danger">${data.total_violations}</div>
      <div class="report-stat-label">Total Violations</div>
    </div>
    <div class="report-stat-card">
      <div class="report-stat-icon">🎯</div>
      <div class="report-stat-value" style="color:${data.safety_score >= 75 ? 'var(--safe)' : 'var(--danger)'};">
        ${data.safety_score.toFixed(1)}%
      </div>
      <div class="report-stat-label">Avg Safety Score</div>
    </div>
  `;
}

function renderInsights(data) {
  const container = document.getElementById('key-insights');
  container.innerHTML = `
    <div class="key-insight">
      <div class="key-insight-icon">🚨</div>
      <div>
        <div class="key-insight-label">Most Common Violation</div>
        <div class="key-insight-value">${data.most_common_violation || 'N/A'}</div>
      </div>
    </div>
    <div class="key-insight">
      <div class="key-insight-icon">📍</div>
      <div>
        <div class="key-insight-label">Highest Violation Zone</div>
        <div class="key-insight-value">${data.highest_violation_zone || 'N/A'}</div>
      </div>
    </div>
  `;
}

function renderCharts(data) {
  const daily = data.daily_data || [];

  // Trend chart
  const trendCtx = document.getElementById('daily-trend-chart').getContext('2d');
  if (trendChart) trendChart.destroy();
  trendChart = new Chart(trendCtx, {
    type: 'bar',
    data: {
      labels: daily.map(d => d.date.slice(5)),
      datasets: [
        {
          label: 'Violations',
          data: daily.map(d => d.violations),
          backgroundColor: 'rgba(239,68,68,0.5)',
          borderColor: '#ef4444',
          borderWidth: 1,
          borderRadius: 3,
        },
        {
          label: 'Inspections',
          data: daily.map(d => d.inspections),
          backgroundColor: 'rgba(59,130,246,0.3)',
          borderColor: '#3b82f6',
          borderWidth: 1,
          borderRadius: 3,
          type: 'line',
          fill: false,
          tension: 0.4,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { boxWidth: 12 } } },
      scales: {
        y: { beginAtZero: true, grid: { color: '#1e3453' } },
        x: { grid: { display: false }, ticks: {
          maxRotation: 0,
          callback: (val, i) => i % 5 === 0 ? daily[i]?.date.slice(5) : '',
        }},
      },
    },
  });

  // Score trend (simulated daily scores)
  const scoreCtx = document.getElementById('score-trend-chart').getContext('2d');
  if (scoreChart) scoreChart.destroy();
  const scores = daily.map((d, i) => {
    const base = data.safety_score;
    return Math.max(60, Math.min(100, base + (Math.random() - 0.5) * 10));
  });
  scoreChart = new Chart(scoreCtx, {
    type: 'line',
    data: {
      labels: daily.map(d => d.date.slice(5)),
      datasets: [{
        label: 'Safety Score %',
        data: scores,
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34,197,94,0.08)',
        borderWidth: 2,
        pointRadius: 2,
        fill: true,
        tension: 0.4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { min: 50, max: 100, grid: { color: '#1e3453' }, ticks: { callback: v => v + '%' } },
        x: { grid: { display: false }, ticks: {
          callback: (val, i) => i % 5 === 0 ? daily[i]?.date.slice(5) : '',
        }},
      },
    },
  });
}

async function exportCsv() {
  try {
    const token = getToken();
    const res = await fetch(`${API_BASE}/api/reports/export/csv`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error();
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `safety_report_${currentPeriod}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    showToast('Export Complete', 'Safety report CSV downloaded.', 'success');
  } catch {
    showToast('Export Failed', 'Backend not available.', 'error');
  }
}

function printReport() {
  window.print();
}

// ── Init
document.addEventListener('DOMContentLoaded', () => {
  if (!authGuard()) return;
  initSidebar('reports');
  initTopbar('Reports', 'Workplace safety inspection reports and analytics');
  loadReport('weekly');
});

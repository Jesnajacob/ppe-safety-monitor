/**
 * analysis.js — Load and display AI analysis results.
 */

const PPE_CONFIG = {
  has_helmet: { icon: '🪖', label: 'Safety Helmet' },
  has_vest:   { icon: '🦺', label: 'Safety Vest' },
  has_gloves: { icon: '🧤', label: 'Safety Gloves' },
  has_shoes:  { icon: '👟', label: 'Safety Shoes' },
};

async function loadAnalysis(analysisId) {
  const loadingEl = document.getElementById('analysis-loading');
  const resultsEl = document.getElementById('analysis-results');

  try {
    const res = await authFetch(`/api/analysis/${analysisId}`);
    if (!res?.ok) throw new Error('Analysis not found');
    const data = await res.json();

    loadingEl.classList.add('hidden');
    resultsEl.classList.remove('hidden');

    // Update header
    document.getElementById('analysis-id-badge').textContent = `Analysis #${data.id}`;

    // Load annotated image
    if (data.has_annotated_image) {
      const imgEl = document.getElementById('annotated-image');
      imgEl.src = `${API_BASE}/api/analysis/annotated/${analysisId}`;
      imgEl.onerror = () => {
        document.getElementById('image-container').innerHTML = `
          <div class="empty-state" style="padding:60px;">
            <div class="empty-icon">🖼️</div>
            <h3>Annotated image not available</h3>
            <p>The detection results are shown in the worker cards below</p>
          </div>`;
      };
    } else {
      document.getElementById('image-container').innerHTML = `
        <div class="empty-state" style="padding:60px;">
          <div class="empty-icon">🤖</div>
          <h3>Demo analysis complete</h3>
          <p>Annotated image could not be generated for this file type</p>
        </div>`;
    }

    // Summary stats
    document.getElementById('stat-total-workers').textContent = data.total_workers;
    document.getElementById('stat-safe-workers').textContent = data.safe_workers;
    document.getElementById('stat-ppe-violations').textContent = data.ppe_violations;
    document.getElementById('stat-zone-violations').textContent = data.zone_violations;
    document.getElementById('stat-proc-time').textContent = `${data.processing_time_ms}ms`;

    // Score ring
    const score = data.safety_score;
    document.getElementById('score-pct').textContent = score.toFixed(1) + '%';
    const grade = getSafetyGrade(score);
    const gradeEl = document.getElementById('score-grade');
    gradeEl.textContent = grade.label;
    gradeEl.className = `score-grade ${grade.cls}`;
    animateScoreRing('score-ring-fill', score);

    // Worker badges
    document.getElementById('badge-safe').textContent = `${data.safe_workers} Safe`;
    const violationsCount = data.ppe_violations + data.zone_violations;
    document.getElementById('badge-violations').textContent = `${violationsCount} Violations`;

    // Worker cards
    renderWorkerCards(data.workers);

    // Show violation toasts for critical workers
    const criticalWorkers = data.workers.filter(w => !w.is_safe && w.severity === 'Critical');
    criticalWorkers.slice(0, 2).forEach(w => {
      setTimeout(() => {
        showToast(
          `⚠️ ${w.violation_type}`,
          `${w.worker_label} — ${w.zone_label}`,
          'error', 6000
        );
      }, 1000);
    });

  } catch (err) {
    loadingEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">❌</div>
        <h3>Analysis not found</h3>
        <p>${err.message}</p>
        <a href="upload.html" class="btn btn-primary" style="margin-top:16px;">Upload New File</a>
      </div>`;
  }
}

function renderWorkerCards(workers) {
  const grid = document.getElementById('workers-grid');

  if (!workers || workers.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-icon">👷</div>
        <h3>No workers detected</h3>
      </div>`;
    return;
  }

  grid.innerHTML = workers.map(worker => {
    const statusClass = worker.zone?.is_restricted || !worker.in_safe_zone
      ? 'zone' : worker.is_safe ? 'safe' : 'violation';

    const ppeRows = Object.entries(PPE_CONFIG).map(([key, cfg]) => {
      const detected = worker[key];
      return `
        <div class="ppe-row">
          <span class="ppe-name"><span class="ppe-icon">${cfg.icon}</span>${cfg.label}</span>
          <span class="ppe-status-check ${detected ? 'ppe-ok' : 'ppe-fail'}">
            ${detected ? '✓' : '✗'}
          </span>
        </div>`;
    }).join('');

    const footerText = !worker.in_safe_zone
      ? '<span style="color:var(--warning);">⚠️ Zone Violation</span>'
      : worker.is_safe
      ? '<span style="color:var(--safe);">✓ Safe</span>'
      : `<span style="color:var(--danger);">✗ ${worker.violation_type || 'PPE Violation'}</span>`;

    const confPct = Math.round((worker.confidence || 0.95) * 100);

    return `
      <div class="worker-card ${statusClass}">
        <div class="worker-card-header">
          <div>
            <div class="worker-id">${worker.worker_label}</div>
            <div class="worker-conf">Conf: ${confPct}%</div>
          </div>
          ${worker.severity ? `<span class="badge ${getSeverityClass(worker.severity)}">${worker.severity}</span>` : ''}
        </div>
        <div class="worker-ppe-list">${ppeRows}</div>
        <div class="worker-zone">
          📍 ${worker.zone_label || 'Zone A'}
          ${!worker.in_safe_zone ? ' — <span style="color:var(--warning);">RESTRICTED</span>' : ''}
        </div>
        <div class="worker-card-footer">${footerText}</div>
      </div>`;
  }).join('');
}

// ── Init
document.addEventListener('DOMContentLoaded', () => {
  if (!authGuard()) return;
  initSidebar('upload');
  initTopbar('AI Analysis Results', 'PPE compliance detection per worker');

  const params = new URLSearchParams(window.location.search);
  const analysisId = params.get('id');

  if (!analysisId) {
    document.getElementById('analysis-loading').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🤖</div>
        <h3>No analysis selected</h3>
        <p>Upload a file and run analysis first</p>
        <a href="upload.html" class="btn btn-primary" style="margin-top:16px;">Go to Upload</a>
      </div>`;
    return;
  }

  loadAnalysis(analysisId);
});

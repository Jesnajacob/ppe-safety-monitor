/**
 * upload.js — Handle file upload, preview, and analysis trigger.
 */

let uploadedFileId = null;
let analysisResult = null;

// ── Drop Zone Setup
function initDropZone() {
  const zone = document.getElementById('upload-zone');
  const input = document.getElementById('file-input');

  ['dragenter', 'dragover'].forEach(evt =>
    zone.addEventListener(evt, e => { e.preventDefault(); zone.classList.add('drag-over'); })
  );
  ['dragleave', 'drop'].forEach(evt =>
    zone.addEventListener(evt, e => { e.preventDefault(); zone.classList.remove('drag-over'); })
  );
  zone.addEventListener('drop', e => {
    const files = e.dataTransfer.files;
    if (files.length) handleFile(files[0]);
  });
  input.addEventListener('change', e => {
    if (e.target.files.length) handleFile(e.target.files[0]);
  });
}

function handleFile(file) {
  const allowed = ['image/jpeg','image/jpg','image/png','video/mp4','video/avi','video/quicktime','video/x-msvideo'];
  if (!allowed.includes(file.type)) {
    showToast('Invalid File', 'Please upload JPG, PNG, MP4, AVI, or MOV files only.', 'error');
    return;
  }

  // Show file info
  document.getElementById('file-info').classList.remove('hidden');
  document.getElementById('upload-zone').style.display = 'none';

  const isVideo = file.type.startsWith('video/');
  document.getElementById('file-icon').textContent = isVideo ? '🎬' : '🖼️';
  document.getElementById('file-name').textContent = file.name;
  document.getElementById('file-meta').textContent =
    `${formatFileSize(file.size)} · ${file.type} · ${isVideo ? 'Video' : 'Image'}`;

  // Preview
  const previewContainer = document.getElementById('preview-container');
  const url = URL.createObjectURL(file);
  if (isVideo) {
    previewContainer.innerHTML = `<video src="${url}" controls></video>`;
  } else {
    previewContainer.innerHTML = `<img src="${url}" alt="Preview"/>`;
  }
  previewContainer.classList.remove('hidden');

  // Upload file
  uploadFile(file);
}

async function uploadFile(file) {
  const progressBar = document.getElementById('upload-progress-bar');
  const progressFill = document.getElementById('upload-progress-fill');
  const statusEl = document.getElementById('upload-status');
  const analyzeBtn = document.getElementById('analyze-btn');

  progressBar.style.display = 'block';
  statusEl.textContent = 'Uploading...';
  analyzeBtn.disabled = true;

  // Simulate progress
  let progress = 0;
  const interval = setInterval(() => {
    progress = Math.min(progress + 10, 85);
    progressFill.style.width = progress + '%';
  }, 100);

  const formData = new FormData();
  formData.append('file', file);

  try {
    const token = getToken();
    const res = await fetch(`${API_BASE}/api/media/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    clearInterval(interval);

    if (res.status === 401) { clearAuth(); window.location.href = 'index.html'; return; }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Upload failed');
    }

    progressFill.style.width = '100%';
    const data = await res.json();
    uploadedFileId = data.id;

    statusEl.textContent = '✅ Upload complete — ready to analyze!';
    statusEl.style.color = 'var(--safe)';
    analyzeBtn.disabled = false;

    // Set step 1 as done
    document.getElementById('step1-card').className = 'step-card done';
    document.getElementById('step2-card').className = 'step-card active';

    showToast('Upload Complete', `${data.original_filename} is ready for analysis.`, 'success');
    loadRecentAnalyses();

  } catch (err) {
    clearInterval(interval);
    progressFill.style.width = '0%';
    progressFill.style.background = 'var(--danger)';
    statusEl.textContent = `❌ ${err.message}`;
    statusEl.style.color = 'var(--danger)';
    showToast('Upload Failed', err.message, 'error');
  }
}

async function runAnalysis() {
  if (!uploadedFileId) return;

  const btn = document.getElementById('analyze-btn');
  btn.disabled = true;
  btn.innerHTML = `<div class="loading-spinner" style="width:20px;height:20px;"></div> Analyzing...`;

  showLoading('Running AI Safety Analysis...');

  try {
    const res = await authFetch(`/api/analysis/analyze/${uploadedFileId}`, { method: 'POST' });
    if (!res?.ok) throw new Error((await res?.json())?.detail || 'Analysis failed');

    const result = await res.json();
    analysisResult = result;
    hideLoading();

    // Step tracker
    document.getElementById('step2-card').className = 'step-card done';
    document.getElementById('step3-card').className = 'step-card active';

    // Show critical violations alert
    if (result.zone_violations > 0 || result.ppe_violations > 0) {
      showViolationAlert(result);
    } else {
      showToast(
        '✅ Analysis Complete',
        `${result.total_workers} workers detected — Safety Score: ${result.safety_score}%`,
        'success'
      );
    }

    // Navigate to analysis page
    setTimeout(() => {
      window.location.href = `analysis.html?id=${result.analysis_id}`;
    }, result.ppe_violations > 0 ? 3000 : 1500);

  } catch (err) {
    hideLoading();
    btn.disabled = false;
    btn.innerHTML = '🤖 Analyze Safety';
    showToast('Analysis Failed', err.message, 'error');
  }
}

function showViolationAlert(result) {
  const modal = document.getElementById('violation-alert-modal');
  const body = document.getElementById('violation-alert-body');

  body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div style="background:var(--danger-bg);border:1px solid var(--danger-border);border-radius:var(--radius-md);padding:12px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:var(--danger);">${result.ppe_violations}</div>
          <div style="font-size:11px;color:var(--text-muted);">PPE Violations</div>
        </div>
        <div style="background:var(--warning-bg);border:1px solid var(--warning-border);border-radius:var(--radius-md);padding:12px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:var(--warning);">${result.zone_violations}</div>
          <div style="font-size:11px;color:var(--text-muted);">Zone Violations</div>
        </div>
      </div>
      <div style="background:var(--bg-surface);border-radius:var(--radius-md);padding:12px;font-size:13px;color:var(--text-secondary);">
        <strong>Workers Detected:</strong> ${result.total_workers}<br/>
        <strong>Safe Workers:</strong> ${result.safe_workers}<br/>
        <strong>Safety Score:</strong> <span style="color:${result.safety_score >= 75 ? 'var(--safe)' : 'var(--danger)'};">${result.safety_score}%</span>
      </div>
      <p style="font-size:12px;color:var(--text-muted);">
        You will be redirected to the full analysis results in a moment...
      </p>
    </div>
  `;

  modal.classList.remove('hidden');
}

function closeViolationModal() {
  document.getElementById('violation-alert-modal').classList.add('hidden');
}

function acknowledgeAndClose() {
  closeViolationModal();
  showToast('Violation Acknowledged', 'Redirecting to full analysis...', 'warning');
}

function clearUpload() {
  uploadedFileId = null;
  document.getElementById('file-info').classList.add('hidden');
  document.getElementById('upload-zone').style.display = '';
  document.getElementById('file-input').value = '';
  document.getElementById('upload-progress-fill').style.width = '0%';
  document.getElementById('upload-status').textContent = '';
  document.getElementById('step1-card').className = 'step-card active';
  document.getElementById('step2-card').className = 'step-card';
  document.getElementById('step3-card').className = 'step-card';
}

async function loadRecentAnalyses() {
  const container = document.getElementById('recent-analyses');
  try {
    const res = await authFetch('/api/analysis/list/all?limit=5');
    if (!res?.ok) throw new Error();
    const data = await res.json();
    if (!data.length) {
      container.innerHTML = '<p>No analyses yet. Upload a file to get started.</p>';
      return;
    }
    container.innerHTML = data.map(a => `
      <a href="analysis.html?id=${a.id}" style="display:flex;align-items:center;justify-content:space-between;
         padding:8px 10px;border-radius:var(--radius-md);border:1px solid var(--border);
         background:var(--bg-surface);margin-bottom:6px;text-decoration:none;color:inherit;
         transition:border-color var(--duration);" onmouseover="this.style.borderColor='var(--border-focus)'"
         onmouseout="this.style.borderColor='var(--border)'">
        <div>
          <div style="font-size:12px;font-weight:600;color:var(--text-primary);">
            Analysis #${a.id}
          </div>
          <div style="font-size:10px;color:var(--text-muted);">
            ${a.total_workers} workers · ${formatDate(a.analyzed_at)}
          </div>
        </div>
        <span style="font-size:11px;color:${a.safety_score >= 75 ? 'var(--safe)' : 'var(--danger)'};">
          ${a.safety_score}%
        </span>
      </a>
    `).join('');
  } catch {
    container.innerHTML = '<p>No recent analyses.</p>';
  }
}

// ── Init
document.addEventListener('DOMContentLoaded', () => {
  if (!authGuard()) return;
  initSidebar('upload');
  initTopbar('Media Analysis', 'Upload images or videos for AI PPE detection');
  initDropZone();
  loadRecentAnalyses();

  document.getElementById('analyze-btn').addEventListener('click', runAnalysis);
});

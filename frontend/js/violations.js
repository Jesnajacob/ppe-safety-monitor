/**
 * violations.js — Load, filter, and manage safety violations.
 */

const PAGE_SIZE = 15;
let currentPage = 0;
let currentFilters = {};

async function loadStats() {
  try {
    const res = await authFetch('/api/violations/stats/summary');
    if (!res?.ok) throw new Error();
    const data = await res.json();

    document.getElementById('stats-strip').innerHTML = `
      <div class="stat-strip-card">
        <div class="stat-strip-value">${data.total}</div>
        <div class="stat-strip-label">Total Violations</div>
      </div>
      <div class="stat-strip-card" style="border-color:var(--danger-border);">
        <div class="stat-strip-value" style="color:var(--danger);">${data.by_status?.Open || 0}</div>
        <div class="stat-strip-label">Open</div>
      </div>
      <div class="stat-strip-card" style="border-color:var(--warning-border);">
        <div class="stat-strip-value" style="color:var(--warning);">${data.by_status?.Acknowledged || 0}</div>
        <div class="stat-strip-label">Acknowledged</div>
      </div>
      <div class="stat-strip-card" style="border-color:var(--safe-border);">
        <div class="stat-strip-value" style="color:var(--safe);">${data.by_status?.Resolved || 0}</div>
        <div class="stat-strip-label">Resolved</div>
      </div>
    `;
  } catch {
    document.getElementById('stats-strip').innerHTML = `
      <div class="stat-strip-card"><div class="stat-strip-value">—</div><div class="stat-strip-label">Total Violations</div></div>
      <div class="stat-strip-card"><div class="stat-strip-value">—</div><div class="stat-strip-label">Open</div></div>
      <div class="stat-strip-card"><div class="stat-strip-value">—</div><div class="stat-strip-label">Acknowledged</div></div>
      <div class="stat-strip-card"><div class="stat-strip-value">—</div><div class="stat-strip-label">Resolved</div></div>
    `;
  }
}

async function loadViolations(page = 0, filters = {}) {
  const tbody = document.getElementById('violations-tbody');
  tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:60px;">
    <div class="loading-spinner" style="margin:0 auto;"></div></td></tr>`;

  const params = new URLSearchParams({
    skip: page * PAGE_SIZE,
    limit: PAGE_SIZE,
    ...filters,
  });
  // Remove empty params
  for (const [k, v] of [...params]) { if (!v) params.delete(k); }

  try {
    const res = await authFetch(`/api/violations/?${params.toString()}`);
    if (!res?.ok) throw new Error();
    const data = await res.json();

    document.getElementById('showing-count').textContent = data.violations.length;
    document.getElementById('total-count').textContent = data.total;

    if (!data.violations.length) {
      tbody.innerHTML = `<tr><td colspan="9">
        <div class="empty-state" style="padding:50px;">
          <div class="empty-icon">✅</div>
          <h3>No violations found</h3>
          <p>Try adjusting your filters or run an analysis</p>
        </div></td></tr>`;
      document.getElementById('pagination').innerHTML = '';
      return;
    }

    tbody.innerHTML = data.violations.map(v => `
      <tr id="row-${v.id}">
        <td class="table-id">${v.violation_id || `#${v.id}`}</td>
        <td class="table-worker">${v.worker_label}</td>
        <td style="color:var(--text-primary);max-width:200px;">${v.violation_type}</td>
        <td style="color:var(--text-muted);font-size:12px;">${v.ppe_item || '—'}</td>
        <td>
          <div style="font-size:12px;color:var(--text-primary);">${formatDate(v.detected_at)}</div>
          <div class="table-time">${formatTime(v.detected_at)}</div>
        </td>
        <td style="font-size:12px;color:var(--text-secondary);">${v.location}</td>
        <td><span class="badge ${getSeverityClass(v.severity)}">${v.severity}</span></td>
        <td><span class="badge ${getStatusClass(v.status)}" id="status-${v.id}">${v.status}</span></td>
        <td>
          <div style="display:flex;gap:4px;">
            ${v.status === 'Open' ? `<button class="action-btn-sm acknowledge"
              onclick="acknowledgeViolation(${v.id})">Ack</button>` : ''}
            ${v.status !== 'Resolved' ? `<button class="action-btn-sm resolve"
              onclick="resolveViolation(${v.id})">Resolve</button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');

    // Pagination
    const totalPages = Math.ceil(data.total / PAGE_SIZE);
    renderPagination(page, totalPages);

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9">
      <div class="empty-state" style="padding:50px;">
        <div class="empty-icon">⚠️</div>
        <h3>Could not load violations</h3>
        <p>Make sure the backend server is running</p>
      </div></td></tr>`;
  }
}

function renderPagination(currentPage, totalPages) {
  const pg = document.getElementById('pagination');
  if (totalPages <= 1) { pg.innerHTML = ''; return; }

  let html = `<button class="page-btn" onclick="goToPage(${currentPage - 1})"
    ${currentPage === 0 ? 'disabled style="opacity:0.3"' : ''}>‹</button>`;

  for (let i = 0; i < totalPages; i++) {
    if (i < 2 || i > totalPages - 3 || Math.abs(i - currentPage) <= 1) {
      html += `<button class="page-btn ${i === currentPage ? 'active' : ''}"
        onclick="goToPage(${i})">${i + 1}</button>`;
    } else if (Math.abs(i - currentPage) === 2) {
      html += `<span style="color:var(--text-muted);padding:0 4px;">…</span>`;
    }
  }

  html += `<button class="page-btn" onclick="goToPage(${currentPage + 1})"
    ${currentPage >= totalPages - 1 ? 'disabled style="opacity:0.3"' : ''}>›</button>`;

  pg.innerHTML = html;
}

function goToPage(page) {
  currentPage = page;
  loadViolations(currentPage, currentFilters);
  window.scrollTo(0, 0);
}

function applyFilters() {
  currentFilters = {
    violation_type: document.getElementById('filter-type').value,
    severity:       document.getElementById('filter-severity').value,
    status:         document.getElementById('filter-status').value,
    worker:         document.getElementById('filter-worker').value,
    date_from:      document.getElementById('filter-date-from').value,
    date_to:        document.getElementById('filter-date-to').value,
  };
  currentPage = 0;
  loadViolations(currentPage, currentFilters);
}

function clearFilters() {
  ['filter-type','filter-severity','filter-status','filter-worker',
   'filter-date-from','filter-date-to'].forEach(id => {
    document.getElementById(id).value = '';
  });
  currentFilters = {};
  currentPage = 0;
  loadViolations(0, {});
}

async function acknowledgeViolation(id) {
  try {
    const res = await authFetch(`/api/violations/${id}/acknowledge`, { method: 'PATCH' });
    if (!res?.ok) throw new Error();
    document.getElementById(`status-${id}`).className = 'badge status-acknowledged';
    document.getElementById(`status-${id}`).textContent = 'Acknowledged';
    showToast('Violation Acknowledged', `Violation #${id} has been acknowledged.`, 'warning');
    setTimeout(() => loadViolations(currentPage, currentFilters), 1000);
  } catch {
    showToast('Error', 'Could not acknowledge violation', 'error');
  }
}

async function resolveViolation(id) {
  try {
    const res = await authFetch(`/api/violations/${id}/resolve`, { method: 'PATCH' });
    if (!res?.ok) throw new Error();
    document.getElementById(`status-${id}`).className = 'badge status-resolved';
    document.getElementById(`status-${id}`).textContent = 'Resolved';
    showToast('Violation Resolved', `Violation #${id} has been resolved.`, 'success');
    setTimeout(() => loadViolations(currentPage, currentFilters), 1000);
  } catch {
    showToast('Error', 'Could not resolve violation', 'error');
  }
}

async function exportCSV(e) {
  e.preventDefault();
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
    a.download = `violations_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    showToast('Export Complete', 'Violations CSV downloaded.', 'success');
  } catch {
    showToast('Export Failed', 'Could not export CSV', 'error');
  }
}

// ── Init
document.addEventListener('DOMContentLoaded', () => {
  if (!authGuard()) return;
  initSidebar('violations');
  initTopbar('Violation Management', 'Track and manage all detected safety violations');
  loadStats();
  loadViolations();

  // Enter to apply filters
  ['filter-type','filter-severity','filter-status','filter-worker'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', applyFilters);
  });
});

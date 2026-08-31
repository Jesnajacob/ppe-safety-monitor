/**
 * app.js — Shared utilities, auth guard, API helpers, toast notifications
 * All pages import this script first.
 */

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────

const API_BASE = 'http://localhost:8000';
const TOKEN_KEY = 'safety_token';
const USER_KEY  = 'safety_user';

// ─────────────────────────────────────────────
// Auth helpers
// ─────────────────────────────────────────────

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function getUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
}

function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Auth guard — redirect to login if no token.
 * Call at the top of every protected page.
 */
function authGuard() {
  if (!getToken()) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

/**
 * Fetch wrapper that automatically adds the Authorization header.
 */
async function authFetch(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_BASE}${url}`, { ...options, headers });

  if (res.status === 401) {
    clearAuth();
    window.location.href = 'index.html';
    return;
  }

  return res;
}

// ─────────────────────────────────────────────
// Toast notifications
// ─────────────────────────────────────────────

(function initToastContainer() {
  const container = document.createElement('div');
  container.className = 'toast-container';
  container.id = 'toast-container';
  document.body.appendChild(container);
})();

function showToast(title, message = '', type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  const icons = {
    success: '✅',
    error:   '❌',
    warning: '⚠️',
    info:    'ℹ️',
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
    <button class="toast-close" onclick="closeToast(this.parentElement)">×</button>
  `;

  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => closeToast(toast), duration);
  }

  return toast;
}

function closeToast(toast) {
  if (!toast || !toast.parentElement) return;
  toast.classList.add('removing');
  setTimeout(() => toast.remove(), 300);
}

// ─────────────────────────────────────────────
// Loading overlay
// ─────────────────────────────────────────────

let loadingEl = null;

function showLoading(message = 'Processing...') {
  if (loadingEl) return;
  loadingEl = document.createElement('div');
  loadingEl.className = 'loading-overlay';
  loadingEl.innerHTML = `
    <div class="loading-spinner"></div>
    <div class="loading-text">${message}</div>
  `;
  document.body.appendChild(loadingEl);
}

function hideLoading() {
  if (loadingEl) { loadingEl.remove(); loadingEl = null; }
}

// ─────────────────────────────────────────────
// Sidebar helpers
// ─────────────────────────────────────────────

/**
 * Build the sidebar HTML and inject it.
 * @param {string} activePage - The active nav item id.
 */
function initSidebar(activePage) {
  const navItems = [
    { id: 'dashboard',  icon: '📊', label: 'Dashboard',         href: 'dashboard.html' },
    { id: 'upload',     icon: '📤', label: 'Media Analysis',    href: 'upload.html' },
    { id: 'violations', icon: '⚠️', label: 'Violations',         href: 'violations.html', badge: true },
    { id: 'zones',      icon: '🚧', label: 'Restricted Zones',  href: 'zones.html' },
    { id: 'reports',    icon: '📋', label: 'Reports',            href: 'reports.html' },
    { id: 'settings',   icon: '⚙️', label: 'Settings',           href: 'settings.html' },
  ];

  const user = getUser();
  const initials = user?.full_name
    ? user.full_name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
    : 'SA';

  const navHTML = navItems.map(item => `
    <a class="nav-item ${item.id === activePage ? 'active' : ''}"
       href="${item.href}" id="nav-${item.id}">
      <span class="nav-icon">${item.icon}</span>
      <span>${item.label}</span>
      ${item.badge ? '<span class="nav-badge" id="violations-badge" style="display:none">0</span>' : ''}
    </a>
  `).join('');

  const sidebarHTML = `
    <div class="sidebar" id="main-sidebar">
      <div class="sidebar-logo">
        <div class="logo-icon">🦺</div>
        <div class="brand">
          <div class="brand-name">SafetyVision AI</div>
          <div class="brand-sub">PPE Monitoring System</div>
        </div>
      </div>
      <div class="demo-badge-sidebar">⚡ DEMO AI MODE ACTIVE</div>
      <nav class="sidebar-nav">
        <div class="nav-section-label">Main Menu</div>
        ${navHTML}
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-user" onclick="window.location.href='settings.html'">
          <div class="user-avatar">${initials}</div>
          <div class="user-info">
            <div class="user-name">${user?.full_name || 'Safety Admin'}</div>
            <div class="user-role">${user?.role || 'Administrator'}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const sidebarContainer = document.getElementById('sidebar-container');
  if (sidebarContainer) sidebarContainer.innerHTML = sidebarHTML;

  // Load violations badge count
  loadViolationsBadge();
}

async function loadViolationsBadge() {
  try {
    const res = await authFetch('/api/violations/?status=Open&limit=100');
    if (!res?.ok) return;
    const data = await res.json();
    const badge = document.getElementById('violations-badge');
    if (badge && data.total > 0) {
      badge.textContent = data.total;
      badge.style.display = 'inline';
    }
  } catch {}
}

/**
 * Init top navbar.
 */
function initTopbar(title, subtitle = '') {
  const topbar = document.getElementById('topbar');
  if (!topbar) return;

  topbar.innerHTML = `
    <div class="topbar-left">
      <div class="topbar-title">${title}</div>
      ${subtitle ? `<div class="topbar-subtitle">${subtitle}</div>` : ''}
    </div>
    <div class="topbar-right">
      <button class="topbar-btn" id="mobile-menu-btn" title="Toggle Menu">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      <button class="topbar-btn" title="Notifications" id="notif-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <span class="notif-dot"></span>
      </button>
      <div class="topbar-avatar" title="Profile" onclick="window.location.href='settings.html'">${
        (() => { const u = getUser(); return u?.full_name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() || 'SA'; })()
      }</div>
    </div>
  `;

  // Mobile sidebar toggle
  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('main-sidebar')?.classList.toggle('open');
  });
}

// ─────────────────────────────────────────────
// Format helpers
// ─────────────────────────────────────────────

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return `${formatDate(dateStr)} ${formatTime(dateStr)}`;
}

function getSafetyGrade(score) {
  if (score >= 90) return { label: 'Excellent', cls: 'grade-excellent' };
  if (score >= 75) return { label: 'Good',      cls: 'grade-good' };
  if (score >= 50) return { label: 'Warning',   cls: 'grade-warning' };
  return              { label: 'Critical',   cls: 'grade-critical' };
}

function getSeverityClass(severity) {
  const map = {
    'Low': 'sev-low',
    'Medium': 'sev-medium',
    'High': 'sev-high',
    'Critical': 'sev-critical',
  };
  return map[severity] || 'sev-medium';
}

function getStatusClass(status) {
  const map = {
    'Open': 'status-open',
    'Acknowledged': 'status-acknowledged',
    'Resolved': 'status-resolved',
  };
  return map[status] || 'status-open';
}

// ─────────────────────────────────────────────
// Safety score ring animation
// ─────────────────────────────────────────────

function animateScoreRing(elementId, score) {
  const fill = document.getElementById(elementId);
  if (!fill) return;
  const circumference = 408; // 2 * π * 65
  const offset = circumference - (score / 100) * circumference;

  // Animate
  setTimeout(() => {
    fill.style.strokeDashoffset = offset;

    // Color based on score
    if (score >= 90) fill.style.stroke = '#22c55e';
    else if (score >= 75) fill.style.stroke = '#34d399';
    else if (score >= 50) fill.style.stroke = '#f59e0b';
    else fill.style.stroke = '#ef4444';
  }, 100);
}

// ─────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────

function logout() {
  clearAuth();
  window.location.href = 'index.html';
}

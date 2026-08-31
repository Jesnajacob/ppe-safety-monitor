/**
 * zones.js — Interactive canvas-based restricted zone drawing and management.
 */

let canvas, ctx;
let currentPoints = [];
let savedZones = [];
let isDrawing = false;
const CLOSE_RADIUS = 15; // pixels to close polygon

function initCanvas() {
  canvas = document.getElementById('zone-canvas');
  ctx = canvas.getContext('2d');

  // Resize canvas to match CSS display size
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = 400;
    redrawAll();
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  canvas.addEventListener('click', handleCanvasClick);
  canvas.addEventListener('mousemove', handleMouseMove);
}

function handleCanvasClick(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (currentPoints.length >= 3) {
    // Check if clicking near the first point to close
    const first = currentPoints[0];
    const dist = Math.hypot(x - first.x, y - first.y);
    if (dist <= CLOSE_RADIUS) {
      closePoly();
      return;
    }
  }

  currentPoints.push({ x, y });
  document.getElementById('save-zone-btn').disabled = currentPoints.length < 3;
  redrawAll();
}

let mousePos = null;
function handleMouseMove(e) {
  const rect = canvas.getBoundingClientRect();
  mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  redrawAll();
}

function closePoly() {
  if (currentPoints.length < 3) return;
  const name = document.getElementById('zone-name-input').value.trim()
    || `Zone ${savedZones.length + 1}`;
  const color = document.getElementById('zone-color-input').value;

  const zone = {
    id: Date.now(),
    name,
    color,
    points: [...currentPoints],
    is_active: true,
    created_at: new Date().toISOString(),
  };

  savedZones.push(zone);
  currentPoints = [];
  mousePos = null;
  document.getElementById('save-zone-btn').disabled = true;

  renderZonesList();
  redrawAll();
  saveZoneToServer(zone);
  showToast('Zone Created', `"${name}" has been defined.`, 'success');
}

function saveCurrentZone() {
  if (currentPoints.length >= 3) closePoly();
}

function clearCurrentDraw() {
  currentPoints = [];
  mousePos = null;
  document.getElementById('save-zone-btn').disabled = true;
  redrawAll();
}

function deleteZone(id) {
  savedZones = savedZones.filter(z => z.id !== id);
  renderZonesList();
  redrawAll();
  showToast('Zone Deleted', 'Restricted zone removed.', 'warning');
}

function toggleZone(id) {
  const zone = savedZones.find(z => z.id === id);
  if (zone) { zone.is_active = !zone.is_active; }
  renderZonesList();
  redrawAll();
}

function redrawAll() {
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;

  // Clear
  ctx.clearRect(0, 0, W, H);

  // Background grid
  ctx.strokeStyle = 'rgba(30, 52, 83, 0.5)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Draw placeholder image hint
  ctx.fillStyle = 'rgba(148, 163, 184, 0.08)';
  ctx.font = '14px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Click to define restricted zone polygon', W / 2, H / 2 - 10);
  ctx.font = '11px Inter, sans-serif';
  ctx.fillText('Upload an image as background via the Media Analysis page', W / 2, H / 2 + 14);
  ctx.textAlign = 'left';

  // Draw saved zones
  for (const zone of savedZones) {
    if (!zone.is_active) continue;
    drawZonePoly(zone.points, zone.color, zone.name, 0.3);
  }

  // Draw current in-progress polygon
  if (currentPoints.length > 0) {
    const color = document.getElementById('zone-color-input')?.value || '#EF4444';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
    for (let i = 1; i < currentPoints.length; i++) {
      ctx.lineTo(currentPoints[i].x, currentPoints[i].y);
    }

    // Preview line to mouse
    if (mousePos) {
      ctx.lineTo(mousePos.x, mousePos.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw points
    for (let i = 0; i < currentPoints.length; i++) {
      const pt = currentPoints[i];
      const isFirst = i === 0;
      const isNearFirst = mousePos && i === 0 && Math.hypot(mousePos.x - pt.x, mousePos.y - pt.y) <= CLOSE_RADIUS;

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isFirst ? 8 : 5, 0, Math.PI * 2);
      ctx.fillStyle = isNearFirst ? '#22c55e' : (isFirst ? color : '#fff');
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Fill current area
    if (currentPoints.length >= 3) {
      ctx.beginPath();
      ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
      currentPoints.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fillStyle = color + '22';
      ctx.fill();
    }
  }
}

function drawZonePoly(points, color, name, alpha = 0.25) {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  points.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.closePath();
  ctx.fillStyle = color + Math.round(alpha * 255).toString(16).padStart(2, '0');
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.stroke();

  // Label
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(name, cx, cy);
  ctx.textAlign = 'left';
}

function renderZonesList() {
  const listEl = document.getElementById('zones-list');
  document.getElementById('zones-count').textContent = `${savedZones.length} zones`;

  if (!savedZones.length) {
    listEl.innerHTML = `<div class="empty-state" style="padding:30px;">
      <div class="empty-icon" style="font-size:32px;">🚧</div>
      <h3 style="font-size:14px;">No zones defined</h3>
      <p>Draw a zone on the canvas to get started</p>
    </div>`;
    return;
  }

  listEl.innerHTML = savedZones.map(zone => `
    <div class="zone-list-item">
      <div class="zone-color-dot" style="background:${zone.color};"></div>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:600;color:var(--text-primary);">${zone.name}</div>
        <div style="font-size:10px;color:var(--text-muted);">
          ${zone.points.length} points · ${formatDateTime(zone.created_at)}
        </div>
      </div>
      <div style="display:flex;gap:4px;">
        <button class="action-btn-sm" onclick="toggleZone(${zone.id})" title="${zone.is_active ? 'Deactivate' : 'Activate'}">
          ${zone.is_active ? '👁️' : '👁️‍🗨️'}
        </button>
        <button class="action-btn-sm" onclick="simulateZoneViolation('${zone.name}')" title="Simulate violation">⚠️</button>
        <button class="action-btn-sm" onclick="deleteZone(${zone.id})" style="color:var(--danger);border-color:var(--danger-border);">🗑️</button>
      </div>
    </div>
  `).join('');
}

async function saveZoneToServer(zone) {
  try {
    const coordinates = zone.points.map(p => ({
      x: p.x / canvas.width,
      y: p.y / canvas.height,
    }));
    await authFetch('/api/zones/', {
      method: 'POST',
      body: JSON.stringify({
        name: zone.name,
        zone_type: 'Polygon',
        coordinates,
        color: zone.color,
        description: `Defined via canvas at ${new Date().toLocaleString()}`,
      }),
    });
  } catch {}
}

async function loadZonesFromServer() {
  try {
    const res = await authFetch('/api/zones/');
    if (!res?.ok) return;
    const zones = await res.json();
    const W = canvas.width, H = 400;
    savedZones = zones.map(z => ({
      id: z.id,
      name: z.name,
      color: z.color,
      is_active: z.is_active,
      created_at: z.created_at,
      points: (z.coordinates || []).map(c => ({
        x: c.x * W,
        y: c.y * H,
      })),
    }));
    renderZonesList();
    redrawAll();
  } catch {}
}

function simulateZoneViolation(zoneName) {
  const workers = ['Worker #03', 'Worker #07', 'Worker #12'];
  const worker = workers[Math.floor(Math.random() * workers.length)];
  const alertEl = document.getElementById('zone-alert');
  const alertText = document.getElementById('zone-alert-text');
  alertText.textContent = `${worker} entered ${zoneName}. Violation recorded.`;
  alertEl.classList.add('show');
  setTimeout(() => alertEl.classList.remove('show'), 8000);

  // Add to log
  const log = document.getElementById('zone-violation-log');
  const entry = document.createElement('div');
  entry.style.cssText = 'padding:8px 0;border-bottom:1px solid var(--border-subtle);';
  entry.innerHTML = `
    <div style="font-weight:600;color:var(--danger);font-size:12px;">⚠️ Zone Entry Detected</div>
    <div style="color:var(--text-secondary);font-size:11px;">${worker} → ${zoneName}</div>
    <div style="color:var(--text-muted);font-size:10px;">${new Date().toLocaleString()}</div>
  `;
  if (log.firstChild?.classList?.contains('text-muted')) log.innerHTML = '';
  log.prepend(entry);

  showToast('⚠️ Zone Violation', `${worker} entered ${zoneName}`, 'error', 6000);
}

// ── Init
document.addEventListener('DOMContentLoaded', () => {
  if (!authGuard()) return;
  initSidebar('zones');
  initTopbar('Restricted Zone Monitoring', 'Define and manage restricted safety areas');
  initCanvas();
  loadZonesFromServer();
});

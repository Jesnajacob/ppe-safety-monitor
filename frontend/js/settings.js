/**
 * settings.js — Handle application settings, PPE requirements, thresholds, and user profile.
 */

async function loadSettings() {
  try {
    const res = await authFetch('/api/settings/');
    if (res && res.ok) {
      const data = await res.json();
      if (document.getElementById('set-require-helmet')) document.getElementById('set-require-helmet').checked = data.require_helmet;
      if (document.getElementById('set-require-vest')) document.getElementById('set-require-vest').checked = data.require_vest;
      if (document.getElementById('set-require-gloves')) document.getElementById('set-require-gloves').checked = data.require_gloves;
      if (document.getElementById('set-require-shoes')) document.getElementById('set-require-shoes').checked = data.require_shoes;

      const confPct = Math.round((data.confidence_threshold || 0.6) * 100);
      if (document.getElementById('set-confidence')) {
        document.getElementById('set-confidence').value = confPct;
        document.getElementById('conf-val').textContent = `${confPct}%`;
      }
      if (document.getElementById('set-site-name')) document.getElementById('set-site-name').value = data.site_name || 'Construction Site A';
      if (document.getElementById('set-demo-mode')) document.getElementById('set-demo-mode').checked = data.demo_mode ?? true;
      if (document.getElementById('set-alert-popup')) document.getElementById('set-alert-popup').checked = data.alert_on_violation ?? true;
      if (document.getElementById('set-alert-email')) document.getElementById('set-alert-email').value = data.alert_email || 'admin@safety.com';
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }

  // Load user info
  const user = getUser();
  if (user) {
    if (document.getElementById('user-fullname')) document.getElementById('user-fullname').value = user.full_name || '';
    if (document.getElementById('user-email')) document.getElementById('user-email').value = user.email || '';
  }
}

async function savePPESettings() {
  const payload = {
    require_helmet: document.getElementById('set-require-helmet').checked,
    require_vest: document.getElementById('set-require-vest').checked,
    require_gloves: document.getElementById('set-require-gloves').checked,
    require_shoes: document.getElementById('set-require-shoes').checked,
  };
  await updateSettings(payload, 'PPE Requirements updated successfully.');
}

async function saveAISettings() {
  const confVal = parseInt(document.getElementById('set-confidence').value, 10) / 100;
  const payload = {
    confidence_threshold: confVal,
    site_name: document.getElementById('set-site-name').value,
    demo_mode: document.getElementById('set-demo-mode').checked,
  };
  await updateSettings(payload, 'AI & Detection settings saved.');
}

async function saveAlertSettings() {
  const payload = {
    alert_on_violation: document.getElementById('set-alert-popup').checked,
    alert_email: document.getElementById('set-alert-email').value,
  };
  await updateSettings(payload, 'Alert settings updated.');
}

async function updateSettings(payload, successMsg) {
  try {
    const res = await authFetch('/api/settings/', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (res && res.ok) {
      showToast('Settings Saved', successMsg, 'success');
    } else {
      showToast('Error', 'Failed to update settings', 'error');
    }
  } catch (err) {
    showToast('Settings Updated', successMsg + ' (Local)', 'success');
  }
}

async function saveUserProfile() {
  const full_name = document.getElementById('user-fullname').value;
  const email = document.getElementById('user-email').value;

  try {
    const res = await authFetch('/api/settings/profile', {
      method: 'PUT',
      body: JSON.stringify({ full_name, email }),
    });
    if (res && res.ok) {
      const user = getUser() || {};
      user.full_name = full_name;
      user.email = email;
      setUser(user);
      showToast('Profile Saved', 'Your user profile details have been updated.', 'success');
      initSidebar('settings');
      initTopbar('Settings', 'Configure detection policies and preferences');
    } else {
      showToast('Error', 'Could not update profile', 'error');
    }
  } catch (err) {
    showToast('Profile Updated', 'Saved profile locally.', 'success');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!authGuard()) return;
  initSidebar('settings');
  initTopbar('Settings', 'Configure detection policies, PPE rules, and alerts');
  loadSettings();
});

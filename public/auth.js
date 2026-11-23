/**
 * JobConnect Auth Helper Module
 * Manages JWT tokens, user session state, role validation, and navbar UI.
 */

const AUTH_STORAGE_KEY_TOKEN = 'jobconnect_token';
const AUTH_STORAGE_KEY_USER = 'jobconnect_user';

function getAuthToken() {
  return localStorage.getItem(AUTH_STORAGE_KEY_TOKEN);
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setAuth(token, user) {
  localStorage.setItem(AUTH_STORAGE_KEY_TOKEN, token);
  localStorage.setItem(AUTH_STORAGE_KEY_USER, JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY_TOKEN);
  localStorage.removeItem(AUTH_STORAGE_KEY_USER);
}

function isLoggedIn() {
  return !!getAuthToken() && !!getCurrentUser();
}

function hasRole(...roles) {
  const user = getCurrentUser();
  if (!user || !user.role) return false;
  return roles.includes(user.role);
}

function logout() {
  clearAuth();
  window.location.href = 'index.html';
}

/**
 * Enhanced fetch wrapper that attaches Authorization header if token exists
 */
async function fetchWithAuth(url, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers
  });
}

/**
 * Dynamically renders navigation items based on user login state and role
 */
function setupNavAuth() {
  const navLinksContainer = document.querySelector('.nav-links');
  if (!navLinksContainer) return;

  const user = getCurrentUser();
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';

  if (!user) {
    // Guest Navigation
    navLinksContainer.innerHTML = `
      <a href="index.html" class="nav-link ${currentPage === 'index.html' ? 'active' : ''}">Browse Jobs</a>
      <a href="login.html" class="btn btn-outline btn-sm">Log In</a>
      <a href="signup.html" class="btn btn-primary btn-sm">Sign Up</a>
    `;
    return;
  }

  // Role Badges & Labels
  const roleDisplayNames = {
    user: 'Candidate',
    recruiter: 'Recruiter',
    admin: 'Admin'
  };

  const roleColors = {
    user: 'background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe;',
    recruiter: 'background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;',
    admin: 'background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;'
  };

  const roleBadge = `<span style="font-size: 0.72rem; font-weight: 700; padding: 0.2rem 0.55rem; border-radius: 9999px; text-transform: uppercase; ${roleColors[user.role] || ''}">${roleDisplayNames[user.role] || user.role}</span>`;

  let linksHtml = `<a href="index.html" class="nav-link ${currentPage === 'index.html' ? 'active' : ''}">Browse Jobs</a>`;

  if (user.role === 'recruiter' || user.role === 'admin') {
    linksHtml += `
      <a href="dashboard.html" class="nav-link ${currentPage === 'dashboard.html' ? 'active' : ''}">${user.role === 'admin' ? 'Admin Hub' : 'Recruiter Pipeline'}</a>
      <a href="post-job.html" class="btn btn-primary btn-sm">+ Post a Job</a>
    `;
  } else {
    // Regular Job Seeker / Candidate
    linksHtml += `
      <a href="dashboard.html" class="nav-link ${currentPage === 'dashboard.html' ? 'active' : ''}">My Applications</a>
    `;
  }

  linksHtml += `
    <div class="user-nav-profile" style="display: flex; align-items: center; gap: 0.6rem; padding-left: 0.5rem; border-left: 1px solid var(--gray-200);">
      <div style="font-size: 0.88rem; font-weight: 600; color: var(--gray-800);">${escapeHtml(user.name)}</div>
      ${roleBadge}
      <button onclick="logout()" class="btn btn-outline btn-sm" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; margin-left: 0.3rem;">Logout</button>
    </div>
  `;

  navLinksContainer.innerHTML = linksHtml;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', setupNavAuth);

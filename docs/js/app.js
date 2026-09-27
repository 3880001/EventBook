import { Router } from './router.js';
import { renderDashboard } from './views/dashboard.js';
import { renderWizard } from './views/wizard.js';
import { renderPublishPage } from './views/publish.js';
import { renderBookingPage } from './views/booking.js';
import { renderAdminDashboard } from './views/admin.js';
import { renderAnalyticsPage } from './views/analytics.js';
import { renderFeedbackPage } from './views/feedback.js';
import { renderAuthPage } from './views/auth.js';
import { supabase } from './supabaseClient.js';

const appRoot = document.getElementById('app-root');

// Route Registry supporting both /create and /edit/:id
const routes = {
  '/auth': (root) => renderAuthPage(root),
  '/dashboard': (root) => renderDashboard(root),
  '/events': (root) => renderDashboard(root),
  '/create': (root, ctx) => renderWizard(root, ctx),
  '/edit/:id': (root, ctx) => renderWizard(root, ctx),
  '/publish/:id': (root, ctx) => renderPublishPage(root, ctx),
  '/book/:slug': (root, ctx) => renderBookingPage(root, ctx),
  '/analytics/:id': (root, ctx) => renderAnalyticsPage(root, ctx),
  '/feedback/:id': (root, ctx) => renderFeedbackPage(root, ctx),
  '/admin': (root) => renderAdminDashboard(root)
};

new Router(routes, appRoot);

// Auth state tracking & Top Nav Header Button
supabase.auth.onAuthStateChange((event, session) => {
  const authBtn = document.getElementById('btn-auth-action');
  const mainNav = document.getElementById('main-nav');

  if (session?.user) {
    if (authBtn) {
      authBtn.innerText = 'Sign Out';
      authBtn.onclick = async () => {
        await supabase.auth.signOut();
        window.location.hash = '#/auth';
      };
    }
    if (mainNav) mainNav.style.display = 'flex';
  } else {
    if (authBtn) {
      authBtn.innerText = 'Sign In';
      authBtn.onclick = () => {
        window.location.hash = '#/auth';
      };
    }
    if (mainNav) mainNav.style.display = 'none';
  }
});

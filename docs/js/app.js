import { Router } from './router.js?v=3';
import { renderDashboard } from './views/dashboard.js?v=3';
import { renderWizard } from './views/wizard.js?v=3';
import { renderPublishPage } from './views/publish.js?v=3';
import { renderBookingPage } from './views/booking.js?v=3';
import { renderAdminDashboard } from './views/admin.js?v=3';
import { renderAnalyticsPage } from './views/analytics.js?v=3';
import { renderFeedbackPage } from './views/feedback.js?v=3';
import { renderAuthPage } from './views/auth.js?v=3';
import { supabase } from './supabaseClient.js?v=3';

const appRoot = document.getElementById('app-root');

// Route Registry supporting both standard and parameterized hash routes
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

// Initialize Hash Router
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

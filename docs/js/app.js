import { Router } from './router.js?v=6';
import { renderDashboard } from './views/dashboard.js?v=6';
import { renderWizard } from './views/wizard.js?v=6';
import { renderPublishPage } from './views/publish.js?v=6';
import { renderBookingPage } from './views/booking.js?v=6';
import { renderTicketPage } from './views/ticket.js?v=6';
import { renderAdminDashboard } from './views/admin.js?v=6';
import { renderAnalyticsPage } from './views/analytics.js?v=6';
import { renderFeedbackPage } from './views/feedback.js?v=6';
import { renderAuthPage } from './views/auth.js?v=6';
import { supabase } from './supabaseClient.js?v=6';

const appRoot = document.getElementById('app-root');

// Route Registry supporting participant ticket URLs
const routes = {
  '/auth': (root) => renderAuthPage(root),
  '/dashboard': (root) => renderDashboard(root),
  '/events': (root) => renderDashboard(root),
  '/create': (root, ctx) => renderWizard(root, ctx),
  '/edit/:id': (root, ctx) => renderWizard(root, ctx),
  '/publish/:id': (root, ctx) => renderPublishPage(root, ctx),
  '/book/:slug': (root, ctx) => renderBookingPage(root, ctx),
  '/ticket/:ref': (root, ctx) => renderTicketPage(root, ctx),
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

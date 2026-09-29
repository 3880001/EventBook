import { Router } from './router.js?v=30';
import { renderDashboard, renderMyEvents } from './views/dashboard.js?v=30';
import { renderWizard } from './views/wizard.js?v=30';
import { renderPublishPage } from './views/publish.js?v=30';
import { renderBookingPage } from './views/booking.js?v=30';
import { renderTicketPage } from './views/ticket.js?v=30';
import { renderRsvpPage } from './views/rsvp.js?v=30';
import { renderAdminDashboard } from './views/admin.js?v=30';
import { renderAnalyticsPage } from './views/analytics.js?v=30';
import { renderFeedbackPage } from './views/feedback.js?v=30';
import { renderAuthPage } from './views/auth.js?v=30';
import { supabase } from './supabaseClient.js?v=30';

// Route Registry
const routes = {
  '/auth': (root) => renderAuthPage(root),
  '/dashboard': (root) => renderDashboard(root),
  '/events': (root) => renderMyEvents(root),
  '/create': (root, ctx) => renderWizard(root, ctx),
  '/edit/:id': (root, ctx) => renderWizard(root, ctx),
  '/publish/:id': (root, ctx) => renderPublishPage(root, ctx),
  '/book/:slug': (root, ctx) => renderBookingPage(root, ctx),
  '/ticket/:ref': (root, ctx) => renderTicketPage(root, ctx),
  '/rsvp/:ref/:action': (root, ctx) => renderRsvpPage(root, ctx),
  '/analytics/:id': (root, ctx) => renderAnalyticsPage(root, ctx),
  '/feedback/:id': (root, ctx) => renderFeedbackPage(root, ctx),
  '/admin': (root) => renderAdminDashboard(root)
};

// Initialize Router directly without intermediate variable declaration
new Router(routes, document.getElementById('app-root'));

// Track authentication state
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

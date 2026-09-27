import { Router } from './router.js';
import { renderDashboard } from './views/dashboard.js';
import { renderWizard } from './views/wizard.js';
import { renderPublishPage } from './views/publish.js';
import { renderBookingPage } from './views/booking.js';
import { renderAdminDashboard } from './views/admin.js';
import { renderAnalyticsPage } from './views/analytics.js';
import { renderFeedbackPage } from './views/feedback.js';
import { supabase } from './supabaseClient.js';

const appRoot = document.getElementById('app-root');

// Route Registry
const routes = {
  '/dashboard': (root) => renderDashboard(root),
  '/events': (root) => renderDashboard(root),
  '/create': (root) => renderWizard(root),
  '/publish/:id': (root, ctx) => renderPublishPage(root, ctx),
  '/book/:slug': (root, ctx) => renderBookingPage(root, ctx),
  '/analytics/:id': (root, ctx) => renderAnalyticsPage(root, ctx),
  '/feedback/:id': (root, ctx) => renderFeedbackPage(root, ctx),
  '/admin': (root) => renderAdminDashboard(root)
};

new Router(routes, appRoot);

// Auth state tracking
supabase.auth.onAuthStateChange((event, session) => {
  const authBtn = document.getElementById('btn-auth-action');
  if (session?.user) {
    authBtn.innerText = 'Sign Out';
    authBtn.onclick = () => supabase.auth.signOut();
  } else {
    authBtn.innerText = 'Sign In';
    authBtn.onclick = () => {
      const email = prompt('Enter your organizer email:');
      if (email) supabase.auth.signInWithOtp({ email });
    };
  }
});

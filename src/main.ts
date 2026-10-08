// @ts-nocheck
import { initTelemetry, logError } from './utils/telemetry';
import { Router } from './router';
import { renderDashboard, renderMyEvents } from './views/dashboard';
import { renderWizard } from './views/wizard';
import { renderPublishPage } from './views/publish';
import { renderBookingPage } from './views/booking';
import { renderTicketPage } from './views/ticket';
import { renderRsvpPage } from './views/rsvp';
import { renderAdminDashboard } from './views/admin';
import { renderFeedbackPage } from './views/feedback';
import { renderAuthPage } from './views/auth';
import { supabase } from './supabaseClient';

// Import CSS stylesheets if they exist
const cssModules = import.meta.glob('./css/*.css', { eager: true });

// 1. Initialize Telemetry & Error Tracking
initTelemetry();

// 2. Resolve App Container
function getAppContainer() {
  return (
    document.getElementById('view') ||
    document.getElementById('content') ||
    document.getElementById('app') ||
    document.body
  );
}

// 3. Define Application Routes
const routes = {
  '/': () => renderDashboard(getAppContainer()),
  '/dashboard': () => renderDashboard(getAppContainer()),
  '/events': () => renderMyEvents(getAppContainer()),
  '/create': (ctx) => renderWizard(getAppContainer(), ctx || {}),
  '/edit/:id': (ctx) => renderWizard(getAppContainer(), ctx || {}),
  '/publish/:id': (ctx) => renderPublishPage(getAppContainer(), ctx || {}),
  '/book/:slug': (ctx) => renderBookingPage(getAppContainer(), ctx || {}),
  '/ticket/:ref': (ctx) => renderTicketPage(getAppContainer(), ctx || {}),
  '/rsvp/:ref/:action': (ctx) => renderRsvpPage(getAppContainer(), ctx || {}),
  '/rsvp/:ref': (ctx) => renderRsvpPage(getAppContainer(), ctx || {}),
  '/admin': (ctx) => renderAdminDashboard(getAppContainer(), ctx || {}),
  '/analytics': () => { window.location.hash = '#/admin?tab=analytics'; },
  '/feedback/:id': (ctx) => renderFeedbackPage(getAppContainer(), ctx || {}),
  '/auth': () => renderAuthPage(getAppContainer())
};

// 4. Start Router
try {
  new Router(routes);
} catch (err) {
  logError(err, { phase: 'router_initialization' });
}

// 5. Admin Navigation RBAC Guard
async function syncAdminNav() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const adminNav = document.getElementById('nav-admin');
    if (!adminNav) return;

    if (!session?.user) {
      adminNav.style.display = 'none';
      return;
    }

    const isSuperAdminEmail = session.user.email?.toLowerCase() === 'satpurush.baps@gmail.com';
    const { data: isAdmin } = await supabase.rpc('is_super_admin');

    adminNav.style.display = (isAdmin || isSuperAdminEmail) ? 'inline-flex' : 'none';
  } catch (err) {
    logError(err, { phase: 'sync_admin_nav' });
  }
}

window.addEventListener('hashchange', syncAdminNav);
document.addEventListener('DOMContentLoaded', syncAdminNav);

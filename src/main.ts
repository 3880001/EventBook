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

// 1. Initialize Telemetry & Error Tracking
initTelemetry();

// 2. Resolve App Container
function getAppContainer(): HTMLElement {
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
  '/create': (ctx: any) => renderWizard(getAppContainer(), ctx || {}),
  '/edit/:id': (ctx: any) => renderWizard(getAppContainer(), ctx || {}),
  '/publish/:id': (ctx: any) => renderPublishPage(getAppContainer(), ctx || {}),
  '/book/:slug': (ctx: any) => renderBookingPage(getAppContainer(), ctx || {}),
  '/ticket/:ref': (ctx: any) => renderTicketPage(getAppContainer(), ctx || {}),
  '/rsvp/:ref/:action': (ctx: any) => renderRsvpPage(getAppContainer(), ctx || {}),
  '/rsvp/:ref': (ctx: any) => renderRsvpPage(getAppContainer(), ctx || {}),
  '/admin': (ctx: any) => renderAdminDashboard(getAppContainer(), ctx || {}),
  '/analytics': () => { window.location.hash = '#/admin?tab=analytics'; },
  '/feedback/:id': (ctx: any) => renderFeedbackPage(getAppContainer(), ctx || {}),
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

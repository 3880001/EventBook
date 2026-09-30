import { Router } from './router.js?v=40';
import { renderDashboard, renderMyEvents } from './views/dashboard.js?v=40';
import { renderWizard } from './views/wizard.js?v=40';
import { renderPublishPage } from './views/publish.js?v=40';
import { renderBookingPage } from './views/booking.js?v=40';
import { renderTicketPage } from './views/ticket.js?v=40';
import { renderRsvpPage } from './views/rsvp.js?v=40';
import { renderAdminDashboard } from './views/admin.js?v=40';
import { renderFeedbackPage } from './views/feedback.js?v=40';
import { renderAuthPage } from './views/auth.js?v=40';
import { supabase } from './supabaseClient.js?v=40';

function getAppContainer() {
  return document.getElementById('view') 
      || document.getElementById('content') 
      || document.getElementById('app') 
      || document.querySelector('main') 
      || document.body;
}

const routes = {
  '/': (context) => renderDashboard(getAppContainer(), context || {}),
  '/dashboard': (context) => renderDashboard(getAppContainer(), context || {}),
  '/events': (context) => renderMyEvents(getAppContainer(), context || {}),
  '/create': (context) => renderWizard(getAppContainer(), context || {}),
  '/edit/:id': (context) => renderWizard(getAppContainer(), context || {}),
  '/publish/:id': (context) => renderPublishPage(getAppContainer(), context || {}),
  '/book/:slug': (context) => renderBookingPage(getAppContainer(), context || {}),
  '/ticket/:ref': (context) => renderTicketPage(getAppContainer(), context || {}),
  '/rsvp/:ref/:action': (context) => renderRsvpPage(getAppContainer(), context || {}),
  '/rsvp/:ref': (context) => renderRsvpPage(getAppContainer(), context || {}),
  '/admin': (context) => renderAdminDashboard(getAppContainer(), context || {}),
  '/analytics': () => { window.location.hash = '#/admin?tab=analytics'; },
  '/feedback/:id': (context) => renderFeedbackPage(getAppContainer(), context || {}),
  '/auth': (context) => renderAuthPage(getAppContainer(), context || {})
};

const router = new Router(routes);

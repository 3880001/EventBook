import { Router } from './router.js?v=38';
import { renderDashboard, renderMyEvents } from './views/dashboard.js?v=38';
import { renderWizard } from './views/wizard.js?v=38';
import { renderPublishPage } from './views/publish.js?v=38';
import { renderBookingPage } from './views/booking.js?v=38';
import { renderTicketPage } from './views/ticket.js?v=38';
import { renderRsvpPage } from './views/rsvp.js?v=38';
import { renderAdminDashboard } from './views/admin.js?v=38';
import { renderFeedbackPage } from './views/feedback.js?v=38';
import { renderAuthPage } from './views/auth.js?v=38';
import { supabase } from './supabaseClient.js?v=38';

// Universal container resolver (never null)
function getAppContainer() {
  return document.getElementById('view') 
      || document.getElementById('content') 
      || document.getElementById('app') 
      || document.querySelector('main') 
      || document.body;
}

const router = new Router();

// Routes definition
router.add('/', () => {
  const container = getAppContainer();
  renderDashboard(container);
});

router.add('/dashboard', () => {
  const container = getAppContainer();
  renderDashboard(container);
});

router.add('/events', () => {
  const container = getAppContainer();
  renderMyEvents(container);
});

router.add('/create', (context) => {
  const container = getAppContainer();
  renderWizard(container, context || {});
});

router.add('/edit/:id', (context) => {
  const container = getAppContainer();
  renderWizard(container, context || {});
});

router.add('/publish/:id', (context) => {
  const container = getAppContainer();
  renderPublishPage(container, context || {});
});

router.add('/book/:slug', (context) => {
  const container = getAppContainer();
  renderBookingPage(container, context || {});
});

router.add('/ticket/:ref', (context) => {
  const container = getAppContainer();
  renderTicketPage(container, context || {});
});

router.add('/rsvp/:ref/:action', (context) => {
  const container = getAppContainer();
  renderRsvpPage(container, context || {});
});

router.add('/rsvp/:ref', (context) => {
  const container = getAppContainer();
  renderRsvpPage(container, context || {});
});

// Admin Console
router.add('/admin', (context) => {
  const container = getAppContainer();
  renderAdminDashboard(container, context || {});
});

// Analytics route is protected and opens the Admin Analytics tab directly
router.add('/analytics', () => {
  window.location.hash = '#/admin?tab=analytics';
});

router.add('/feedback/:id', (context) => {
  const container = getAppContainer();
  renderFeedbackPage(container, context || {});
});

router.add('/auth', () => {
  const container = getAppContainer();
  renderAuthPage(container);
});

// Initial boot
document.addEventListener('DOMContentLoaded', () => {
  router.init();
});

// Fallback boot if DOM is already ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  router.init();
}

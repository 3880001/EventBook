import { supabase } from '../supabaseClient.js';
import { toast } from '../utils/ui.js';
import { formatEventTime, formatEventDate } from '../utils/eventEngine.js';

export async function renderAdminDashboard(container) {
  container.innerHTML = '<div class="loader-center"><div class="spinner"></div></div>';

  const { data: { session } } = await supabase.auth.getSession();
  const currentUser = session?.user;

  // Fetch complete enterprise metrics from PostgreSQL
  const { data: metrics, error } = await supabase.rpc('get_super_admin_metrics');

  if (error || !metrics || !metrics.success) {
    container.innerHTML = '<div class="card" style="max-width:600px; margin:3rem auto; text-align:center; padding:2rem;">'
      + '<h2 style="color:var(--danger);">Admin Access Error</h2>'
      + '<p style="color:var(--text-muted); margin-top:0.5rem;">' + (error?.message || 'Could not retrieve enterprise platform metrics.') + '</p>'
      + '<a href="#/dashboard" class="btn btn-secondary btn-sm" style="margin-top:1rem;">Back to Dashboard</a>'
      + '</div>';
    return;
  }

  const ov = metrics.overview || {};
  const users = metrics.users || [];
  const events = metrics.events || [];
  const tickets = metrics.tickets || [];
  const cronRuns = metrics.cron_runs || [];
  const emailStats = metrics.email_stats || {};
  const dbStats = metrics.db_stats || {};

  let activeTab = 'overview'; // 'overview' | 'users' | 'events' | 'tickets' | 'ops'
  let ticketFilter = 'all';

  function renderView() {
    // -------------------------------------------------------------
    // TAB 1: OVERVIEW & CAPACITY PLANNING
    // -------------------------------------------------------------
    let tabContent = '';

    if (activeTab === 'overview') {
      tabContent = '<div style="margin-top:1.5rem;">'
        // KPI Grid
        + '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; margin-bottom:1.5rem;">'
        + buildKpiCard('Total Signups', ov.total_users, 'Registered account organizers', '#3b82f6')
        + buildKpiCard('Total Events', ov.total_events, ov.published_events + ' active / published', '#10b981')
        + buildKpiCard('Total Bookings', ov.total_bookings, ov.cancelled_bookings + ' cancellations', '#8b5cf6')
        + buildKpiCard('Attended Sessions', ov.attended_bookings, ov.attendance_rate_pct + '% completion rate', '#f59e0b')
        + '</div>'

        // Capacity & Platform Health Cards
        + '<div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; margin-bottom:1.5rem;">'
        + '<div class="card" style="margin:0;">'
        + '<h3 style="font-size:1.05rem; font-weight:700; margin-bottom:0.75rem;">💾 Database Capacity & Sizing</h3>'
        + '<div style="display:flex; justify-content:space-between; padding:0.5rem 0; border-bottom:1px solid var(--border-color);">'
        + '<span style="color:var(--text-muted);">Database Size</span><strong>' + (dbStats.database_size_pretty || 'N/A') + '</strong>'
        + '</div>'
        + '<div style="display:flex; justify-content:space-between; padding:0.5rem 0; border-bottom:1px solid var(--border-color);">'
        + '<span style="color:var(--text-muted);">Events Rows</span><strong>' + (dbStats.events_table_rows || 0) + '</strong>'
        + '</div>'
        + '<div style="display:flex; justify-content:space-between; padding:0.5rem 0; border-bottom:1px solid var(--border-color);">'
        + '<span style="color:var(--text-muted);">Bookings Rows</span><strong>' + (dbStats.bookings_table_rows || 0) + '</strong>'
        + '</div>'
        + '<div style="display:flex; justify-content:space-between; padding:0.5rem 0;">'
        + '<span style="color:var(--text-muted);">Generated Timeslots</span><strong>' + (dbStats.timeslots_table_rows || 0) + '</strong>'
        + '</div>'
        + '</div>'

        + '<div class="card" style="margin:0;">'
        + '<h3 style="font-size:1.05rem; font-weight:700; margin-bottom:0.75rem;">✉️ Brevo Transactional Email Engine</h3>'
        + '<div style="display:flex; justify-content:space-between; padding:0.5rem 0; border-bottom:1px solid var(--border-color);">'
        + '<span style="color:var(--text-muted);">Total Emails Dispatched</span><strong>' + (emailStats.total_logged || 0) + '</strong>'
        + '</div>'
        + '<div style="display:flex; justify-content:space-between; padding:0.5rem 0; border-bottom:1px solid var(--border-color);">'
        + '<span style="color:var(--text-muted);">Delivery Status</span><span class="badge badge-success">' + (emailStats.sent_count || 0) + ' Delivered</span>'
        + '</div>'
        + '<div style="display:flex; justify-content:space-between; padding:0.5rem 0;">'
        + '<span style="color:var(--text-muted);">Failed Deliveries</span><span class="badge ' + (emailStats.failed_count > 0 ? 'badge-danger' : 'badge-neutral') + '">' + (emailStats.failed_count || 0) + '</span>'
        + '</div>'
        + '</div>'
        + '</div>'
        + '</div>';

    // -------------------------------------------------------------
    // TAB 2: ORGANIZER & USER DIRECTORY
    // -------------------------------------------------------------
    } else if (activeTab === 'users') {
      let usersRows = '';
      users.forEach(u => {
        const joinedDate = new Date(u.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        const lastLogin = u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never';

        usersRows += '<tr style="border-bottom:1px solid var(--border-color);">'
          + '<td style="padding:0.75rem 0.5rem; font-weight:600; color:var(--text-primary);">' + u.email + '</td>'
          + '<td style="padding:0.75rem 0.5rem; font-size:0.85rem; color:var(--text-muted);">' + joinedDate + '</td>'
          + '<td style="padding:0.75rem 0.5rem; font-size:0.85rem; color:var(--text-muted);">' + lastLogin + '</td>'
          + '<td style="padding:0.75rem 0.5rem; font-weight:700; text-align:center;">' + u.total_events_created + '</td>'
          + '<td style="padding:0.75rem 0.5rem; font-weight:700; text-align:center; color:var(--primary);">' + u.total_attendees_received + '</td>'
          + '</tr>';
      });

      tabContent = '<div class="card" style="margin-top:1.5rem;">'
        + '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">'
        + '<div><h3 style="font-size:1.15rem; font-weight:700; margin:0;">Organizer User Directory (' + users.length + ')</h3>'
        + '<p style="color:var(--text-muted); font-size:0.85rem; margin-top:2px;">All registered administrators and event hosts across the organization.</p></div>'
        + '</div>'
        + '<div class="table-responsive">'
        + '<table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.9rem;">'
        + '<thead><tr style="border-bottom:2px solid var(--border-color); color:var(--text-muted); font-size:0.8rem; text-transform:uppercase;">'
        + '<th style="padding:0.6rem 0.5rem;">ORGANIZER EMAIL</th>'
        + '<th style="padding:0.6rem 0.5rem;">JOINED</th>'
        + '<th style="padding:0.6rem 0.5rem;">LAST SIGN-IN</th>'
        + '<th style="padding:0.6rem 0.5rem; text-align:center;">EVENTS</th>'
        + '<th style="padding:0.6rem 0.5rem; text-align:center;">ATTENDEES</th>'
        + '</tr></thead>'
        + '<tbody>' + usersRows + '</tbody>'
        + '</table>'
        + '</div>'
        + '</div>';

    // -------------------------------------------------------------
    // TAB 3: MASTER EVENT EXPLORER
    // -------------------------------------------------------------
    } else if (activeTab === 'events') {
      let eventsRows = '';
      events.forEach(e => {
        const createdStr = new Date(e.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        eventsRows += '<tr style="border-bottom:1px solid var(--border-color);">'
          + '<td style="padding:0.75rem 0.5rem;">'
          + '<a href="#/publish/' + e.id + '" style="font-weight:700; color:var(--primary); text-decoration:none;">' + e.name + ' ↗</a>'
          + '<div style="font-size:0.75rem; color:var(--text-muted); font-family:monospace;">/' + e.slug + '</div>'
          + '</td>'
          + '<td style="padding:0.75rem 0.5rem; font-size:0.85rem;">' + e.organizer_email + '</td>'
          + '<td style="padding:0.75rem 0.5rem; font-size:0.85rem; font-weight:600;">' + (e.timezone || 'UTC') + '</td>'
          + '<td style="padding:0.75rem 0.5rem; text-align:center;"><span class="badge ' + (e.status === 'published' ? 'badge-success' : 'badge-neutral') + '">' + e.status + '</span></td>'
          + '<td style="padding:0.75rem 0.5rem; text-align:center; font-weight:700;">' + e.booking_count + '</td>'
          + '<td style="padding:0.75rem 0.5rem; font-size:0.85rem; color:var(--text-muted);">' + createdStr + '</td>'
          + '</tr>';
      });

      tabContent = '<div class="card" style="margin-top:1.5rem;">'
        + '<div style="margin-bottom:1rem;"><h3 style="font-size:1.15rem; font-weight:700; margin:0;">Enterprise Master Event Explorer (' + events.length + ')</h3>'
        + '<p style="color:var(--text-muted); font-size:0.85rem; margin-top:2px;">Inspect or troubleshoot any event created by any organizer.</p></div>'
        + '<div class="table-responsive">'
        + '<table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.9rem;">'
        + '<thead><tr style="border-bottom:2px solid var(--border-color); color:var(--text-muted); font-size:0.8rem; text-transform:uppercase;">'
        + '<th style="padding:0.6rem 0.5rem;">EVENT & SLUG</th>'
        + '<th style="padding:0.6rem 0.5rem;">ORGANIZER</th>'
        + '<th style="padding:0.6rem 0.5rem;">TIMEZONE</th>'
        + '<th style="padding:0.6rem 0.5rem; text-align:center;">STATUS</th>'
        + '<th style="padding:0.6rem 0.5rem; text-align:center;">BOOKINGS</th>'
        + '<th style="padding:0.6rem 0.5rem;">CREATED</th>'
        + '</tr></thead>'
        + '<tbody>' + eventsRows + '</tbody>'
        + '</table>'
        + '</div>'
        + '</div>';

    // -------------------------------------------------------------
    // TAB 4: HELP DESK & ISSUE TICKETING
    // -------------------------------------------------------------
    } else if (activeTab === 'tickets') {
      const filteredTickets = tickets.filter(t => ticketFilter === 'all' ? true : t.status === ticketFilter);

      let ticketsRows = '';
      if (filteredTickets.length === 0) {
        ticketsRows = '<tr><td colspan="6" style="text-align:center; padding:2.5rem; color:var(--text-muted);">No support tickets found matching this filter.</td></tr>';
      } else {
        filteredTickets.forEach(t => {
          const dateStr = new Date(t.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
          const priorityBadge = t.priority === 'high' 
            ? '<span class="badge badge-danger">HIGH</span>' 
            : (t.priority === 'medium' ? '<span class="badge badge-warning">MED</span>' : '<span class="badge badge-neutral">LOW</span>');

          ticketsRows += '<tr style="border-bottom:1px solid var(--border-color);">'
            + '<td style="padding:0.75rem 0.5rem; font-family:monospace; font-weight:700; color:var(--primary);">' + t.ticket_reference + '</td>'
            + '<td style="padding:0.75rem 0.5rem;">'
            + '<div style="font-weight:700; color:var(--text-primary);">' + t.subject + '</div>'
            + '<div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">' + t.description + '</div>'
            + (t.event_name ? '<div style="font-size:0.75rem; color:#4f46e5; margin-top:3px;">Event: ' + t.event_name + '</div>' : '')
            + '</td>'
            + '<td style="padding:0.75rem 0.5rem; font-size:0.85rem;">' + t.user_email + '</td>'
            + '<td style="padding:0.75rem 0.5rem; text-align:center;">' + priorityBadge + '</td>'
            + '<td style="padding:0.75rem 0.5rem; font-size:0.85rem; color:var(--text-muted);">' + dateStr + '</td>'
            + '<td style="padding:0.75rem 0.5rem; text-align:right;">'
            + '<select class="form-control form-control-sm select-ticket-status" data-id="' + t.id + '" style="width:125px; font-weight:600; font-size:0.8rem;">'
            + '<option value="open"' + (t.status === 'open' ? ' selected' : '') + '>🔴 Open</option>'
            + '<option value="in_progress"' + (t.status === 'in_progress' ? ' selected' : '') + '>🟡 In Progress</option>'
            + '<option value="resolved"' + (t.status === 'resolved' ? ' selected' : '') + '>🟢 Resolved</option>'
            + '<option value="closed"' + (t.status === 'closed' ? ' selected' : '') + '>⚪ Closed</option>'
            + '</select>'
            + '</td>'
            + '</tr>';
        });
      }

      tabContent = '<div class="card" style="margin-top:1.5rem;">'
        + '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:1rem;">'
        + '<div><h3 style="font-size:1.15rem; font-weight:700; margin:0;">Platform Help Desk & Support Inquiries (' + tickets.length + ')</h3>'
        + '<p style="color:var(--text-muted); font-size:0.85rem; margin-top:2px;">Troubleshoot issues reported by organizers and participants.</p></div>'
        + '<div style="display:flex; gap:0.5rem; align-items:center;">'
        + '<button type="button" class="btn ' + (ticketFilter === 'all' ? 'btn-primary' : 'btn-secondary') + ' btn-sm btn-filter-ticket" data-filter="all">All</button>'
        + '<button type="button" class="btn ' + (ticketFilter === 'open' ? 'btn-primary' : 'btn-secondary') + ' btn-sm btn-filter-ticket" data-filter="open">🔴 Open</button>'
        + '<button type="button" class="btn ' + (ticketFilter === 'in_progress' ? 'btn-primary' : 'btn-secondary') + ' btn-sm btn-filter-ticket" data-filter="in_progress">🟡 In Progress</button>'
        + '<button type="button" class="btn ' + (ticketFilter === 'resolved' ? 'btn-primary' : 'btn-secondary') + ' btn-sm btn-filter-ticket" data-filter="resolved">🟢 Resolved</button>'
        + '<button type="button" id="btn-create-test-ticket" class="btn btn-secondary btn-sm" style="font-weight:600;">+ File Ticket</button>'
        + '</div>'
        + '</div>'
        + '<div class="table-responsive">'
        + '<table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.9rem;">'
        + '<thead><tr style="border-bottom:2px solid var(--border-color); color:var(--text-muted); font-size:0.8rem; text-transform:uppercase;">'
        + '<th style="padding:0.6rem 0.5rem;">TICKET #</th>'
        + '<th style="padding:0.6rem 0.5rem;">SUBJECT & DETAILS</th>'
        + '<th style="padding:0.6rem 0.5rem;">REPORTER</th>'
        + '<th style="padding:0.6rem 0.5rem; text-align:center;">PRIORITY</th>'
        + '<th style="padding:0.6rem 0.5rem;">FILED</th>'
        + '<th style="padding:0.6rem 0.5rem; text-align:right;">STATUS ACTION</th>'
        + '</tr></thead>'
        + '<tbody>' + ticketsRows + '</tbody>'
        + '</table>'
        + '</div>'
        + '</div>';

    // -------------------------------------------------------------
    // TAB 5: OPERATIONS, TUNING & SYSTEM HEALTH
    // -------------------------------------------------------------
    } else if (activeTab === 'ops') {
      let cronRows = '';
      if (cronRuns.length === 0) {
        cronRows = '<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No background cron runs recorded yet.</td></tr>';
      } else {
        cronRuns.forEach(r => {
          const runTime = new Date(r.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          cronRows += '<tr style="border-bottom:1px solid var(--border-color); font-size:0.85rem;">'
            + '<td style="padding:0.6rem 0.5rem; font-family:monospace;">#' + r.runid + '</td>'
            + '<td style="padding:0.6rem 0.5rem;"><span class="badge ' + (r.status === 'succeeded' ? 'badge-success' : 'badge-danger') + '">' + r.status + '</span></td>'
            + '<td style="padding:0.6rem 0.5rem; color:var(--text-muted);">' + (r.return_message || 'Completed') + '</td>'
            + '<td style="padding:0.6rem 0.5rem; color:var(--text-muted);">' + runTime + '</td>'
            + '</tr>';
        });
      }

      tabContent = '<div style="margin-top:1.5rem;">'
        + '<div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; margin-bottom:1.5rem;">'
        // System Release & Upgrade Status
        + '<div class="card" style="margin:0;">'
        + '<h3 style="font-size:1.05rem; font-weight:700; margin-bottom:0.75rem;">🚀 Release & Version Control</h3>'
        + '<div style="display:flex; justify-content:space-between; padding:0.5rem 0; border-bottom:1px solid var(--border-color);">'
        + '<span style="color:var(--text-muted);">Platform Version</span><strong>v1.3.4 (Production)</strong>'
        + '</div>'
        + '<div style="display:flex; justify-content:space-between; padding:0.5rem 0; border-bottom:1px solid var(--border-color);">'
        + '<span style="color:var(--text-muted);">Cache Tag</span><span style="font-family:monospace; font-weight:700;">?v=34</span>'
        + '</div>'
        + '<div style="display:flex; justify-content:space-between; padding:0.5rem 0; border-bottom:1px solid var(--border-color);">'
        + '<span style="color:var(--text-muted);">CI/CD Pipeline</span><span class="badge badge-success">GitHub Actions Active</span>'
        + '</div>'
        + '<div style="display:flex; justify-content:space-between; padding:0.5rem 0;">'
        + '<span style="color:var(--text-muted);">Database Engine</span><strong>PostgreSQL 15.8 (Supabase)</strong>'
        + '</div>'
        + '</div>'

        // Maintenance & Tuning Actions
        + '<div class="card" style="margin:0;">'
        + '<h3 style="font-size:1.05rem; font-weight:700; margin-bottom:0.75rem;">⚡ Performance & System Tuning</h3>'
        + '<p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:1rem;">Execute hot maintenance commands across the production cluster.</p>'
        + '<div style="display:flex; flex-direction:column; gap:0.75rem;">'
        + '<button type="button" id="btn-admin-reload-schema" class="btn btn-secondary" style="font-weight:600; text-align:left; justify-content:space-between;">'
        + '<span>🔄 Reload REST Schema Cache</span><span style="font-size:0.75rem; color:var(--text-muted);">NOTIFY pgrst</span>'
        + '</button>'
        + '<button type="button" id="btn-admin-clean-slots" class="btn btn-secondary" style="font-weight:600; text-align:left; justify-content:space-between;">'
        + '<span>🧹 Purge Expired Unbooked Slots</span><span style="font-size:0.75rem; color:var(--text-muted);">Optimizes table index</span>'
        + '</button>'
        + '</div>'
        + '</div>'
        + '</div>'

        // Cron Background Scheduler Health
        + '<div class="card">'
        + '<h3 style="font-size:1.05rem; font-weight:700; margin-bottom:0.25rem;">⏱️ Background Cron Job Runs (`eventbook-reminder-job`)</h3>'
        + '<p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:1rem;">Evaluates scheduled reminders and interactive 1-click RSVP dispatches every 5 minutes.</p>'
        + '<div class="table-responsive">'
        + '<table style="width:100%; border-collapse:collapse; text-align:left;">'
        + '<thead><tr style="border-bottom:2px solid var(--border-color); color:var(--text-muted); font-size:0.75rem; text-transform:uppercase;">'
        + '<th style="padding:0.5rem;">RUN ID</th><th style="padding:0.5rem;">STATUS</th><th style="padding:0.5rem;">OUTPUT</th><th style="padding:0.5rem;">TIMESTAMP</th>'
        + '</tr></thead>'
        + '<tbody>' + cronRows + '</tbody>'
        + '</table>'
        + '</div>'
        + '</div>'
        + '</div>';
    }

    // Modal for filing an issue / ticket
    const fileTicketModalHtml = '<div id="ticket-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center; padding:1rem;">'
      + '<div class="card" style="max-width:500px; width:100%; padding:2rem; border-radius:14px; background:#fff;">'
      + '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">'
      + '<h3 style="margin:0; font-size:1.2rem; font-weight:700;">🎫 File Support or Issue Ticket</h3>'
      + '<button type="button" id="btn-close-ticket-modal" style="background:none; border:none; font-size:1.25rem; cursor:pointer;">✕</button>'
      + '</div>'
      + '<form id="form-file-ticket">'
      + '<div class="form-group">'
      + '<label class="form-label">Your Email *</label>'
      + '<input type="email" id="t-email" class="form-control" value="' + (currentUser?.email || '') + '" required />'
      + '</div>'
      + '<div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">'
      + '<div class="form-group">'
      + '<label class="form-label">Category</label>'
      + '<select id="t-cat" class="form-control"><option value="technical_issue">Technical Issue</option><option value="booking_error">Booking Error</option><option value="feature_request">Feature Request</option></select>'
      + '</div>'
      + '<div class="form-group">'
      + '<label class="form-label">Priority</label>'
      + '<select id="t-priority" class="form-control"><option value="medium">Medium</option><option value="high">High</option><option value="low">Low</option></select>'
      + '</div>'
      + '</div>'
      + '<div class="form-group">'
      + '<label class="form-label">Subject / Issue Summary *</label>'
      + '<input type="text" id="t-subject" class="form-control" placeholder="Brief issue title" required />'
      + '</div>'
      + '<div class="form-group">'
      + '<label class="form-label">Description / Steps to Reproduce *</label>'
      + '<textarea id="t-desc" class="form-control" rows="3" placeholder="Provide details..." required></textarea>'
      + '</div>'
      + '<div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">'
      + '<button type="submit" id="btn-submit-ticket" class="btn btn-primary btn-sm">Submit Ticket</button>'
      + '</div>'
      + '</form>'
      + '</div>'
      + '</div>';

    container.innerHTML = '<div style="max-width:1150px; margin:0 auto; padding-bottom:4rem;">'
      // Header
      + '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; margin-bottom:1.5rem;">'
      + '<div>'
      + '<div style="font-size:0.75rem; font-weight:800; color:var(--primary); text-transform:uppercase; letter-spacing:1px;">Global Enterprise Administration</div>'
      + '<h1 style="font-size:1.85rem; font-weight:800; margin:0.25rem 0 0 0;">Platform Admin Console</h1>'
      + '<p style="color:var(--text-muted); font-size:0.9rem; margin-top:4px;">Logged in as: <strong>' + (currentUser?.email || 'Super Admin') + '</strong></p>'
      + '</div>'
      + '<div style="display:flex; gap:0.5rem;">'
      + '<button type="button" id="btn-refresh-admin" class="btn btn-secondary btn-sm">🔄 Refresh Data</button>'
      + '<a href="#/events" class="btn btn-primary btn-sm">&larr; My Events</a>'
      + '</div>'
      + '</div>'

      // Navigation Tabs
      + '<div style="display:flex; border-bottom:2px solid var(--border-color); gap:0.5rem; flex-wrap:wrap;">'
      + buildTabButton('overview', '📊 Platform Overview', activeTab)
      + buildTabButton('users', '👥 Organizers (' + users.length + ')', activeTab)
      + buildTabButton('events', '📅 Master Events (' + events.length + ')', activeTab)
      + buildTabButton('tickets', '🎫 Help Desk (' + tickets.length + ')', activeTab)
      + buildTabButton('ops', '🛠️ Operations & Tuning', activeTab)
      + '</div>'

      + tabContent
      + fileTicketModalHtml
      + '</div>';

    bindEvents();
  }

  function buildKpiCard(title, value, subtext, color) {
    return '<div class="card" style="margin:0; border-top:4px solid ' + color + '; padding:1.25rem;">'
      + '<div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">' + title + '</div>'
      + '<div style="font-size:2rem; font-weight:800; color:var(--text-primary); margin:0.35rem 0;">' + value + '</div>'
      + '<div style="font-size:0.8rem; color:var(--text-muted);">' + subtext + '</div>'
      + '</div>';
  }

  function buildTabButton(tabKey, label, currentActive) {
    const isActive = tabKey === currentActive;
    return '<button type="button" class="btn btn-tab" data-tab="' + tabKey + '" style="background:none; border:none; padding:0.75rem 1.25rem; font-size:0.9rem; font-weight:' + (isActive ? '700' : '600') + '; color:' + (isActive ? 'var(--primary)' : 'var(--text-muted)') + '; border-bottom:3px solid ' + (isActive ? 'var(--primary)' : 'transparent') + '; cursor:pointer; margin-bottom:-2px;">'
      + label
      + '</button>';
  }

  function bindEvents() {
    // Tab switching
    document.querySelectorAll('.btn-tab').forEach(btn => {
      btn.onclick = () => {
        activeTab = btn.dataset.tab;
        renderView();
      };
    });

    // Refresh
    const refreshBtn = document.getElementById('btn-refresh-admin');
    if (refreshBtn) {
      refreshBtn.onclick = () => renderAdminDashboard(container);
    }

    // Filter tickets
    document.querySelectorAll('.btn-filter-ticket').forEach(btn => {
      btn.onclick = () => {
        ticketFilter = btn.dataset.filter;
        renderView();
      };
    });

    // Update ticket status
    document.querySelectorAll('.select-ticket-status').forEach(sel => {
      sel.onchange = async () => {
        const ticketId = sel.dataset.id;
        const newStatus = sel.value;
        sel.disabled = true;

        const { error: updErr } = await supabase
          .from('support_tickets')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', ticketId);

        if (updErr) {
          toast('Failed to update ticket: ' + updErr.message, 'danger');
          sel.disabled = false;
        } else {
          toast('Ticket status updated to ' + newStatus, 'success');
          const t = tickets.find(x => x.id === ticketId);
          if (t) t.status = newStatus;
          renderView();
        }
      };
    });

    // File ticket modal
    const openTicketBtn = document.getElementById('btn-create-test-ticket');
    const ticketModal = document.getElementById('ticket-modal');
    const closeTicketBtn = document.getElementById('btn-close-ticket-modal');

    if (openTicketBtn && ticketModal) {
      openTicketBtn.onclick = () => { ticketModal.style.display = 'flex'; };
    }
    if (closeTicketBtn && ticketModal) {
      closeTicketBtn.onclick = () => { ticketModal.style.display = 'none'; };
    }

    // Submit ticket
    const ticketForm = document.getElementById('form-file-ticket');
    if (ticketForm) {
      ticketForm.onsubmit = async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('btn-submit-ticket');
        submitBtn.disabled = true;

        const userEmail = document.getElementById('t-email').value.trim();
        const category = document.getElementById('t-cat').value;
        const priority = document.getElementById('t-priority').value;
        const subject = document.getElementById('t-subject').value.trim();
        const description = document.getElementById('t-desc').value.trim();
        const ref = 'TICK-' + Math.random().toString(36).substring(2, 8).toUpperCase();

        const { error: insErr } = await supabase
          .from('support_tickets')
          .insert({
            ticket_reference: ref,
            user_id: currentUser?.id || null,
            user_email: userEmail,
            category,
            priority,
            subject,
            description,
            status: 'open'
          });

        if (insErr) {
          toast('Failed to file ticket: ' + insErr.message, 'danger');
          submitBtn.disabled = false;
        } else {
          toast('Support ticket ' + ref + ' submitted successfully!', 'success');
          renderAdminDashboard(container);
        }
      };
    }

    // Maintenance Actions
    const reloadSchemaBtn = document.getElementById('btn-admin-reload-schema');
    if (reloadSchemaBtn) {
      reloadSchemaBtn.onclick = async () => {
        reloadSchemaBtn.disabled = true;
        const { data, error: rpcErr } = await supabase.rpc('admin_run_maintenance', { p_action: 'reload_schema' });
        reloadSchemaBtn.disabled = false;
        if (rpcErr) toast('Error: ' + rpcErr.message, 'danger');
        else toast('✓ PostgREST API schema reloaded!', 'success');
      };
    }

    const cleanSlotsBtn = document.getElementById('btn-admin-clean-slots');
    if (cleanSlotsBtn) {
      cleanSlotsBtn.onclick = async () => {
        if (!confirm('Purge unbooked timeslots older than 24 hours?')) return;
        cleanSlotsBtn.disabled = true;
        const { data, error: rpcErr } = await supabase.rpc('admin_run_maintenance', { p_action: 'clean_unassigned_slots' });
        cleanSlotsBtn.disabled = false;
        if (rpcErr) toast('Error: ' + rpcErr.message, 'danger');
        else {
          toast('✓ Expired unbooked slots purged!', 'success');
          renderAdminDashboard(container);
        }
      };
    }
  }

  renderView();
}

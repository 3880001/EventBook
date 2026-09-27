import { supabase } from '../supabaseClient.js';

export async function renderDashboard(container) {
  const { data: { user } } = await supabase.auth.getUser();

  // Metrics query
  const { data: events, error } = await supabase
    .from('events')
    .select('id, name, status, created_at, timeslots(count), bookings(count)')
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = `<div class="card"><p>Failed to load dashboard: ${error.message}</p></div>`;
    return;
  }

  const totalEvents = events ? events.length : 0;
  const publishedCount = events ? events.filter(e => e.status === 'published').length : 0;

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
      <div>
        <h1 style="font-size:1.75rem; font-weight:700;">Organizer Dashboard</h1>
        <p style="color:var(--text-muted);">Manage events, examine participant engagement, and inspect templates.</p>
      </div>
      <a href="#/create" class="btn btn-primary">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        New Event
      </a>
    </div>

    <!-- Analytics Summary Cards -->
    <div class="grid-cards" style="margin-bottom: 2rem;">
      <div class="card" style="margin-bottom:0;">
        <span style="font-size:0.875rem; color:var(--text-muted); font-weight:600;">Total Events</span>
        <div style="font-size:2rem; font-weight:700; margin-top:0.25rem;">${totalEvents}</div>
      </div>
      <div class="card" style="margin-bottom:0;">
        <span style="font-size:0.875rem; color:var(--text-muted); font-weight:600;">Active Published</span>
        <div style="font-size:2rem; font-weight:700; color:var(--success); margin-top:0.25rem;">${publishedCount}</div>
      </div>
      <div class="card" style="margin-bottom:0;">
        <span style="font-size:0.875rem; color:var(--text-muted); font-weight:600;">System Health</span>
        <div style="font-size:1.2rem; font-weight:600; color:var(--primary); margin-top:0.6rem;">Operational (Supabase v2)</div>
      </div>
    </div>

    <!-- Events List Card -->
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
        <h2 style="font-size:1.25rem; font-weight:600;">Recent Events</h2>
        <div style="position:relative; width:100%; max-width:280px;">
          <input type="text" id="event-search" class="form-control" placeholder="Search events..." />
        </div>
      </div>

      <div class="table-responsive">
        <table style="width:100%; border-collapse:collapse; text-align:left;">
          <thead>
            <tr style="border-bottom:1px solid var(--border-color); color:var(--text-muted); font-size:0.85rem;">
              <th style="padding:0.75rem 0.5rem;">EVENT</th>
              <th style="padding:0.75rem 0.5rem;">STATUS</th>
              <th style="padding:0.75rem 0.5rem;">TYPE</th>
              <th style="padding:0.75rem 0.5rem;">ACTIONS</th>
            </tr>
          </thead>
          <tbody id="events-tbody">
            ${(events || []).map(evt => `
              <tr style="border-bottom:1px solid var(--border-color);">
                <td style="padding:0.85rem 0.5rem; font-weight:600;">
                  <a href="#/publish/${evt.id}" style="color:var(--text-main); text-decoration:none;">${evt.name}</a>
                </td>
                <td style="padding:0.85rem 0.5rem;">
                  <span class="badge ${evt.status === 'published' ? 'badge-success' : evt.status === 'completed' ? 'badge-neutral' : 'badge-warning'}">
                    ${evt.status}
                  </span>
                </td>
                <td style="padding:0.85rem 0.5rem; text-transform:capitalize; font-size:0.9rem;">
                  ${evt.event_type.replace('_', ' ')}
                </td>
                <td style="padding:0.85rem 0.5rem;">
                  <a href="#/publish/${evt.id}" class="btn btn-secondary btn-sm">Overview</a>
                  <a href="#/analytics/${evt.id}" class="btn btn-secondary btn-sm">Metrics</a>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Search filter implementation
  document.getElementById('event-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('#events-tbody tr').forEach(row => {
      const text = row.innerText.toLowerCase();
      row.style.display = text.includes(q) ? '' : 'none';
    });
  });
}

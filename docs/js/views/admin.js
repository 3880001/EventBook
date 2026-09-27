import { supabase } from '../supabaseClient.js';
import { toast } from '../utils/ui.js';

export async function renderAdminDashboard(container) {
  // Check authorization
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single();

  if (profile?.role !== 'super_admin') {
    container.innerHTML = `<div class="card" style="text-align:center;"><h2 style="color:var(--danger);">Unauthorized</h2><p>Super Admin privileges required to view this portal.</p></div>`;
    return;
  }

  // Fetch Global Overview Data
  const [{ count: userCount }, { count: eventCount }, { count: bookingCount }, { data: errorLogs }] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('events').select('*', { count: 'exact', head: true }),
    supabase.from('bookings').select('*', { count: 'exact', head: true }),
    supabase.from('notification_logs').select('*').eq('status', 'failed').limit(10)
  ]);

  container.innerHTML = `
    <div style="max-width:1100px; margin:0 auto;">
      <h1 style="font-size:1.75rem; font-weight:700; margin-bottom:1.5rem;">Global Administration Layer</h1>

      <div class="grid-cards" style="margin-bottom:2rem;">
        <div class="card" style="margin-bottom:0;">
          <span style="font-size:0.875rem; color:var(--text-muted); font-weight:600;">Registered Users</span>
          <div style="font-size:2rem; font-weight:700;">${userCount || 0}</div>
        </div>
        <div class="card" style="margin-bottom:0;">
          <span style="font-size:0.875rem; color:var(--text-muted); font-weight:600;">Total Events</span>
          <div style="font-size:2rem; font-weight:700; color:var(--primary);">${eventCount || 0}</div>
        </div>
        <div class="card" style="margin-bottom:0;">
          <span style="font-size:0.875rem; color:var(--text-muted); font-weight:600;">Platform Bookings</span>
          <div style="font-size:2rem; font-weight:700; color:var(--success);">${bookingCount || 0}</div>
        </div>
      </div>

      <!-- System Error Logs -->
      <div class="card">
        <h2 style="font-size:1.2rem; font-weight:600; margin-bottom:1rem;">Recent Dispatch & System Failures</h2>
        ${(errorLogs && errorLogs.length > 0) ? `
          <table style="width:100%; border-collapse:collapse; font-size:0.875rem;">
            <thead>
              <tr style="border-bottom:1px solid var(--border-color); text-align:left; color:var(--text-muted);">
                <th style="padding:0.5rem;">RECIPIENT</th>
                <th style="padding:0.5rem;">TYPE</th>
                <th style="padding:0.5rem;">ERROR</th>
              </tr>
            </thead>
            <tbody>
              ${errorLogs.map(err => `
                <tr style="border-bottom:1px solid var(--border-color);">
                  <td style="padding:0.5rem;">${err.recipient_email}</td>
                  <td style="padding:0.5rem;">${err.notification_type}</td>
                  <td style="padding:0.5rem; color:var(--danger);">${err.error_message || 'Timeout'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `<p style="color:var(--text-muted);">Zero systemic errors reported in current window.</p>`}
      </div>
    </div>
  `;
}

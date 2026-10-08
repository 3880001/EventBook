import { supabase } from '../supabaseClient.js';
import { toast } from '../utils/ui.js';

export async function renderAnalyticsPage(container, { param: eventId }) {
  const { data: event, error } = await supabase
    .from('events')
    .select(`
      *,
      bookings (
        id, booking_reference, status, attendance_confirmed, created_at,
        participant_profiles ( full_name, email, phone )
      )
    `)
    .eq('id', eventId)
    .single();

  if (error || !event) {
    container.innerHTML = `<div class="card"><p>Failed to load analytics.</p></div>`;
    return;
  }

  const bookings = event.bookings || [];
  const attendedCount = bookings.filter(b => b.attendance_confirmed).length;
  const noShowCount = bookings.filter(b => b.status === 'no_show').length;

  container.innerHTML = `
    <div style="max-width:1000px; margin:0 auto;">
      <a href="#/publish/${event.id}" style="color:var(--text-muted); text-decoration:none; font-size:0.875rem;">&larr; Back to Overview</a>
      <h1 style="font-size:1.75rem; font-weight:700; margin:0.5rem 0 1.5rem 0;">Analytics & Attendance Check-in</h1>

      <div class="grid-cards" style="margin-bottom:1.5rem;">
        <div class="card" style="margin-bottom:0;">
          <span style="font-size:0.875rem; color:var(--text-muted); font-weight:600;">Total Confirmed</span>
          <div style="font-size:2rem; font-weight:700;">${bookings.length}</div>
        </div>
        <div class="card" style="margin-bottom:0;">
          <span style="font-size:0.875rem; color:var(--text-muted); font-weight:600;">Attended Check-ins</span>
          <div style="font-size:2rem; font-weight:700; color:var(--success);">${attendedCount}</div>
        </div>
        <div class="card" style="margin-bottom:0;">
          <span style="font-size:0.875rem; color:var(--text-muted); font-weight:600;">Marked No-Shows</span>
          <div style="font-size:2rem; font-weight:700; color:var(--danger);">${noShowCount}</div>
        </div>
      </div>

      <div class="card">
        <h2 style="font-size:1.25rem; font-weight:600; margin-bottom:1rem;">Participant Attendance Roster</h2>
        <div class="table-responsive">
          <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
            <thead>
              <tr style="border-bottom:1px solid var(--border-color); text-align:left; color:var(--text-muted);">
                <th style="padding:0.75rem 0.5rem;">REF</th>
                <th style="padding:0.75rem 0.5rem;">NAME</th>
                <th style="padding:0.75rem 0.5rem;">EMAIL</th>
                <th style="padding:0.75rem 0.5rem;">STATUS</th>
                <th style="padding:0.75rem 0.5rem;">CHECK-IN ACTION</th>
              </tr>
            </thead>
            <tbody>
              ${bookings.map(b => `
                <tr style="border-bottom:1px solid var(--border-color);">
                  <td style="padding:0.75rem 0.5rem; font-family:monospace; font-weight:600;">${b.booking_reference}</td>
                  <td style="padding:0.75rem 0.5rem;">${b.participant_profiles?.full_name || 'Guest'}</td>
                  <td style="padding:0.75rem 0.5rem;">${b.participant_profiles?.email || 'N/A'}</td>
                  <td style="padding:0.75rem 0.5rem;">
                    <span class="badge ${b.attendance_confirmed ? 'badge-success' : b.status === 'no_show' ? 'badge-danger' : 'badge-neutral'}">
                      ${b.attendance_confirmed ? 'Attended' : b.status}
                    </span>
                  </td>
                  <td style="padding:0.75rem 0.5rem;">
                    <button class="btn btn-secondary btn-sm btn-mark-attend" data-id="${b.id}" data-attend="true">Check-In</button>
                    <button class="btn btn-secondary btn-sm btn-mark-attend" data-id="${b.id}" data-attend="false" style="color:var(--danger);">No-Show</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Check-in handler
  document.querySelectorAll('.btn-mark-attend').forEach(btn => {
    btn.onclick = async (e) => {
      const bookingId = e.target.dataset.id;
      const attended = e.target.dataset.attend === 'true';
      await supabase.rpc('mark_attendance', { p_booking_id: bookingId, p_attended: attended });
      toast('Attendance status updated', 'success');
      renderAnalyticsPage(container, { param: eventId });
    };
  });
}

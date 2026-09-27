import { supabase } from '../supabaseClient.js';
import { toast, generateQRCodeDataURI } from '../utils/ui.js';

export async function renderPublishPage(container, { param: eventId }) {
  const { data: event, error } = await supabase
    .from('events')
    .select(`
      *,
      timeslots ( id, status ),
      bookings ( id, status, attendance_confirmed )
    `)
    .eq('id', eventId)
    .single();

  if (error || !event) {
    container.innerHTML = `<div class="card"><p style="color:var(--danger)">Failed to find event: ${error?.message || 'Event not found'}</p></div>`;
    return;
  }

  const totalSlots = event.timeslots ? event.timeslots.length : 0;
  const bookedSlots = event.timeslots ? event.timeslots.filter(s => s.status === 'booked').length : 0;
  const availableSlots = totalSlots - bookedSlots;
  const cancelledBookings = event.bookings ? event.bookings.filter(b => b.status === 'cancelled').length : 0;
  const noShows = event.bookings ? event.bookings.filter(b => b.status === 'no_show').length : 0;

  // Accurately compute base path to include repo name (/eventbook/) on GitHub Pages
  const basePath = window.location.pathname.endsWith('/') 
    ? window.location.pathname 
    : window.location.pathname + '/';
  const publicBookingURL = `${window.location.origin}${basePath}#/book/${event.slug}`;
  const qrCodeData = generateQRCodeDataURI(publicBookingURL);

  container.innerHTML = `
    <div style="max-width:1000px; margin:0 auto;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
        <div>
          <a href="#/events" style="text-decoration:none; color:var(--text-muted); font-size:0.875rem;">&larr; Back to Events</a>
          <h1 style="font-size:1.75rem; font-weight:700; margin-top:0.25rem;">
            ${event.name} 
            <span class="badge ${event.status === 'published' ? 'badge-success' : 'badge-neutral'}">${event.status}</span>
          </h1>
          <p style="color:var(--text-muted); font-size:0.9rem;">${event.location_details || 'Online'} &bull; ${event.slot_duration_minutes}m slots</p>
        </div>

        <!-- Top Action Buttons Bar -->
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
          <a href="#/edit/${event.id}" class="btn btn-secondary btn-sm" style="display:inline-flex; align-items:center; gap:0.35rem;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            Edit Event
          </a>
          <button id="btn-export-csv" class="btn btn-secondary btn-sm">Export CSV</button>
          <button id="btn-toggle-status" class="btn ${event.status === 'published' ? 'btn-danger' : 'btn-primary'} btn-sm">
            ${event.status === 'published' ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </div>

      <!-- Participant Access Card with Inline Copy Button -->
      <div class="card" style="background:#f8fafc; border:1px solid var(--border-color); padding:1.5rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1.25rem;">
          <div style="flex:1; min-width:280px;">
            <label class="form-label" style="margin-bottom:0.4rem;">Booking Link</label>
            <div style="display:flex; gap:0.5rem; align-items:center;">
              <input type="text" id="input-booking-link" class="form-control" value="${publicBookingURL}" readonly style="background:#ffffff; font-family:monospace; font-size:0.9rem;" />
              <button id="btn-copy-inline" class="btn btn-secondary" style="white-space:nowrap; gap:0.35rem;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                Copy
              </button>
            </div>
            
            <div style="margin-top:0.75rem; font-size:0.9rem; display:flex; align-items:center; gap:0.5rem;">
              <span style="color:var(--text-muted);">Passcode:</span>
              <span style="font-family:monospace; font-weight:700; background:#e2e8f0; padding:2px 8px; border-radius:4px;">${event.passcode_plain || '******'}</span>
            </div>
          </div>

          <div style="text-align:center;">
            <img src="${qrCodeData}" alt="QR Code" style="width:90px; height:90px; background:#fff; border-radius:8px; padding:4px; border:1px solid var(--border-color);" />
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.25rem;">Scan to Book</div>
          </div>
        </div>
      </div>

      <!-- Metrics Row -->
      <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); margin-bottom:1.5rem;">
        <div class="card" style="margin-bottom:0; text-align:center;">
          <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">TOTAL SLOTS</span>
          <div style="font-size:2rem; font-weight:700; margin-top:0.25rem;">${totalSlots}</div>
        </div>
        <div class="card" style="margin-bottom:0; text-align:center;">
          <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">BOOKED</span>
          <div style="font-size:2rem; font-weight:700; color:var(--primary); margin-top:0.25rem;">${bookedSlots}</div>
        </div>
        <div class="card" style="margin-bottom:0; text-align:center;">
          <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">AVAILABLE</span>
          <div style="font-size:2rem; font-weight:700; color:var(--success); margin-top:0.25rem;">${availableSlots}</div>
        </div>
        <div class="card" style="margin-bottom:0; text-align:center;">
          <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">CANCELLED</span>
          <div style="font-size:2rem; font-weight:700; color:var(--warning); margin-top:0.25rem;">${cancelledBookings}</div>
        </div>
        <div class="card" style="margin-bottom:0; text-align:center;">
          <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">NO SHOW</span>
          <div style="font-size:2rem; font-weight:700; color:var(--danger); margin-top:0.25rem;">${noShows}</div>
        </div>
      </div>
    </div>
  `;

  // Inline Copy Button
  document.getElementById('btn-copy-inline').onclick = () => {
    const input = document.getElementById('input-booking-link');
    navigator.clipboard.writeText(input.value);
    toast('Booking link copied to clipboard!', 'success');
  };

  // Toggle Publish/Unpublish Status
  document.getElementById('btn-toggle-status').onclick = async () => {
    const nextStatus = event.status === 'published' ? 'draft' : 'published';
    await supabase.from('events').update({ status: nextStatus }).eq('id', event.id);
    toast(`Event status changed to ${nextStatus}`, 'info');
    renderPublishPage(container, { param: eventId });
  };

  // Export Attendees to CSV
  document.getElementById('btn-export-csv').onclick = async () => {
    const { data: bookings } = await supabase
      .from('bookings')
      .select('booking_reference, status, attendance_confirmed, created_at, participant_profiles(full_name, email, phone)')
      .eq('event_id', event.id);

    if (!bookings || bookings.length === 0) return alert('No booking records to export.');

    const headers = ['Booking Reference', 'Participant Name', 'Email', 'Phone', 'Status', 'Attendance Confirmed', 'Booked At'];
    const rows = bookings.map(b => [
      b.booking_reference,
      `"${b.participant_profiles?.full_name || ''}"`,
      b.participant_profiles?.email || '',
      b.participant_profiles?.phone || '',
      b.status,
      b.attendance_confirmed ? 'YES' : 'NO',
      b.created_at
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${event.slug}-attendees.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
}

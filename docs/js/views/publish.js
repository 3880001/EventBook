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
    container.innerHTML = `<div class="card"><p>Failed to find event.</p></div>`;
    return;
  }

  // Calculate Aggregates
  const totalSlots = event.timeslots ? event.timeslots.length : 0;
  const bookedSlots = event.timeslots ? event.timeslots.filter(s => s.status === 'booked').length : 0;
  const availableSlots = totalSlots - bookedSlots;
  const cancelledBookings = event.bookings ? event.bookings.filter(b => b.status === 'cancelled').length : 0;
  const noShows = event.bookings ? event.bookings.filter(b => b.status === 'no_show').length : 0;

  const publicBookingURL = `${window.location.origin}/#/book/${event.slug}`;
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

        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          <button id="btn-copy-link" class="btn btn-secondary btn-sm">Copy Link</button>
          <button id="btn-export-csv" class="btn btn-secondary btn-sm">Export CSV</button>
          <button id="btn-toggle-status" class="btn ${event.status === 'published' ? 'btn-danger' : 'btn-primary'} btn-sm">
            ${event.status === 'published' ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </div>

      <!-- Quick Access Share Card -->
      <div class="card" style="background:var(--primary-light); border:1px solid #c7d2fe;">
        <h3 style="font-size:1.1rem; font-weight:700; color:var(--primary-hover); margin-bottom:0.5rem;">Participant Access Card</h3>
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
          <div style="word-break:break-all;">
            <div style="font-size:0.875rem; margin-bottom:0.25rem;"><strong>Booking Link:</strong> <code>${publicBookingURL}</code></div>
            <div style="font-size:0.875rem;"><strong>Required Passcode:</strong> <span style="font-family:monospace; font-weight:700; font-size:1.1rem; background:#fff; padding:2px 8px; border-radius:4px;">${event.passcode_plain || '******'}</span></div>
          </div>
          <div>
            <img src="${qrCodeData}" alt="QR Code" style="width:90px; height:90px; background:#fff; border-radius:8px; padding:4px;" />
          </div>
        </div>
      </div>

      <!-- Metrics Row (Matching BRD Mockup) -->
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

  // Actions
  document.getElementById('btn-copy-link').onclick = () => {
    navigator.clipboard.writeText(`Event: ${event.name}\nBooking Link: ${publicBookingURL}\nPasscode: ${event.passcode_plain}`);
    toast('Access details copied to clipboard!', 'success');
  };

  document.getElementById('btn-toggle-status').onclick = async () => {
    const nextStatus = event.status === 'published' ? 'draft' : 'published';
    await supabase.from('events').update({ status: nextStatus }).eq('id', event.id);
    toast(`Event status changed to ${nextStatus}`, 'info');
    renderPublishPage(container, { param: eventId });
  };

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

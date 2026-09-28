import { supabase } from '../supabaseClient.js';
import { toast, generateQRCodeDataURI } from '../utils/ui.js';

export async function renderTicketPage(container, { param: bookingRef }) {
  if (!bookingRef) {
    container.innerHTML = '<div class="card"><p style="color:var(--danger);">No booking reference provided.</p></div>';
    return;
  }

  container.innerHTML = '<div class="loader-center"><div class="spinner"></div></div>';

  // Fetch Booking Details with Event and Participant Info
  const { data: booking, error } = await supabase
    .from('bookings')
    .select(`
      *,
      events (*),
      participant_profiles (*),
      timeslots (*)
    `)
    .eq('booking_reference', bookingRef)
    .single();

  if (error || !booking) {
    container.innerHTML = `
      <div class="card" style="max-width:500px; margin:2rem auto; text-align:center; padding:3rem 1.5rem;">
        <h2 style="font-size:1.5rem; font-weight:700; color:var(--danger);">Ticket Not Found</h2>
        <p style="color:var(--text-muted); margin-top:0.5rem;">Booking reference <code>${bookingRef}</code> does not exist.</p>
        <a href="#/" class="btn btn-secondary btn-sm" style="margin-top:1.5rem;">Go to Home</a>
      </div>
    `;
    return;
  }

  const event = booking.events;
  const participant = booking.participant_profiles;
  const slot = booking.timeslots;

  // Format date/time
  let timeStr = 'Full Day Session';
  if (slot && slot.start_time) {
    timeStr = new Date(slot.start_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  }

  const qrCodeData = generateQRCodeDataURI(window.location.href);

  function renderView() {
    container.innerHTML = `
      <div style="max-width:520px; margin:2rem auto; padding:0 1rem;">
        <!-- Digital Boarding Pass Ticket -->
        <div class="card" style="border:2px solid ${booking.attendance_confirmed ? 'var(--success)' : 'var(--primary)'}; padding:0; overflow:hidden; border-radius:16px;">
          <!-- Top Header Strip -->
          <div style="background:${booking.attendance_confirmed ? '#10b981' : '#3b82f6'}; color:#ffffff; padding:1.25rem; text-align:center;">
            <span style="font-size:0.75rem; text-transform:uppercase; letter-spacing:1px; font-weight:700;">Verified Event Pass</span>
            <h1 style="font-size:1.5rem; font-weight:700; margin:0.25rem 0 0 0; color:#ffffff;">${event?.name || 'Event Ticket'}</h1>
          </div>

          <!-- Ticket Content -->
          <div style="padding:1.75rem 1.5rem;">
            <!-- Status Badge -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
              <div>
                <span style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Reference</span>
                <div style="font-family:monospace; font-size:1.2rem; font-weight:700; color:var(--primary);">${booking.booking_reference}</div>
              </div>
              <span class="badge ${booking.attendance_confirmed ? 'badge-success' : 'badge-neutral'}" style="font-size:0.85rem; padding:0.4rem 0.8rem;">
                ${booking.attendance_confirmed ? '✓ Attended / Checked In' : 'Valid Reservation'}
              </span>
            </div>

            <div style="background:#f8fafc; border-radius:10px; padding:1rem; border:1px solid var(--border-color); margin-bottom:1.5rem; display:grid; gap:0.65rem;">
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--text-muted); font-size:0.875rem;">Attendee</span>
                <span style="font-weight:600; font-size:0.9rem;">${participant?.full_name || 'Guest'}</span>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--text-muted); font-size:0.875rem;">Email</span>
                <span style="font-size:0.9rem;">${participant?.email || 'N/A'}</span>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--text-muted); font-size:0.875rem;">Time</span>
                <span style="font-weight:600; font-size:0.9rem;">${timeStr}</span>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--text-muted); font-size:0.875rem;">Location</span>
                <span style="font-weight:600; font-size:0.9rem;">${event?.location_details || 'Online'}</span>
              </div>
            </div>

            <div style="text-align:center; margin-bottom:1.5rem;">
              <img src="${qrCodeData}" alt="QR Code" style="width:120px; height:120px; border-radius:8px; border:1px solid var(--border-color); padding:4px;" />
              <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.35rem;">Digital verification pass</div>
            </div>

            <!-- Check-in Action Button (Used by organizer desk staff) -->
            ${!booking.attendance_confirmed ? `
              <button id="btn-checkin-action" class="btn btn-primary" style="width:100%; padding:0.85rem; font-weight:600; font-size:1rem;">
                ✓ Confirm Check-In / Mark Attended
              </button>
            ` : `
              <div style="text-align:center; background:#dcfce7; color:#166534; padding:0.75rem; border-radius:8px; font-weight:600; font-size:0.9rem;">
                Attendance confirmed on ${new Date(booking.updated_at || booking.created_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
              </div>
            `}
          </div>
        </div>
      </div>
    `;

    const checkinBtn = document.getElementById('btn-checkin-action');
    if (checkinBtn) {
      checkinBtn.onclick = async () => {
        checkinBtn.disabled = true;
        checkinBtn.innerText = 'Checking in...';
        const { error: updErr } = await supabase
          .from('bookings')
          .update({
            attendance_confirmed: true,
            status: 'attended',
            updated_at: new Date().toISOString()
          })
          .eq('id', booking.id);

        if (updErr) {
          toast('Check-in error: ' + updErr.message, 'danger');
          checkinBtn.disabled = false;
          checkinBtn.innerText = '✓ Confirm Check-In';
        } else {
          booking.attendance_confirmed = true;
          toast('Check-in successful!', 'success');
          renderView();
        }
      };
    }
  }

  renderView();
}

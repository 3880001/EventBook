import { supabase } from '../supabaseClient.js';
import { generateQRCodeDataURI, toast } from '../utils/ui.js';
import { formatLocationHtml } from '../utils/location.js';
import { isCheckinAllowed, getSessionTimes } from '../utils/eventEngine.js';

export async function renderTicketPage(container, { param: bookingRef }) {
  if (!bookingRef) {
    container.innerHTML = '<div class="card"><p style="color:var(--danger)">Invalid ticket link.</p></div>';
    return;
  }

  container.innerHTML = '<div class="loader-center"><div class="spinner"></div></div>';

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*, events (*, event_dates (*)), timeslots (*), participant_profiles (*)')
    .eq('booking_reference', bookingRef)
    .single();

  if (error || !booking) {
    container.innerHTML = '<div class="card" style="text-align:center; padding:3rem 1rem;">'
      + '<h2 style="font-size:1.5rem; font-weight:700; color:var(--danger);">Ticket Not Found</h2>'
      + '<p style="color:var(--text-muted); margin-top:0.5rem;">Could not locate reservation: ' + bookingRef + '</p>'
      + '</div>';
    return;
  }

  const evt = booking.events || {};
  const participant = booking.participant_profiles || {};
  const slot = booking.timeslots;

  // 1. Universal Check-in Evaluation via eventEngine
  const checkinStatus = isCheckinAllowed(evt, slot);
  const isAlreadyAttended = !!booking.attendance_confirmed || booking.status === 'attended';

  // 2. Format Date/Time Display
  const { startTime } = getSessionTimes(evt, slot);
  let timeDisplay = 'Whole Day Session';
  if (startTime) {
    timeDisplay = startTime.toLocaleString([], {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });
  }

  const ticketLiveUrl = window.location.href;
  const qrCodeData = generateQRCodeDataURI(ticketLiveUrl);

  // Status Badge in Top-Right
  let statusBadgeHtml = '';
  if (isAlreadyAttended) {
    statusBadgeHtml = '<span style="background:#ecfdf5; color:#059669; border:1px solid #a7f3d0; padding:4px 12px; border-radius:999px; font-size:0.75rem; font-weight:700; letter-spacing:0.5px;">✓ ATTENDED / CHECKED IN</span>';
  } else if (booking.status === 'cancelled') {
    statusBadgeHtml = '<span style="background:#fef2f2; color:#dc2626; border:1px solid #fecaca; padding:4px 12px; border-radius:999px; font-size:0.75rem; font-weight:700; letter-spacing:0.5px;">CANCELLED</span>';
  } else if (booking.status === 'running_late') {
    statusBadgeHtml = '<span style="background:#fffbeb; color:#d97706; border:1px solid #fde68a; padding:4px 12px; border-radius:999px; font-size:0.75rem; font-weight:700; letter-spacing:0.5px;">RUNNING LATE</span>';
  } else {
    statusBadgeHtml = '<span style="background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; padding:4px 12px; border-radius:999px; font-size:0.75rem; font-weight:700; letter-spacing:0.5px;">CONFIRMED</span>';
  }

  // 3. Action Button Logic
  let actionBoxHtml = '';
  if (checkinStatus.reason === 'past') {
    // Past event: Completely locked
    if (isAlreadyAttended) {
      actionBoxHtml = '<div style="background:#f1f5f9; color:#475569; padding:0.85rem 1rem; border-radius:10px; font-weight:700; font-size:0.875rem; border:1px solid #cbd5e1;">'
        + '🔒 Event Concluded &bull; Attended'
        + '</div>';
    } else {
      actionBoxHtml = '<div style="background:#f1f5f9; color:#64748b; padding:0.85rem 1rem; border-radius:10px; font-weight:600; font-size:0.875rem; border:1px solid #cbd5e1;">'
        + '🔒 Event Concluded &bull; Check-in Closed'
        + '</div>';
    }
  } else if (isAlreadyAttended) {
    actionBoxHtml = '<div style="background:#dcfce7; color:#166534; padding:0.85rem 1rem; border-radius:10px; font-weight:700; font-size:0.9rem; border:1px solid #86efac;">'
      + '✓ Attendance Confirmed'
      + '</div>';
  } else if (checkinStatus.reason === 'early') {
    actionBoxHtml = '<div style="background:#f8fafc; color:#64748b; padding:0.85rem 1rem; border-radius:10px; font-weight:600; font-size:0.85rem; border:1px dashed #cbd5e1;">'
      + '⏳ Check-in opens 1 hour before session'
      + '</div>';
  } else {
    // Active window
    actionBoxHtml = '<button type="button" id="btn-self-checkin" class="btn btn-primary" style="width:100%; padding:0.85rem; font-weight:700; font-size:1rem; border-radius:10px; background:#10b981; border:none; color:#ffffff; cursor:pointer;">'
      + '🟢 Confirm Attendance / I\'m Here'
      + '</button>';
  }

  // Format any custom responses
  let customResponsesHtml = '';
  if (booking.custom_responses && typeof booking.custom_responses === 'object') {
    const entries = Object.entries(booking.custom_responses);
    if (entries.length > 0) {
      customResponsesHtml = '<div style="margin-top:1rem; padding-top:1rem; border-top:1px dashed var(--border-color); text-align:left;">';
      entries.forEach(([k, v]) => {
        customResponsesHtml += '<div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:0.35rem;">'
          + '<span style="color:var(--text-muted);">' + k + ':</span>'
          + '<strong style="color:var(--text-primary);">' + v + '</strong>'
          + '</div>';
      });
      customResponsesHtml += '</div>';
    }
  }

  container.innerHTML = '<div style="max-width:440px; margin:2rem auto; padding:0 1rem; padding-bottom:3rem;">'
    + '<div style="margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center;">'
    + '<a href="#/events" style="text-decoration:none; color:var(--text-muted); font-size:0.875rem;">&larr; My Events</a>'
    + '<button onclick="window.print()" class="btn btn-secondary btn-sm" style="display:inline-flex; align-items:center; gap:0.35rem;">'
    + '🖨️ Print Pass'
    + '</button>'
    + '</div>'

    + '<div style="background:#ffffff; border:2px solid #10b981; border-radius:20px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.06); text-align:center;">'
    
    // Header
    + '<div style="background:#10b981; color:#ffffff; padding:1.5rem 1.25rem;">'
    + '<div style="font-size:0.75rem; font-weight:700; letter-spacing:1px; text-transform:uppercase; opacity:0.9;">VERIFIED EVENT PASS</div>'
    + '<h1 style="margin:0.35rem 0 0 0; font-size:1.5rem; font-weight:800; color:#ffffff;">' + (evt.name || 'Event Pass') + '</h1>'
    + '</div>'

    // Body
    + '<div style="padding:1.5rem;">'
    
    // Ref Row
    + '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">'
    + '<div style="text-align:left;">'
    + '<div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">REFERENCE</div>'
    + '<div style="font-family:monospace; font-weight:800; font-size:1.15rem; color:#4f46e5;">' + booking.booking_reference + '</div>'
    + '</div>'
    + '<div>' + statusBadgeHtml + '</div>'
    + '</div>'

    // Details Grid
    + '<div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1.15rem; margin-bottom:1.5rem; text-align:left; font-size:0.875rem;">'
    + '<div style="display:flex; justify-content:space-between; margin-bottom:0.6rem;">'
    + '<span style="color:var(--text-muted);">Attendee</span>'
    + '<strong style="color:var(--text-primary);">' + (participant.full_name || 'Guest') + '</strong>'
    + '</div>'
    + '<div style="display:flex; justify-content:space-between; margin-bottom:0.6rem;">'
    + '<span style="color:var(--text-muted);">Email</span>'
    + '<span style="color:var(--text-primary);">' + (participant.email || 'N/A') + '</span>'
    + '</div>'
    + '<div style="display:flex; justify-content:space-between; margin-bottom:0.6rem;">'
    + '<span style="color:var(--text-muted);">Time</span>'
    + '<strong style="color:var(--text-primary);">' + timeDisplay + '</strong>'
    + '</div>'
    + '<div style="display:flex; justify-content:space-between; align-items:center;">'
    + '<span style="color:var(--text-muted);">Location</span>'
    + '<div>' + formatLocationHtml(evt.location_details, 'Online') + '</div>'
    + '</div>'
    + customResponsesHtml
    + '</div>'

    // QR Code
    + '<div style="margin:0 auto 1.5rem auto; width:150px; height:150px; background:#fff; padding:6px; border:1px solid #e2e8f0; border-radius:12px;">'
    + '<img src="' + qrCodeData + '" alt="QR Code" style="width:100%; height:100%; border-radius:8px;" />'
    + '</div>'
    + '<div style="font-size:0.8rem; color:#64748b; margin-top:-1rem; margin-bottom:1.5rem;">Digital verification pass</div>'

    // Action Container
    + '<div id="ticket-action-box">' + actionBoxHtml + '</div>'

    + '</div>'
    + '</div>'
    + '</div>';

  const checkinBtn = document.getElementById('btn-self-checkin');
  if (checkinBtn) {
    checkinBtn.onclick = async () => {
      checkinBtn.disabled = true;
      checkinBtn.innerText = 'Confirming...';

      const { error: updErr } = await supabase
        .from('bookings')
        .update({
          status: 'attended',
          attendance_confirmed: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', booking.id);

      if (updErr) {
        toast('Check-in failed: ' + updErr.message, 'danger');
        checkinBtn.disabled = false;
        checkinBtn.innerText = '🟢 Confirm Attendance / I\'m Here';
      } else {
        toast('Attendance confirmed!', 'success');
        booking.attendance_confirmed = true;
        booking.status = 'attended';
        renderTicketPage(container, { param: bookingRef });
      }
    };
  }
}

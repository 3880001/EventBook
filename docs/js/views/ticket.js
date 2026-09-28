import { supabase } from '../supabaseClient.js';
import { generateQRCodeDataURI, toast } from '../utils/ui.js';
import { formatLocationHtml } from '../utils/location.js';

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
  const now = new Date();

  // Determine if session is past
  let isPast = false;
  let sessionTime = null;

  if (slot && slot.end_time) {
    sessionTime = new Date(slot.end_time);
  } else if (slot && slot.start_time) {
    sessionTime = new Date(new Date(slot.start_time).getTime() + 60 * 60 * 1000);
  } else if (evt.event_dates && evt.event_dates[0]) {
    const ed = evt.event_dates[0];
    sessionTime = new Date(ed.event_date + 'T' + (ed.end_time || '23:59:59'));
  }

  if (sessionTime && sessionTime < now) {
    isPast = true;
  }

  // Format Date and Time
  let timeDisplay = 'Scheduled Date';
  if (slot && slot.start_time) {
    timeDisplay = new Date(slot.start_time).toLocaleString([], {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } else if (evt.event_dates && evt.event_dates[0]) {
    timeDisplay = new Date(evt.event_dates[0].event_date + 'T00:00:00').toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    }) + ' (Whole Day)';
  }

  const ticketLiveUrl = window.location.href;
  const qrCodeData = generateQRCodeDataURI(ticketLiveUrl);

  const statusBadge = booking.attendance_confirmed
    ? '<span class="badge badge-success" style="font-size:0.85rem;">✓ Attended</span>'
    : (booking.status === 'cancelled'
        ? '<span class="badge badge-danger" style="font-size:0.85rem;">Cancelled</span>'
        : (booking.status === 'no_show'
            ? '<span class="badge badge-warning" style="font-size:0.85rem;">No Show</span>'
            : (booking.status === 'running_late'
                ? '<span class="badge" style="background:#f59e0b; color:#fff; font-size:0.85rem;">🟡 Running Late</span>'
                : '<span class="badge badge-primary" style="font-size:0.85rem;">Confirmed</span>')));

  // Past event banner vs active pass banner
  const statusHeaderBanner = isPast
    ? '<div style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:8px; padding:10px 14px; margin-bottom:1.25rem; display:flex; align-items:center; justify-content:center; gap:0.5rem; font-size:0.85rem; color:#475569; font-weight:600;">'
      + '<span>🔒</span> Event Concluded &bull; Archived Historical Record'
      + '</div>'
    : '';

  // Custom responses formatting
  let customResponsesHtml = '';
  if (booking.custom_responses && typeof booking.custom_responses === 'object') {
    const entries = Object.entries(booking.custom_responses);
    if (entries.length > 0) {
      customResponsesHtml = '<div style="margin-top:1rem; padding-top:1rem; border-top:1px dashed var(--border-color); text-align:left;">'
        + '<div style="font-size:0.8rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.5rem;">Registration Details</div>';
      entries.forEach(([k, v]) => {
        customResponsesHtml += '<div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:0.35rem;">'
          + '<span style="color:var(--text-muted);">' + k + ':</span>'
          + '<strong style="color:var(--text-primary);">' + v + '</strong>'
          + '</div>';
      });
      customResponsesHtml += '</div>';
    }
  }

  container.innerHTML = '<div style="max-width:480px; margin:2rem auto; padding:0 1rem; padding-bottom:4rem;">'
    + '<div style="margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center;">'
    + '<a href="#/events" style="text-decoration:none; color:var(--text-muted); font-size:0.875rem;">&larr; My Events</a>'
    + '<button onclick="window.print()" class="btn btn-secondary btn-sm" style="display:inline-flex; align-items:center; gap:0.35rem;">'
    + '🖨️ Print Pass'
    + '</button>'
    + '</div>'

    + '<div class="card" style="text-align:center; padding:2rem 1.5rem; border-radius:16px; border:1px solid var(--border-color); box-shadow:0 8px 30px rgba(0,0,0,0.06);">'
    + statusHeaderBanner
    + '<div style="display:inline-block; font-family:monospace; font-weight:800; font-size:1.1rem; color:var(--primary); background:var(--primary-light); padding:4px 12px; border-radius:6px; margin-bottom:0.75rem;">'
    + booking.booking_reference
    + '</div>'
    + '<h1 style="font-size:1.6rem; font-weight:800; margin:0 0 0.5rem 0;">' + (evt.name || 'Event Ticket') + '</h1>'
    + '<div style="margin-bottom:1.5rem;">' + statusBadge + '</div>'

    // QR Code
    + '<div style="margin:1rem auto 1.5rem auto; width:150px; height:150px; background:#fff; padding:6px; border:2px dashed var(--border-color); border-radius:12px;">'
    + '<img src="' + qrCodeData + '" alt="QR Code" style="width:100%; height:100%; border-radius:8px;" />'
    + '</div>'
    + '<div style="font-size:0.75rem; color:var(--text-muted); margin-top:-1rem; margin-bottom:1.5rem;">'
    + (isPast ? 'Check-in closed for this session' : 'Scan at venue for rapid check-in')
    + '</div>'

    // Details Grid
    + '<div style="background:#f8fafc; border-radius:10px; border:1px solid var(--border-color); padding:1.25rem; text-align:left; font-size:0.9rem;">'
    + '<div style="display:flex; justify-content:space-between; margin-bottom:0.6rem;">'
    + '<span style="color:var(--text-muted);">Attendee:</span>'
    + '<strong>' + (participant.full_name || 'Guest') + '</strong>'
    + '</div>'
    + '<div style="display:flex; justify-content:space-between; margin-bottom:0.6rem;">'
    + '<span style="color:var(--text-muted);">Date & Time:</span>'
    + '<strong style="text-align:right;">' + timeDisplay + '</strong>'
    + '</div>'
    + '<div style="display:flex; justify-content:space-between; align-items:center;">'
    + '<span style="color:var(--text-muted);">Location:</span>'
    + '<div>' + formatLocationHtml(evt.location_details, 'Online') + '</div>'
    + '</div>'
    + customResponsesHtml
    + '</div>'

    + (isPast ? '<p style="color:var(--text-muted); font-size:0.8rem; margin-top:1.5rem; font-style:italic;">Attendance status and check-in options are locked for past events.</p>' : '')
    + '</div>'
    + '</div>';
}

import { supabase } from '../supabaseClient.js';
import { toast } from '../utils/ui.js';

export async function renderRsvpPage(container, { param: bookingRef, query }) {
  const action = query?.get('action') || window.location.hash.split('/')[3] || 'here';

  if (!bookingRef) {
    container.innerHTML = '<div class="card"><p style="color:var(--danger)">Invalid response link.</p></div>';
    return;
  }

  container.innerHTML = '<div class="loader-center"><div class="spinner"></div></div>';

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, booking_reference, status, attendance_confirmed, created_at, timeslot_id, events ( id, name, slug, location_details, slot_duration_minutes, event_dates (*) ), timeslots ( id, start_time, end_time ), participant_profiles ( full_name, email )')
    .eq('booking_reference', bookingRef)
    .single();

  if (error || !booking) {
    container.innerHTML = '<div class="card" style="max-width:500px; margin:3rem auto; text-align:center; padding:2rem;">'
      + '<h2 style="color:var(--danger)">Reservation Not Found</h2>'
      + '<p style="color:var(--text-muted)">We could not locate booking reference ' + bookingRef + '.</p>'
      + '</div>';
    return;
  }

  const event = booking.events;
  const participant = booking.participant_profiles;
  const now = new Date();

  // Check if session has concluded
  let endTime = null;
  if (booking.timeslots && booking.timeslots.end_time) {
    endTime = new Date(booking.timeslots.end_time);
  } else if (booking.timeslots && booking.timeslots.start_time) {
    const dur = event?.slot_duration_minutes || 15;
    endTime = new Date(new Date(booking.timeslots.start_time).getTime() + dur * 60 * 1000);
  } else if (event?.event_dates && event.event_dates[0]) {
    const ed = event.event_dates[0];
    endTime = new Date(ed.event_date + 'T' + (ed.end_time || '17:00:00'));
  }

  const isPast = endTime ? (now > endTime) : false;

  // If past: strictly reject any update
  if (isPast) {
    const currentStatus = booking.attendance_confirmed ? 'attended' : booking.status;
    container.innerHTML = '<div style="max-width:500px; margin:3rem auto; padding:0 1rem;">'
      + '<div class="card" style="text-align:center; padding:2.5rem 1.5rem; border-top:5px solid #64748b; border-radius:14px;">'
      + '<div style="font-size:2rem; margin-bottom:0.75rem;">🔒</div>'
      + '<h1 style="font-size:1.5rem; font-weight:700; margin-bottom:0.35rem;">Event Concluded</h1>'
      + '<div style="display:inline-block; background:#e2e8f0; color:#334155; font-size:0.8rem; font-weight:700; padding:3px 10px; border-radius:6px; margin-bottom:1rem; text-transform:uppercase;">'
      + 'Attendance & Check-in Locked'
      + '</div>'
      + '<p style="color:var(--text-muted); font-size:0.9rem; line-height:1.5;">'
      + 'This session has already taken place. Attendance status and cancellations cannot be updated for past events.'
      + '</p>'
      + '<div style="background:#f8fafc; border:1px solid var(--border-color); border-radius:10px; padding:1.25rem; margin:1.5rem 0; text-align:left; font-size:0.9rem;">'
      + '<div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">'
      + '<span style="color:var(--text-muted);">Event:</span><strong>' + (event?.name || 'Event') + '</strong>'
      + '</div>'
      + '<div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">'
      + '<span style="color:var(--text-muted);">Ref:</span><span style="font-family:monospace; font-weight:700;">' + bookingRef + '</span>'
      + '</div>'
      + '<div style="display:flex; justify-content:space-between; align-items:center;">'
      + '<span style="color:var(--text-muted);">Final Status:</span>'
      + '<span class="badge" style="background:#e2e8f0; color:#334155; font-weight:700; text-transform:uppercase;">' + currentStatus + '</span>'
      + '</div>'
      + '</div>'
      + '<a href="#/ticket/' + bookingRef + '" class="btn btn-secondary btn-sm" style="text-decoration:none;">View Digital Pass</a>'
      + '</div>'
      + '</div>';
    return;
  }

  // Active / Upcoming: Process Status Update
  let title = '';
  let message = '';
  let badgeColor = 'var(--primary)';
  let newStatus = booking.status;
  let isAttended = booking.attendance_confirmed;
  let showRebook = false;

  if (action === 'late') {
    newStatus = 'running_late';
    title = 'Organizers Notified: Running Late';
    message = 'Thank you, ' + (participant?.full_name || 'Guest') + '. We have informed the event team that you are running a little late. Your slot will be held.';
    badgeColor = 'var(--warning)';
  } else if (action === 'here') {
    newStatus = 'attended';
    isAttended = true;
    title = 'Welcome! You\'re Checked In';
    message = 'Great to have you here, ' + (participant?.full_name || 'Guest') + '! Your arrival has been confirmed with the event organizer.';
    badgeColor = 'var(--success)';
  } else if (action === 'cancel') {
    newStatus = 'cancelled';
    title = 'Booking Cancelled';
    message = 'Due to technical issue, your booking is cancelled, you can book a new timeslot.';
    badgeColor = 'var(--danger)';
    showRebook = true;
  }

  await supabase
    .from('bookings')
    .update({
      status: newStatus,
      attendance_confirmed: isAttended,
      updated_at: new Date().toISOString()
    })
    .eq('id', booking.id);

  if (action === 'cancel' && booking.timeslot_id) {
    await supabase.from('timeslots').update({ status: 'available' }).eq('id', booking.timeslot_id);
  }

  const rebookBtn = showRebook && event?.slug
    ? '<a href="#/book/' + event.slug + '" class="btn btn-primary" style="margin-top:1.5rem; display:inline-block; font-weight:600; text-decoration:none;">'
      + '📅 Book a New Timeslot &rarr;'
      + '</a>'
    : '<a href="#/ticket/' + bookingRef + '" class="btn btn-secondary btn-sm" style="margin-top:1.5rem; display:inline-block; text-decoration:none;">'
      + 'View Ticket Details'
      + '</a>';

  container.innerHTML = '<div style="max-width:500px; margin:3rem auto; padding:0 1rem;">'
    + '<div class="card" style="text-align:center; padding:2.5rem 1.5rem; border-top:5px solid ' + badgeColor + '; border-radius:14px;">'
    + '<h1 style="font-size:1.6rem; font-weight:700; margin-bottom:0.5rem;">' + title + '</h1>'
    + '<p style="color:var(--text-muted); font-size:0.95rem; line-height:1.5;">' + message + '</p>'
    + '<div style="background:#f8fafc; border:1px solid var(--border-color); border-radius:10px; padding:1rem; margin:1.5rem 0; text-align:left; font-size:0.9rem;">'
    + '<div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">'
    + '<span style="color:var(--text-muted);">Event:</span><strong>' + (event?.name || 'Event') + '</strong>'
    + '</div>'
    + '<div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">'
    + '<span style="color:var(--text-muted);">Ref:</span><span style="font-family:monospace; font-weight:700;">' + bookingRef + '</span>'
    + '</div>'
    + '<div style="display:flex; justify-content:space-between; align-items:center;">'
    + '<span style="color:var(--text-muted);">Updated Status:</span><span class="badge" style="background:' + badgeColor + '; color:#fff;">' + newStatus + '</span>'
    + '</div>'
    + '</div>'
    + rebookBtn
    + '</div>'
    + '</div>';
}

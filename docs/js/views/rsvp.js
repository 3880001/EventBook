import { supabase } from '../supabaseClient.js';
import { toast } from '../utils/ui.js';

export async function renderRsvpPage(container, { param: bookingRef, query }) {
  const action = query?.get('action') || window.location.hash.split('/')[3] || 'here';

  if (!bookingRef) {
    container.innerHTML = '<div class="card"><p style="color:var(--danger)">Invalid response link.</p></div>';
    return;
  }

  container.innerHTML = '<div class="loader-center"><div class="spinner"></div></div>';

  // 1. Fetch Booking and Event details
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, booking_reference, status, attendance_confirmed, event_id, events ( id, name, slug, location_details ), participant_profiles ( full_name, email )')
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

  // 2. Perform database update according to participant action
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

  // Update in Supabase
  await supabase
    .from('bookings')
    .update({
      status: newStatus,
      attendance_confirmed: isAttended,
      updated_at: new Date().toISOString()
    })
    .eq('id', booking.id);

  // If cancelled, release timeslot back to available
  if (action === 'cancel' && booking.timeslot_id) {
    await supabase.from('timeslots').update({ status: 'available' }).eq('id', booking.timeslot_id);
  }

  // 3. Render Confirmation UI
  const rebookBtn = showRebook && event?.slug
    ? '<a href="#/book/' + event.slug + '" class="btn btn-primary" style="margin-top:1.5rem; display:inline-block; font-weight:600; text-decoration:none;">'
      + '📅 Book a New Timeslot &rarr;'
      + '</a>'
    : '<a href="#/ticket/' + bookingRef + '" class="btn btn-secondary btn-sm" style="margin-top:1.5rem; display:inline-block; text-decoration:none;">'
      + 'View Ticket Details'
      + '</a>';

  container.innerHTML = '<div style="max-width:520px; margin:3rem auto; padding:0 1rem;">'
    + '<div class="card" style="text-align:center; padding:2.5rem 1.5rem; border-top:5px solid ' + badgeColor + ';">'
    + '<h1 style="font-size:1.6rem; font-weight:700; margin-bottom:0.5rem;">' + title + '</h1>'
    + '<p style="color:var(--text-muted); font-size:0.95rem; line-height:1.5;">' + message + '</p>'
    + '<div style="background:#f8fafc; border:1px solid var(--border-color); border-radius:10px; padding:1rem; margin:1.5rem 0; text-align:left; font-size:0.9rem;">'
    + '<div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">'
    + '<span style="color:var(--text-muted);">Event:</span><strong>' + (event?.name || 'Event') + '</strong>'
    + '</div>'
    + '<div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">'
    + '<span style="color:var(--text-muted);">Ref:</span><span style="font-family:monospace; font-weight:700;">' + bookingRef + '</span>'
    + '</div>'
    + '<div style="display:flex; justify-content:space-between;">'
    + '<span style="color:var(--text-muted);">Updated Status:</span><span class="badge" style="background:' + badgeColor + '; color:#fff;">' + newStatus + '</span>'
    + '</div>'
    + '</div>'
    + rebookBtn
    + '</div>'
    + '</div>';
}

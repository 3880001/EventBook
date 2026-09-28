import { supabase } from '../supabaseClient.js';

function getAppBaseUrl() {
  const basePath = window.location.pathname.endsWith('/') 
    ? window.location.pathname 
    : window.location.pathname + '/';
  return window.location.origin + basePath;
}

// 1. Dispatch Booking Confirmation Email
export async function sendBookingConfirmationEmail(booking, event, participant, slot) {
  const baseUrl = getAppBaseUrl();
  const ticketUrl = baseUrl + '#/ticket/' + booking.booking_reference;
  const recipient = participant.email;
  const subject = 'Booking Confirmed: ' + event.name + ' (' + booking.booking_reference + ')';

  let timeDisplay = 'Whole Day Session';
  if (slot && slot.start_time) {
    timeDisplay = new Date(slot.start_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  }

  const bodyHtml = '<div style="font-family:sans-serif; max-width:600px; margin:0 auto; padding:20px; border:1px solid #e2e8f0; border-radius:10px;">'
    + '<h2 style="color:#10b981; margin-top:0;">✓ Booking Confirmed!</h2>'
    + '<p>Dear <strong>' + (participant.full_name || 'Participant') + '</strong>,</p>'
    + '<p>Thank you for registering for <strong>' + event.name + '</strong>. Your reservation details are below:</p>'
    + '<div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:15px; margin:15px 0;">'
    + '<p style="margin:4px 0;"><strong>Booking Reference:</strong> <span style="font-family:monospace; color:#3b82f6; font-size:1.1rem; font-weight:bold;">' + booking.booking_reference + '</span></p>'
    + '<p style="margin:4px 0;"><strong>Date & Time:</strong> ' + timeDisplay + '</p>'
    + '<p style="margin:4px 0;"><strong>Location:</strong> ' + (event.location_details || 'Online') + '</p>'
    + '</div>'
    + '<div style="margin:25px 0; text-align:center;">'
    + '<a href="' + ticketUrl + '" style="background:#3b82f6; color:#ffffff; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold; display:inline-block;">'
    + '🎟️ View Digital Ticket & QR Code &rarr;'
    + '</a>'
    + '</div>'
    + '<p style="color:#64748b; font-size:12px;">Please present your digital pass or reference code upon arrival.</p>'
    + '</div>';

  await logAndDispatchEmail(booking, event, recipient, participant.full_name, 'confirmation', subject, bodyHtml);
}

// 2. Dispatch Cancellation Email with Technical Issue Message
export async function sendCancellationEmail(booking, event, participant) {
  const baseUrl = getAppBaseUrl();
  const rebookUrl = baseUrl + '#/book/' + event.slug;
  const recipient = participant.email;
  const subject = 'Booking Cancelled: ' + event.name + ' (' + booking.booking_reference + ')';

  const bodyHtml = '<div style="font-family:sans-serif; max-width:600px; margin:0 auto; padding:20px; border:1px solid #e2e8f0; border-radius:10px;">'
    + '<h2 style="color:#ef4444; margin-top:0;">Booking Cancelled</h2>'
    + '<p>Dear <strong>' + (participant.full_name || 'Participant') + '</strong>,</p>'
    + '<div style="background:#fee2e2; border-left:4px solid #ef4444; padding:14px; margin:15px 0; border-radius:4px; color:#991b1b; font-weight:600;">'
    + 'Due to technical issue, your booking is cancelled, you can book a new timeslot.'
    + '</div>'
    + '<p><strong>Event:</strong> ' + event.name + '<br/>'
    + '<strong>Booking Ref:</strong> ' + booking.booking_reference + '</p>'
    + '<div style="margin:25px 0; text-align:center;">'
    + '<a href="' + rebookUrl + '" style="background:#3b82f6; color:#ffffff; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold; display:inline-block;">'
    + '📅 Book a New Timeslot &rarr;'
    + '</a>'
    + '</div>'
    + '<p style="color:#64748b; font-size:12px;">If you have any questions, please contact the organizer.</p>'
    + '</div>';

  await logAndDispatchEmail(booking, event, recipient, participant.full_name, 'cancellation', subject, bodyHtml);
}

// 3. Dispatch Status Update Email
export async function sendStatusUpdateEmail(booking, event, participant, newStatus) {
  const baseUrl = getAppBaseUrl();
  const ticketUrl = baseUrl + '#/ticket/' + booking.booking_reference;
  const recipient = participant.email;
  const subject = 'Booking Status Update: ' + event.name + ' (' + newStatus.toUpperCase() + ')';

  const bodyHtml = '<div style="font-family:sans-serif; max-width:600px; margin:0 auto; padding:20px; border:1px solid #e2e8f0; border-radius:10px;">'
    + '<h2 style="color:#3b82f6; margin-top:0;">Booking Status Updated</h2>'
    + '<p>Dear <strong>' + (participant.full_name || 'Participant') + '</strong>,</p>'
    + '<p>Your reservation for <strong>' + event.name + '</strong> has been updated to:</p>'
    + '<div style="background:#f1f5f9; padding:12px; font-weight:bold; font-size:1.1rem; border-radius:6px; text-transform:uppercase; color:#0f172a; margin:15px 0;">'
    + newStatus
    + '</div>'
    + '<p><strong>Booking Reference:</strong> ' + booking.booking_reference + '</p>'
    + '<div style="margin:20px 0;">'
    + '<a href="' + ticketUrl + '" style="background:#3b82f6; color:#ffffff; padding:10px 20px; text-decoration:none; border-radius:6px; font-weight:600; display:inline-block;">'
    + 'View Digital Ticket & QR'
    + '</a>'
    + '</div>'
    + '</div>';

  await logAndDispatchEmail(booking, event, recipient, participant.full_name, 'status_update', subject, bodyHtml);
}

// 4. Dispatch Final Interactive Reminder with One-Click Actions
export async function sendInteractiveReminderEmail(booking, event, participant) {
  const baseUrl = getAppBaseUrl();
  const lateUrl = baseUrl + '#/rsvp/' + booking.booking_reference + '/late';
  const hereUrl = baseUrl + '#/rsvp/' + booking.booking_reference + '/here';
  const cancelUrl = baseUrl + '#/rsvp/' + booking.booking_reference + '/cancel';
  const recipient = participant.email;
  const subject = 'Upcoming Reminder: ' + event.name + ' - Quick Attendance Check';

  const bodyHtml = '<div style="font-family:sans-serif; max-width:600px; margin:0 auto; padding:20px; border:1px solid #e2e8f0; border-radius:10px;">'
    + '<h2 style="color:#0f172a; margin-top:0;">Upcoming Event Reminder</h2>'
    + '<p>Dear <strong>' + (participant.full_name || 'Participant') + '</strong>,</p>'
    + '<p>This is a reminder for your upcoming session for <strong>' + event.name + '</strong>.</p>'
    + '<p><strong>Venue / Link:</strong> ' + (event.location_details || 'Online') + '<br/>'
    + '<strong>Booking Reference:</strong> ' + booking.booking_reference + '</p>'
    + '<div style="margin:25px 0; background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:18px; text-align:center;">'
    + '<h3 style="margin-top:0; font-size:1rem; color:#334155;">Quick Response Options:</h3>'
    + '<p style="font-size:0.85rem; color:#64748b; margin-bottom:15px;">Please tap an option below so the organizer knows your status:</p>'
    + '<div style="display:flex; flex-direction:column; gap:10px; max-width:300px; margin:0 auto;">'
    + '<a href="' + hereUrl + '" style="background:#10b981; color:#ffffff; padding:12px; text-decoration:none; border-radius:6px; font-weight:bold; display:block;">'
    + '🟢 I\'m Here'
    + '</a>'
    + '<a href="' + lateUrl + '" style="background:#f59e0b; color:#ffffff; padding:12px; text-decoration:none; border-radius:6px; font-weight:bold; display:block;">'
    + '🟡 I\'m Running Late'
    + '</a>'
    + '<a href="' + cancelUrl + '" style="background:#ef4444; color:#ffffff; padding:12px; text-decoration:none; border-radius:6px; font-weight:bold; display:block;">'
    + '🔴 I\'m Unable to Make It Today'
    + '</a>'
    + '</div>'
    + '</div>'
    + '</div>';

  await logAndDispatchEmail(booking, event, recipient, participant.full_name, 'reminder', subject, bodyHtml);
}

// Core Email Dispatcher via Supabase Brevo RPC
async function logAndDispatchEmail(booking, event, recipientEmail, recipientName, type, subject, bodyHtml) {
  try {
    const { data, error } = await supabase.rpc('send_brevo_email', {
      p_recipient_email: recipientEmail,
      p_recipient_name: recipientName || 'Participant',
      p_subject: subject,
      p_html_content: bodyHtml,
      p_event_id: event?.id || null,
      p_booking_id: booking?.id || null,
      p_email_type: type
    });

    if (error) {
      console.error('Brevo email dispatch error:', error);
    } else {
      console.log('✉️ Email dispatched to Brevo:', data);
    }
  } catch (err) {
    console.error('Error in logAndDispatchEmail:', err);
  }
}

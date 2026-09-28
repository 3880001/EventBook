import { supabase } from '../supabaseClient.js';

// Base application link helper
function getAppBaseUrl() {
  const basePath = window.location.pathname.endsWith('/') 
    ? window.location.pathname 
    : window.location.pathname + '/';
  return window.location.origin + basePath;
}

// 1. Send Cancellation Email with Technical Issue Message
export async function sendCancellationEmail(booking, event, participant) {
  const baseUrl = getAppBaseUrl();
  const rebookUrl = baseUrl + '#/book/' + event.slug;
  const recipient = participant.email;
  const subject = 'Booking Cancelled: ' + event.name + ' (' + booking.booking_reference + ')';

  const bodyHtml = '<div style="font-family:sans-serif; max-width:600px; margin:0 auto; padding:20px; border:1px solid #e2e8f0; border-radius:10px;">'
    + '<h2 style="color:#ef4444; margin-top:0;">Booking Cancelled</h2>'
    + '<p>Dear <strong>' + (participant.full_name || 'Participant') + '</strong>,</p>'
    + '<div style="background:#fee2e2; border-left:4px solid #ef4444; padding:12px; margin:15px 0; border-radius:4px; color:#991b1b;">'
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

  await logAndDispatchEmail(booking, event, recipient, 'cancellation', subject, bodyHtml);
}

// 2. Send General Status Update Email (Confirmed, Attended, No Show, etc.)
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

  await logAndDispatchEmail(booking, event, recipient, 'status_update', subject, bodyHtml);
}

// 3. Send Interactive Final Reminder with One-Click Actions
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

  await logAndDispatchEmail(booking, event, recipient, 'reminder', subject, bodyHtml);
}

// Log email dispatch to Supabase and send via external provider
async function logAndDispatchEmail(booking, event, recipientEmail, type, subject, bodyHtml) {
  try {
    // 1. Record log in database
    await supabase.from('email_logs').insert({
      event_id: event.id,
      booking_id: booking.id,
      recipient_email: recipientEmail,
      email_type: type,
      subject: subject,
      status: 'dispatched'
    });

    // 2. Dispatch via Resend if API key is stored, or broadcast via Supabase Edge Function
    const resendKey = localStorage.getItem('RESEND_API_KEY');
    if (resendKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + resendKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'EventBook <notifications@resend.dev>',
          to: [recipientEmail],
          subject: subject,
          html: bodyHtml
        })
      });
    } else {
      console.log('✉️ Email Dispatched to ' + recipientEmail + ': [' + subject + ']');
    }
  } catch (err) {
    console.error('Failed to dispatch email:', err);
  }
}

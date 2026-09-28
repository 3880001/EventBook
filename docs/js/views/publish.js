import { supabase } from '../supabaseClient.js';
import { toast, generateQRCodeDataURI } from '../utils/ui.js';
import { sendCancellationEmail, sendStatusUpdateEmail } from '../utils/emailService.js';

export async function renderPublishPage(container, { param: eventId }) {
  container.innerHTML = '<div class="loader-center"><div class="spinner"></div></div>';

  const { data: event, error: eventErr } = await supabase
    .from('events')
    .select('*, event_dates (*), event_custom_fields (*), timeslots (*)')
    .eq('id', eventId)
    .single();

  if (eventErr || !event) {
    container.innerHTML = '<div class="card"><p style="color:var(--danger)">Failed to load event: ' + (eventErr?.message || 'Event not found') + '</p></div>';
    return;
  }

  const { data: bookingsData } = await supabase
    .from('bookings')
    .select('id, booking_reference, status, attendance_confirmed, created_at, custom_responses, timeslot_id, participant_profiles ( full_name, email, phone )')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  let bookingsList = bookingsData || [];
  const timeslotsList = event.timeslots || [];
  const isFullDay = (event.event_dates && event.event_dates.some(d => d.is_full_day)) || (event.slot_duration_minutes >= 480);

  const basePath = window.location.pathname.endsWith('/') 
    ? window.location.pathname 
    : window.location.pathname + '/';
  const publicBookingURL = window.location.origin + basePath + '#/book/' + event.slug;
  const qrCodeData = generateQRCodeDataURI(publicBookingURL);

  let searchTerm = '';

  function renderView() {
    const confirmedCount = bookingsList.filter(b => b.status === 'confirmed' || b.status === 'attended' || b.status === 'running_late' || b.status === 'arrived').length;
    const cancelledCount = bookingsList.filter(b => b.status === 'cancelled').length;
    const noShowCount = bookingsList.filter(b => b.status === 'no_show').length;

    const rawSlotCount = timeslotsList.length;
    const totalSlots = rawSlotCount > 0 
      ? rawSlotCount 
      : (isFullDay ? (event.event_dates?.length || 1) * (event.parallel_tracks || 1) : 0);

    const bookedSlots = confirmedCount;
    const availableSlots = Math.max(0, totalSlots - bookedSlots);

    const filteredBookings = bookingsList.filter(b => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const name = (b.participant_profiles?.full_name || '').toLowerCase();
      const email = (b.participant_profiles?.email || '').toLowerCase();
      const ref = (b.booking_reference || '').toLowerCase();
      return name.includes(term) || email.includes(term) || ref.includes(term);
    });

    let tableRowsHtml = '';
    if (filteredBookings.length === 0) {
      tableRowsHtml = '<tr><td colspan="6" style="text-align:center; padding:2.5rem 1rem; color:var(--text-muted);">'
        + (searchTerm ? 'No attendees match your search query.' : 'No attendees have registered yet. Share the booking link above to receive bookings.')
        + '</td></tr>';
    } else {
      for (let i = 0; i < filteredBookings.length; i++) {
        const b = filteredBookings[i];
        const participant = b.participant_profiles || {};

        let slotTimeStr = isFullDay ? 'Whole Day Session' : 'Scheduled Appointment';
        let slotObj = timeslotsList.find(s => s.id === b.timeslot_id);
        if (slotObj && slotObj.start_time) {
          const startStr = new Date(slotObj.start_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
          const trackTag = slotObj.track_number ? (' • Track ' + slotObj.track_number) : '';
          slotTimeStr = startStr + trackTag;
        } else if (event.event_dates && event.event_dates[0]) {
          slotTimeStr = new Date(event.event_dates[0].event_date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ' (Whole Day)';
        }

        let customInfoHtml = '<span style="color:var(--text-muted);">-</span>';
        if (b.custom_responses && typeof b.custom_responses === 'object' && Object.keys(b.custom_responses).length > 0) {
          const entries = Object.entries(b.custom_responses);
          customInfoHtml = entries.map(([k, v]) => '<div style="font-size:0.8rem;"><strong>' + k + ':</strong> ' + v + '</div>').join('');
        }

        const currentStatus = b.attendance_confirmed ? 'attended' : b.status;

        tableRowsHtml += '<tr style="border-bottom:1px solid var(--border-color);">'
          + '<td style="padding:0.85rem 0.5rem; font-family:monospace; font-weight:700; color:var(--primary); white-space:nowrap;">'
          + '<a href="#/ticket/' + b.booking_reference + '" target="_blank" title="View digital ticket" style="text-decoration:none; color:inherit;">'
          + b.booking_reference + ' ↗'
          + '</a>'
          + '</td>'
          + '<td style="padding:0.85rem 0.5rem; font-weight:600; color:var(--text-primary);">'
          + (participant.full_name || 'Guest')
          + '</td>'
          + '<td style="padding:0.85rem 0.5rem; font-size:0.85rem; color:var(--text-muted);">'
          + '<div>' + (participant.email || 'N/A') + '</div>'
          + (participant.phone ? '<div style="font-size:0.75rem; margin-top:2px;">' + participant.phone + '</div>' : '')
          + '</td>'
          + '<td style="padding:0.85rem 0.5rem; font-size:0.85rem; white-space:nowrap;">'
          + '<span style="font-weight:600;">' + slotTimeStr + '</span>'
          + '</td>'
          + '<td style="padding:0.85rem 0.5rem;">'
          + customInfoHtml
          + '</td>'
          + '<td style="padding:0.85rem 0.5rem; text-align:right; white-space:nowrap;">'
          + '<div style="display:inline-flex; align-items:center; gap:0.5rem;">'
          + '<select class="form-control form-control-sm select-booking-status" data-id="' + b.id + '" data-slot-id="' + (b.timeslot_id || '') + '" style="font-size:0.8rem; padding:0.25rem 0.5rem; width:135px; border-radius:6px; font-weight:600;">'
          + '<option value="confirmed"' + (currentStatus === 'confirmed' ? ' selected' : '') + '>Confirmed</option>'
          + '<option value="attended"' + (currentStatus === 'attended' || currentStatus === 'arrived' ? ' selected' : '') + '>✓ Attended</option>'
          + '<option value="running_late"' + (currentStatus === 'running_late' ? ' selected' : '') + '>🟡 Running Late</option>'
          + '<option value="no_show"' + (currentStatus === 'no_show' ? ' selected' : '') + '>No Show</option>'
          + '<option value="cancelled"' + (currentStatus === 'cancelled' ? ' selected' : '') + '>Cancelled</option>'
          + '</select>'
          + '<button type="button" class="btn btn-sm btn-delete-booking" data-id="' + b.id + '" data-slot-id="' + (b.timeslot_id || '') + '" data-ref="' + b.booking_reference + '" title="Cancel & Delete booking" style="background:#fee2e2; color:#ef4444; border:1px solid #fca5a5; padding:0.25rem 0.5rem; border-radius:6px; cursor:pointer;">'
          + '🗑️'
          + '</button>'
          + '</div>'
          + '</td>'
          + '</tr>';
      }
    }

    container.innerHTML = '<div style="max-width:1100px; margin:0 auto; padding-bottom:3rem;">'
      + '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">'
      + '<div>'
      + '<a href="#/events" style="text-decoration:none; color:var(--text-muted); font-size:0.875rem;">&larr; Back to Events</a>'
      + '<h1 style="font-size:1.75rem; font-weight:700; margin-top:0.25rem;">'
      + event.name + ' '
      + '<span class="badge ' + (event.status === 'published' ? 'badge-success' : 'badge-neutral') + '">' + event.status + '</span>'
      + '</h1>'
      + '<p style="color:var(--text-muted); font-size:0.9rem;">' + (event.location_details || 'Online') + ' &bull; ' + (isFullDay ? 'Whole Day Event' : (event.slot_duration_minutes + 'm slots')) + '</p>'
      + '</div>'
      + '<div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">'
      + '<button id="btn-email-setup" class="btn btn-secondary btn-sm" style="display:inline-flex; align-items:center; gap:0.35rem;">⚙️ Email Setup</button>'
      + '<a href="#/edit/' + event.id + '" class="btn btn-secondary btn-sm" style="display:inline-flex; align-items:center; gap:0.35rem;">'
      + '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>'
      + 'Edit Event'
      + '</a>'
      + '<button id="btn-export-csv" class="btn btn-secondary btn-sm">Export CSV</button>'
      + '<button id="btn-toggle-status" class="btn ' + (event.status === 'published' ? 'btn-danger' : 'btn-primary') + ' btn-sm">'
      + (event.status === 'published' ? 'Unpublish' : 'Publish')
      + '</button>'
      + '</div>'
      + '</div>'

      // Public Access Card
      + '<div class="card" style="background:#f8fafc; border:1px solid var(--border-color); padding:1.5rem; margin-bottom:1.5rem;">'
      + '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1.25rem;">'
      + '<div style="flex:1; min-width:280px;">'
      + '<label class="form-label" style="margin-bottom:0.4rem;">Booking Link</label>'
      + '<div style="display:flex; gap:0.5rem; align-items:center;">'
      + '<input type="text" id="input-booking-link" class="form-control" value="' + publicBookingURL + '" readonly style="background:#ffffff; font-family:monospace; font-size:0.9rem;" />'
      + '<button id="btn-copy-inline" class="btn btn-secondary" style="white-space:nowrap; gap:0.35rem;">'
      + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>'
      + 'Copy Link'
      + '</button>'
      + '</div>'
      + '<div style="margin-top:0.85rem; font-size:0.9rem; display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">'
      + '<span style="color:var(--text-muted); font-weight:500;">Passcode:</span>'
      + '<span id="text-passcode-val" style="font-family:monospace; font-weight:700; background:#e2e8f0; padding:4px 10px; border-radius:4px; letter-spacing:0.5px; font-size:0.95rem;">' + (event.passcode_plain || '******') + '</span>'
      + '<button type="button" id="btn-copy-passcode" class="btn btn-secondary btn-sm" style="display:inline-flex; align-items:center; gap:0.35rem; padding:0.3rem 0.75rem; font-size:0.8rem; font-weight:600;">'
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>'
      + 'Copy Passcode'
      + '</button>'
      + '</div>'
      + '</div>'
      + '<div style="text-align:center;">'
      + '<img src="' + qrCodeData + '" alt="QR Code" style="width:90px; height:90px; background:#fff; border-radius:8px; padding:4px; border:1px solid var(--border-color);" />'
      + '<div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.25rem;">Scan to Book</div>'
      + '</div>'
      + '</div>'
      + '</div>'

      // Metrics Grid
      + '<div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); margin-bottom:1.5rem;">'
      + '<div class="card" style="margin-bottom:0; text-align:center;">'
      + '<span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">TOTAL SLOTS</span>'
      + '<div style="font-size:2rem; font-weight:700; margin-top:0.25rem;">' + totalSlots + '</div>'
      + '</div>'
      + '<div class="card" style="margin-bottom:0; text-align:center;">'
      + '<span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">BOOKED</span>'
      + '<div style="font-size:2rem; font-weight:700; color:var(--primary); margin-top:0.25rem;">' + bookedSlots + '</div>'
      + '</div>'
      + '<div class="card" style="margin-bottom:0; text-align:center;">'
      + '<span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">AVAILABLE</span>'
      + '<div style="font-size:2rem; font-weight:700; color:var(--success); margin-top:0.25rem;">' + availableSlots + '</div>'
      + '</div>'
      + '<div class="card" style="margin-bottom:0; text-align:center;">'
      + '<span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">CANCELLED</span>'
      + '<div style="font-size:2rem; font-weight:700; color:var(--warning); margin-top:0.25rem;">' + cancelledCount + '</div>'
      + '</div>'
      + '<div class="card" style="margin-bottom:0; text-align:center;">'
      + '<span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">NO SHOW</span>'
      + '<div style="font-size:2rem; font-weight:700; color:var(--danger); margin-top:0.25rem;">' + noShowCount + '</div>'
      + '</div>'
      + '</div>'

      // Detailed Attendee Roster Table Card
      + '<div class="card" style="margin-bottom:2rem;">'
      + '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:1rem;">'
      + '<div>'
      + '<h2 style="font-size:1.25rem; font-weight:700; margin:0;">Attendee Roster (' + bookingsList.length + ')</h2>'
      + '<p style="color:var(--text-muted); font-size:0.85rem; margin-top:0.25rem;">Manage attendance, update statuses, or delete bookings</p>'
      + '</div>'
      + '<div>'
      + '<input type="text" id="input-roster-search" class="form-control form-control-sm" placeholder="Search attendees..." value="' + searchTerm + '" style="width:220px;" />'
      + '</div>'
      + '</div>'

      + '<div class="table-responsive">'
      + '<table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.9rem;">'
      + '<thead>'
      + '<tr style="border-bottom:2px solid var(--border-color); color:var(--text-muted); font-size:0.8rem; text-transform:uppercase; letter-spacing:0.5px;">'
      + '<th style="padding:0.75rem 0.5rem;">REF #</th>'
      + '<th style="padding:0.75rem 0.5rem;">ATTENDEE</th>'
      + '<th style="padding:0.75rem 0.5rem;">CONTACT</th>'
      + '<th style="padding:0.75rem 0.5rem;">SLOT / TIME</th>'
      + '<th style="padding:0.75rem 0.5rem;">CUSTOM INFO</th>'
      + '<th style="padding:0.75rem 0.5rem; text-align:right;">STATUS & ACTIONS</th>'
      + '</tr>'
      + '</thead>'
      + '<tbody>'
      + tableRowsHtml
      + '</tbody>'
      + '</table>'
      + '</div>'
      + '</div>'

      // Brevo Email Setup Modal
      + '<div id="email-setup-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center; padding:1rem;">'
      + '<div class="card" style="max-width:500px; width:100%; padding:2rem; border-radius:12px; background:#fff;">'
      + '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">'
      + '<h3 style="margin:0; font-size:1.25rem;">⚙️ Brevo Email Service</h3>'
      + '<button id="btn-close-modal" class="btn btn-secondary btn-sm" style="border:none; font-size:1.2rem; cursor:pointer;">✕</button>'
      + '</div>'
      + '<p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:1.25rem;">Configure your free Brevo API key and sender address. All emails will dispatch reliably through your account.</p>'
      + '<div class="form-group">'
      + '<label class="form-label">Brevo API Key (xkeysib-...)</label>'
      + '<input type="password" id="cfg-brevo-key" class="form-control" placeholder="xkeysib-..." />'
      + '</div>'
      + '<div class="form-group">'
      + '<label class="form-label">Verified Brevo Sender Email</label>'
      + '<input type="email" id="cfg-brevo-sender" class="form-control" placeholder="your-email@gmail.com" />'
      + '</div>'
      + '<div class="form-group">'
      + '<label class="form-label">Sender Name</label>'
      + '<input type="text" id="cfg-brevo-name" class="form-control" placeholder="EventBook" value="EventBook" />'
      + '</div>'
      + '<div style="display:flex; justify-content:space-between; margin-top:1.5rem; gap:0.5rem;">'
      + '<button id="btn-test-email" class="btn btn-secondary btn-sm">Send Test Email</button>'
      + '<button id="btn-save-email-cfg" class="btn btn-primary btn-sm">Save Brevo Settings</button>'
      + '</div>'
      + '</div>'
      + '</div>'

      + '</div>';

    bindInteractions();
  }

  function bindInteractions() {
    const copyLinkBtn = document.getElementById('btn-copy-inline');
    if (copyLinkBtn) {
      copyLinkBtn.onclick = () => {
        navigator.clipboard.writeText(publicBookingURL);
        toast('Booking link copied to clipboard!', 'success');
      };
    }

    const copyPassBtn = document.getElementById('btn-copy-passcode');
    if (copyPassBtn) {
      copyPassBtn.onclick = () => {
        navigator.clipboard.writeText(event.passcode_plain || '');
        toast('Passcode copied to clipboard!', 'success');
      };
    }

    const toggleStatusBtn = document.getElementById('btn-toggle-status');
    if (toggleStatusBtn) {
      toggleStatusBtn.onclick = async () => {
        const nextStatus = event.status === 'published' ? 'draft' : 'published';
        await supabase.from('events').update({ status: nextStatus }).eq('id', event.id);
        toast('Event status changed to ' + nextStatus, 'info');
        renderPublishPage(container, { param: eventId });
      };
    }

    // Email Modal Handlers
    const emailModal = document.getElementById('email-setup-modal');
    const openEmailBtn = document.getElementById('btn-email-setup');
    const closeEmailBtn = document.getElementById('btn-close-modal');

    if (openEmailBtn) {
      openEmailBtn.onclick = async () => {
        const { data: sData } = await supabase.from('app_settings').select('*');
        if (sData) {
          const keyRow = sData.find(r => r.key === 'brevo_api_key');
          const emailRow = sData.find(r => r.key === 'brevo_sender_email');
          const nameRow = sData.find(r => r.key === 'brevo_sender_name');
          if (keyRow) document.getElementById('cfg-brevo-key').value = keyRow.value;
          if (emailRow) document.getElementById('cfg-brevo-sender').value = emailRow.value;
          if (nameRow) document.getElementById('cfg-brevo-name').value = nameRow.value;
        }
        emailModal.style.display = 'flex';
      };
    }

    if (closeEmailBtn) closeEmailBtn.onclick = () => { emailModal.style.display = 'none'; };

    const saveEmailBtn = document.getElementById('btn-save-email-cfg');
    if (saveEmailBtn) {
      saveEmailBtn.onclick = async () => {
        const apiKey = document.getElementById('cfg-brevo-key').value.trim();
        const senderEmail = document.getElementById('cfg-brevo-sender').value.trim();
        const senderName = document.getElementById('cfg-brevo-name').value.trim() || 'EventBook';

        if (!apiKey || !senderEmail) return alert('Please enter both your Brevo API key and sender email.');

        saveEmailBtn.disabled = true;
        const { error } = await supabase.rpc('save_brevo_settings', {
          p_api_key: apiKey,
          p_sender_email: senderEmail,
          p_sender_name: senderName
        });

        saveEmailBtn.disabled = false;
        if (error) {
          toast('Error saving settings: ' + error.message, 'danger');
        } else {
          toast('Brevo credentials saved successfully!', 'success');
          emailModal.style.display = 'none';
        }
      };
    }

    const testEmailBtn = document.getElementById('btn-test-email');
    if (testEmailBtn) {
      testEmailBtn.onclick = async () => {
        const targetEmail = prompt('Enter recipient email for the test message:');
        if (!targetEmail) return;

        testEmailBtn.innerText = 'Dispatching...';
        testEmailBtn.disabled = true;

        const { data, error } = await supabase.rpc('send_brevo_email', {
          p_recipient_email: targetEmail,
          p_recipient_name: 'Tester',
          p_subject: 'EventBook Brevo Connection Test',
          p_html_content: '<h2>🎉 Brevo Connection Successful!</h2><p>Your EventBook application can now deliver emails to participant inboxes.</p>'
        });

        testEmailBtn.innerText = 'Send Test Email';
        testEmailBtn.disabled = false;

        if (error || (data && data.success === false)) {
          alert('Test failed: ' + (error?.message || data?.error));
        } else {
          alert('✓ Test email dispatched via Brevo! Please check ' + targetEmail);
        }
      };
    }

    // Export CSV
    const exportCsvBtn = document.getElementById('btn-export-csv');
    if (exportCsvBtn) {
      exportCsvBtn.onclick = () => {
        if (bookingsList.length === 0) return alert('No booking records to export.');
        const headers = ['Booking Reference', 'Participant Name', 'Email', 'Phone', 'Status', 'Attendance Confirmed', 'Custom Details', 'Booked At'];
        const rows = bookingsList.map(b => [
          b.booking_reference,
          '"' + (b.participant_profiles?.full_name || '') + '"',
          b.participant_profiles?.email || '',
          b.participant_profiles?.phone || '',
          b.status,
          b.attendance_confirmed ? 'YES' : 'NO',
          '"' + JSON.stringify(b.custom_responses || {}).replace(/"/g, '""') + '"',
          b.created_at
        ]);
        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', event.slug + '-attendees.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };
    }

    const searchInput = document.getElementById('input-roster-search');
    if (searchInput) {
      searchInput.oninput = (e) => {
        searchTerm = e.target.value.trim();
        renderView();
        const reSearch = document.getElementById('input-roster-search');
        if (reSearch) {
          reSearch.focus();
          reSearch.setSelectionRange(reSearch.value.length, reSearch.value.length);
        }
      };
    }

    // Status Selector Change Handler with Brevo Notifications
    document.querySelectorAll('.select-booking-status').forEach(sel => {
      sel.onchange = async () => {
        const bookingId = sel.dataset.id;
        const slotId = sel.dataset.slotId;
        const newStatus = sel.value;
        const isAttended = (newStatus === 'attended');

        sel.disabled = true;
        const { error: updErr } = await supabase
          .from('bookings')
          .update({
            status: newStatus,
            attendance_confirmed: isAttended,
            updated_at: new Date().toISOString()
          })
          .eq('id', bookingId);

        if (updErr) {
          toast('Failed to update status: ' + updErr.message, 'danger');
          sel.disabled = false;
          return;
        }

        if (newStatus === 'cancelled' && slotId) {
          await supabase.from('timeslots').update({ status: 'available' }).eq('id', slotId);
        } else if (newStatus !== 'cancelled' && slotId) {
          await supabase.from('timeslots').update({ status: 'booked' }).eq('id', slotId);
        }

        const bItem = bookingsList.find(b => b.id === bookingId);
        const participantObj = bItem?.participant_profiles;
        if (participantObj) {
          if (newStatus === 'cancelled') {
            sendCancellationEmail(bItem, event, participantObj);
          } else {
            sendStatusUpdateEmail(bItem, event, participantObj, newStatus);
          }
        }

        if (bItem) {
          bItem.status = newStatus;
          bItem.attendance_confirmed = isAttended;
        }

        toast('Status updated to ' + newStatus + ' & email dispatched!', 'success');
        renderView();
      };
    });

    // Delete Booking Handler with Cancellation Notice
    document.querySelectorAll('.btn-delete-booking').forEach(btn => {
      btn.onclick = async () => {
        const bookingId = btn.dataset.id;
        const slotId = btn.dataset.slotId;
        const ref = btn.dataset.ref;

        if (!confirm('Are you sure you want to cancel and delete booking ' + ref + '? A cancellation email will be sent to the participant.')) {
          return;
        }

        btn.disabled = true;

        const bItem = bookingsList.find(b => b.id === bookingId);
        if (bItem?.participant_profiles) {
          sendCancellationEmail(bItem, event, bItem.participant_profiles);
        }

        const { error: delErr } = await supabase
          .from('bookings')
          .delete()
          .eq('id', bookingId);

        if (delErr) {
          toast('Delete failed: ' + delErr.message, 'danger');
          btn.disabled = false;
          return;
        }

        if (slotId) {
          await supabase.from('timeslots').update({ status: 'available' }).eq('id', slotId);
        }

        bookingsList = bookingsList.filter(b => b.id !== bookingId);
        toast('Booking ' + ref + ' cancelled and deleted.', 'info');
        renderView();
      };
    });
  }

  renderView();
}

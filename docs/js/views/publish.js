import { supabase } from '../supabaseClient.js';
import { toast, generateQRCodeDataURI } from '../utils/ui.js';
import { sendCancellationEmail, sendStatusUpdateEmail } from '../utils/emailService.js';
import { formatEventTime, formatEventDate } from '../utils/eventEngine.js';

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
  const eventTimezone = event.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Toronto';
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
        + (searchTerm ? 'No attendees match your search query.' : 'No attendees registered yet. Share the booking link above to receive bookings.')
        + '</td></tr>';
    } else {
      for (let i = 0; i < filteredBookings.length; i++) {
        const b = filteredBookings[i];
        const participant = b.participant_profiles || {};

        let slotTimeStr = isFullDay ? 'Whole Day Session' : 'Scheduled Appointment';
        let slotObj = timeslotsList.find(s => s.id === b.timeslot_id);
        if (slotObj && slotObj.start_time) {
          const startStr = formatEventTime(slotObj.start_time, eventTimezone);
          const dateStr = formatEventDate(slotObj.start_time, eventTimezone, { month: 'short', day: 'numeric' });
          const trackTag = slotObj.track_number ? (' • Track ' + slotObj.track_number) : '';
          slotTimeStr = dateStr + ' at ' + startStr + trackTag;
        } else if (event.event_dates && event.event_dates[0]) {
          slotTimeStr = formatEventDate(event.event_dates[0].event_date + 'T12:00:00Z', eventTimezone) + ' (Whole Day)';
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
          + '<button type="button" class="btn btn-sm btn-delete-booking" data-id="' + b.id + '" data-slot-id="' + (b.timeslot_id || '') + '" data-ref="' + b.booking_reference + '" title="Cancel booking" style="background:#fee2e2; color:#ef4444; border:1px solid #fca5a5; padding:0.25rem 0.5rem; border-radius:6px; cursor:pointer;">'
          + '🗑️'
          + '</button>'
          + '</div>'
          + '</td>'
          + '</tr>';
      }
    }

    const realPasscode = (event.passcode_plain || event.passcode_hash || '').trim();

    container.innerHTML = '<div style="max-width:1100px; margin:0 auto; padding-bottom:3rem;">'
      + '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">'
      + '<div>'
      + '<a href="#/events" style="text-decoration:none; color:var(--text-muted); font-size:0.875rem;">&larr; Back to Events</a>'
      + '<h1 style="font-size:1.75rem; font-weight:700; margin-top:0.25rem;">'
      + event.name + ' '
      + '<span class="badge ' + (event.status === 'published' ? 'badge-success' : 'badge-neutral') + '">' + event.status + '</span>'
      + '</h1>'
      + '<p style="color:var(--text-muted); font-size:0.9rem;">' 
      + (event.location_details || 'Online') + ' &bull; ' 
      + (isFullDay ? 'Whole Day Event' : (event.slot_duration_minutes + 'm slots')) + ' &bull; '
      + '<strong>🌐 ' + eventTimezone + '</strong>'
      + '</p>'
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
      + '<span style="color:var(--text-muted); font-weight:600;">Passcode:</span>'
      + (realPasscode 
          ? '<span id="text-passcode-val" style="font-family:monospace; font-weight:700; background:#e2e8f0; color:#0f172a; padding:4px 10px; border-radius:6px; letter-spacing:1px; font-size:1rem;">' + realPasscode + '</span>'
            + '<button type="button" id="btn-copy-passcode" class="btn btn-secondary btn-sm" style="display:inline-flex; align-items:center; gap:0.35rem; padding:0.3rem 0.75rem; font-size:0.8rem; font-weight:600;">'
            + 'Copy Passcode'
            + '</button>'
            + '<button type="button" id="btn-edit-passcode" class="btn btn-secondary btn-sm" style="font-size:0.8rem; padding:0.3rem 0.75rem;">✏️ Edit</button>'
          : '<span style="color:var(--text-muted); font-style:italic;">None (Public Access)</span>'
            + '<button type="button" id="btn-edit-passcode" class="btn btn-primary btn-sm" style="font-size:0.8rem; padding:0.3rem 0.75rem;">+ Set Passcode</button>'
        )
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

      // Detailed Attendee Roster Table
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

      + '</div>';

    bindInteractions(realPasscode);
  }

  function bindInteractions(currentPasscode) {
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
        if (!currentPasscode) return;
        navigator.clipboard.writeText(currentPasscode);
        toast('Passcode "' + currentPasscode + '" copied!', 'success');
      };
    }

    const editPassBtn = document.getElementById('btn-edit-passcode');
    if (editPassBtn) {
      editPassBtn.onclick = async () => {
        const entered = prompt('Enter new passcode (or leave blank to remove):', currentPasscode);
        if (entered === null) return;
        const val = entered.trim();
        await supabase.from('events').update({ passcode_plain: val || null, passcode_hash: val || '' }).eq('id', event.id);
        event.passcode_plain = val || null;
        event.passcode_hash = val || '';
        toast('Passcode updated!', 'success');
        renderView();
      };
    }

    const toggleStatusBtn = document.getElementById('btn-toggle-status');
    if (toggleStatusBtn) {
      toggleStatusBtn.onclick = async () => {
        const nextStatus = event.status === 'published' ? 'draft' : 'published';
        await supabase.from('events').update({ status: nextStatus }).eq('id', event.id);
        toast('Status updated to ' + nextStatus, 'info');
        renderPublishPage(container, { param: eventId });
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

    document.querySelectorAll('.select-booking-status').forEach(sel => {
      sel.onchange = async () => {
        const bookingId = sel.dataset.id;
        const slotId = sel.dataset.slotId;
        const newStatus = sel.value;
        const isAttended = (newStatus === 'attended');

        sel.disabled = true;
        await supabase.from('bookings').update({ status: newStatus, attendance_confirmed: isAttended, updated_at: new Date().toISOString() }).eq('id', bookingId);
        
        if (newStatus === 'cancelled' && slotId) {
          await supabase.from('timeslots').update({ status: 'available' }).eq('id', slotId);
        } else if (newStatus !== 'cancelled' && slotId) {
          await supabase.from('timeslots').update({ status: 'booked' }).eq('id', slotId);
        }

        const bItem = bookingsList.find(b => b.id === bookingId);
        if (bItem?.participant_profiles) {
          if (newStatus === 'cancelled') sendCancellationEmail(bItem, event, bItem.participant_profiles);
          else sendStatusUpdateEmail(bItem, event, bItem.participant_profiles, newStatus);
        }

        toast('Status updated to ' + newStatus, 'success');
        renderPublishPage(container, { param: eventId });
      };
    });

    document.querySelectorAll('.btn-delete-booking').forEach(btn => {
      btn.onclick = async () => {
        const bookingId = btn.dataset.id;
        const slotId = btn.dataset.slotId;
        const ref = btn.dataset.ref;

        if (!confirm('Cancel and delete booking ' + ref + '?')) return;
        btn.disabled = true;

        const bItem = bookingsList.find(b => b.id === bookingId);
        if (bItem?.participant_profiles) sendCancellationEmail(bItem, event, bItem.participant_profiles);

        await supabase.from('bookings').delete().eq('id', bookingId);
        if (slotId) await supabase.from('timeslots').update({ status: 'available' }).eq('id', slotId);

        toast('Booking deleted.', 'info');
        renderPublishPage(container, { param: eventId });
      };
    });
  }

  renderView();
}

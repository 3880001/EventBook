import { supabase } from '../supabaseClient.js';
import { toast, generateQRCodeDataURI } from '../utils/ui.js';
import { sendBookingConfirmationEmail } from '../utils/emailService.js';
import { formatLocationHtml } from '../utils/location.js';
import { isEventPast, getCustomFields, getEventPasscode, hasEventPasscode } from '../utils/eventEngine.js';

export async function renderBookingPage(container, { param: slug, query }) {
  if (!slug) {
    container.innerHTML = '<div class="card"><p style="color:var(--danger);">Invalid booking link.</p></div>';
    return;
  }

  container.innerHTML = '<div class="loader-center"><div class="spinner"></div></div>';

  const { data: event, error: eventErr } = await supabase
    .from('events')
    .select('*, event_dates (*), event_custom_fields (*)')
    .eq('slug', slug)
    .single();

  if (eventErr || !event) {
    container.innerHTML = '<div class="card" style="text-align:center; padding:3rem 1rem;">'
      + '<h2 style="font-size:1.5rem; font-weight:700;">Event Not Found</h2>'
      + '<p style="color:var(--text-muted); margin-top:0.5rem;">This event may have been removed or the URL is incorrect.</p>'
      + '</div>';
    return;
  }

  if (event.status !== 'published') {
    container.innerHTML = '<div class="card" style="text-align:center; padding:3rem 1rem;">'
      + '<h2 style="font-size:1.5rem; font-weight:700;">Event Unavailable</h2>'
      + '<p style="color:var(--text-muted); margin-top:0.5rem;">This event is currently in draft mode or unpublished.</p>'
      + '</div>';
    return;
  }

  // Universal Past Check
  if (isEventPast(event)) {
    container.innerHTML = '<div style="max-width:550px; margin:4rem auto; padding:0 1rem;">'
      + '<div class="card" style="text-align:center; padding:3rem 1.5rem; border-radius:16px;">'
      + '<div style="font-size:2.25rem; margin-bottom:1rem;">⏳</div>'
      + '<h1 style="font-size:1.6rem; font-weight:700; margin-bottom:0.5rem;">' + event.name + '</h1>'
      + '<div style="display:inline-block; background:#e2e8f0; color:#334155; font-size:0.8rem; font-weight:700; padding:4px 12px; border-radius:6px; margin-bottom:1rem; text-transform:uppercase;">'
      + 'Event Concluded'
      + '</div>'
      + '<p style="color:var(--text-muted); font-size:0.95rem; line-height:1.5;">'
      + 'This event has concluded and registrations are now closed.'
      + '</p>'
      + '<div style="margin-top:2rem;">'
      + '<a href="#/events" class="btn btn-secondary btn-sm" style="text-decoration:none;">View My Events</a>'
      + '</div>'
      + '</div>'
      + '</div>';
    return;
  }

  // Universal Passcode Gate
  const passcode = getEventPasscode(event);
  const requiresPasscode = hasEventPasscode(event);
  const passcodeStorageKey = 'passcode_unlocked_' + event.id;

  if (query && query.get('relock') === 'true') {
    sessionStorage.removeItem(passcodeStorageKey);
  }

  const isUnlocked = !requiresPasscode || sessionStorage.getItem(passcodeStorageKey) === 'true';

  if (!isUnlocked) {
    renderPasscodeGate(container, event, passcode, () => {
      sessionStorage.setItem(passcodeStorageKey, 'true');
      renderBookingPage(container, { param: slug, query: new URLSearchParams() });
    });
    return;
  }

  await renderBookingWorkspace(container, event, requiresPasscode);
}

function renderPasscodeGate(container, event, expectedPasscode, onUnlock) {
  container.innerHTML = '<div style="max-width:440px; margin:4rem auto; padding:0 1rem;">'
    + '<div class="card" style="text-align:center; padding:2.5rem 1.75rem; border:1px solid var(--border-color); border-radius:16px;">'
    + '<div style="display:inline-flex; align-items:center; justify-content:center; width:64px; height:64px; border-radius:18px; background:var(--primary-light); color:var(--primary); font-size:1.75rem; margin-bottom:1.25rem;">'
    + '🔒'
    + '</div>'
    + '<h1 style="font-size:1.45rem; font-weight:700; margin:0 0 0.5rem 0;">Private Event</h1>'
    + '<p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:1.75rem; line-height:1.5;">'
    + 'This event is protected by the organizer. Please enter the passcode to access event details and reserve a timeslot.'
    + '</p>'
    + '<form id="passcode-form">'
    + '<div class="form-group" style="text-align:left;">'
    + '<label class="form-label" style="font-weight:600;">Event Passcode</label>'
    + '<input type="password" id="input-event-passcode" class="form-control" placeholder="Enter access passcode" autocomplete="off" required autofocus style="text-align:center; font-size:1.15rem; letter-spacing:1.5px; font-weight:700; padding:0.65rem;" />'
    + '</div>'
    + '<button type="submit" id="btn-unlock-passcode" class="btn btn-primary" style="width:100%; padding:0.75rem; font-size:1rem; font-weight:600; margin-top:0.5rem;">'
    + 'Unlock & View Details &rarr;'
    + '</button>'
    + '</form>'
    + '</div>'
    + '</div>';

  const form = document.getElementById('passcode-form');
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const entered = (document.getElementById('input-event-passcode')?.value || '').trim();
      if (entered.toLowerCase() === expectedPasscode.toLowerCase()) {
        toast('Passcode accepted!', 'success');
        onUnlock();
      } else {
        toast('Incorrect passcode. Please try again.', 'danger');
        const inp = document.getElementById('input-event-passcode');
        if (inp) {
          inp.value = '';
          inp.focus();
        }
      }
    };
  }
}

async function renderBookingWorkspace(container, event, hasPasscode) {
  let selectedSlot = null;
  let activeDateId = event.event_dates && event.event_dates[0] ? event.event_dates[0].id : null;
  let activeTrack = 'all';

  const isFullDayEvent = (event.event_dates && event.event_dates.some(d => d.is_full_day)) || (event.slot_duration_minutes >= 480);

  async function loadTimeslots() {
    let { data: slots } = await supabase
      .from('timeslots')
      .select('*')
      .eq('event_id', event.id)
      .order('start_time', { ascending: true })
      .order('track_number', { ascending: true });

    return slots || [];
  }

  let timeslots = await loadTimeslots();
  const customFields = getCustomFields(event);

  function render() {
    const currentSlots = timeslots.filter(s => {
      const matchDate = (!activeDateId || !s.event_date_id || event.event_dates?.length <= 1) ? true : (s.event_date_id === activeDateId);
      const matchTrack = (activeTrack === 'all') ? true : (s.track_number === Number(activeTrack));
      return matchDate && matchTrack;
    });

    currentSlots.sort((a, b) => {
      const diff = new Date(a.start_time) - new Date(b.start_time);
      return diff !== 0 ? diff : (a.track_number - b.track_number);
    });

    const activeDateObj = (event.event_dates && event.event_dates.find(d => d.id === activeDateId)) || (event.event_dates && event.event_dates[0]);

    // Date Tabs
    let datesTabsHtml = '';
    if (event.event_dates && event.event_dates.length > 1) {
      let dateButtons = '';
      for (let i = 0; i < event.event_dates.length; i++) {
        const d = event.event_dates[i];
        const btnClass = (d.id === activeDateId) ? 'btn-primary' : 'btn-secondary';
        const formattedDate = new Date(d.event_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        dateButtons += '<button class="btn ' + btnClass + ' btn-sm btn-filter-date" data-id="' + d.id + '">' + formattedDate + '</button>';
      }
      datesTabsHtml = '<div style="margin-bottom:1.25rem;"><label class="form-label">Select Date</label><div style="display:flex; gap:0.5rem; flex-wrap:wrap;">' + dateButtons + '</div></div>';
    }

    // Track Tabs
    let tracksTabsHtml = '';
    if (!isFullDayEvent && event.parallel_tracks && event.parallel_tracks > 1) {
      const allClass = (activeTrack === 'all') ? 'btn-primary' : 'btn-secondary';
      let trackButtons = '<button class="btn ' + allClass + ' btn-sm btn-filter-track" data-track="all">All Tracks</button>';
      for (let tr = 1; tr <= event.parallel_tracks; tr++) {
        const btnClass = (activeTrack === String(tr)) ? 'btn-primary' : 'btn-secondary';
        trackButtons += '<button class="btn ' + btnClass + ' btn-sm btn-filter-track" data-track="' + tr + '">Track ' + tr + '</button>';
      }
      tracksTabsHtml = '<div style="margin-bottom:1.25rem;"><label class="form-label">Filter by Track / Room</label><div style="display:flex; gap:0.5rem; flex-wrap:wrap;">' + trackButtons + '</div></div>';
    }

    // Slots Display
    let slotsDisplayHtml = '';
    if (isFullDayEvent) {
      const isBooked = currentSlots.length > 0 && currentSlots[0].status === 'booked';
      const buttonText = selectedSlot ? '✓ Full Day Selected' : 'Select Full Day';
      const buttonClass = selectedSlot ? 'btn-primary' : 'btn-secondary';
      const dateLabel = activeDateObj 
        ? new Date(activeDateObj.event_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        : 'Whole Day Pass';
      const startTimeLabel = activeDateObj && activeDateObj.start_time ? activeDateObj.start_time.slice(0, 5) : '09:00';
      const endTimeLabel = activeDateObj && activeDateObj.end_time ? activeDateObj.end_time.slice(0, 5) : '17:00';

      slotsDisplayHtml = '<div style="background:#f8fafc; border:2px dashed var(--border-color); border-radius:12px; padding:1.25rem; margin-top:0.5rem;">'
        + '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">'
        + '<div>'
        + '<div style="display:inline-block; background:#e0e7ff; color:#3730a3; font-weight:700; font-size:0.75rem; padding:2px 8px; border-radius:4px; text-transform:uppercase; margin-bottom:0.4rem;">Full Day Session</div>'
        + '<h3 style="font-size:1.15rem; font-weight:700; margin:0;">' + dateLabel + '</h3>'
        + '<p style="color:var(--text-muted); font-size:0.875rem; margin-top:0.25rem;">Open session attendance from ' + startTimeLabel + ' to ' + endTimeLabel + '.</p>'
        + '</div>'
        + '<div>' + (isBooked ? '<span class="badge badge-warning">Fully Booked</span>' : '<button type="button" id="btn-select-fullday" class="btn ' + buttonClass + '" style="padding:0.65rem 1.25rem; font-weight:600;">' + buttonText + '</button>') + '</div>'
        + '</div></div>';
    } else if (currentSlots.length === 0) {
      slotsDisplayHtml = '<div style="text-align:center; padding:2rem 1rem; color:var(--text-muted);"><p>No available timeslots found for this selection.</p></div>';
    } else {
      let slotButtons = '';
      for (let i = 0; i < currentSlots.length; i++) {
        const slot = currentSlots[i];
        const isBooked = slot.status === 'booked';
        const isSelected = selectedSlot && selectedSlot.id === slot.id;
        const btnClass = isSelected ? 'btn-primary' : (isBooked ? 'btn-slot-booked' : 'btn-secondary');
        const startTimeStr = new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const endTimeStr = new Date(slot.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const trackTag = (event.parallel_tracks > 1 && slot.track_number) ? (' • Track ' + slot.track_number) : '';
        const subText = isBooked ? 'Booked' : (endTimeStr + trackTag);

        slotButtons += '<button type="button" class="btn btn-slot ' + btnClass + '" data-slot-id="' + slot.id + '" ' + (isBooked ? 'disabled' : '')
          + ' style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:0.65rem 0.5rem; border-radius:8px; font-size:0.85rem; font-weight:600; cursor:' + (isBooked ? 'not-allowed' : 'pointer') + '; opacity:' + (isBooked ? '0.5' : '1') + ';">'
          + '<span>' + startTimeStr + '</span>'
          + '<span style="font-size:0.75rem; opacity:0.85; font-weight:normal;">' + subText + '</span>'
          + '</button>';
      }
      slotsDisplayHtml = '<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap:0.65rem; margin-top:0.5rem;">' + slotButtons + '</div>';
    }

    // Dynamic Custom Questions HTML (Prominently rendered)
    let customFieldsHtml = '';
    if (customFields.length > 0) {
      customFieldsHtml = '<div style="margin-top:1.25rem; padding-top:1.25rem; border-top:1px dashed var(--border-color);">'
        + '<h3 style="font-size:1rem; font-weight:700; color:var(--text-primary); margin-bottom:0.85rem;">📋 Required Registration Questions</h3>';

      for (let i = 0; i < customFields.length; i++) {
        const cf = customFields[i];
        const isReq = cf.required;
        const reqBadge = isReq 
          ? ' <span style="color:#ef4444; font-weight:700; font-size:0.85rem;">* (Required)</span>' 
          : ' <span style="color:var(--text-muted); font-size:0.8rem;">(Optional)</span>';

        customFieldsHtml += '<div class="form-group" style="margin-bottom:1rem;">'
          + '<label class="form-label" style="font-weight:700; font-size:0.95rem;">' + cf.label + reqBadge + '</label>'
          + '<input type="' + (cf.field_type || 'text') + '" class="form-control custom-field-input" data-label="' + cf.label.replace(/"/g, '&quot;') + '" data-required="' + (isReq ? 'true' : 'false') + '" placeholder="Please provide your ' + cf.label.replace(/"/g, '&quot;') + '" style="background:#fff; border:1px solid #cbd5e1; padding:0.65rem; font-size:0.95rem;" />'
          + '</div>';
      }
      customFieldsHtml += '</div>';
    }

    const durationLabel = isFullDayEvent ? 'Whole Day Event' : (event.slot_duration_minutes + ' Mins Duration');
    
    const passcodeStatusBadge = hasPasscode
      ? '<div style="display:inline-flex; align-items:center; gap:0.4rem; background:#ecfdf5; color:#065f46; padding:4px 10px; border-radius:6px; font-size:0.8rem; font-weight:600;">'
        + '<span>🔒 Passcode Unlocked</span>'
        + '<button type="button" id="btn-relock-event" style="background:none; border:none; color:#047857; text-decoration:underline; font-size:0.8rem; cursor:pointer; font-weight:600; padding:0 2px;" title="Relock this event">[Lock 🔒]</button>'
        + '</div>'
      : '';

    let slotNoticeHtml = '';
    if (selectedSlot) {
      let selectedTimeLabel = 'Whole Day Session';
      if (selectedSlot.start_time) {
        selectedTimeLabel = new Date(selectedSlot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          + ' - ' + new Date(selectedSlot.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      slotNoticeHtml = '<div style="background:#eff6ff; border:1px solid #bfdbfe; color:#1e40af; padding:10px 14px; border-radius:8px; font-size:0.9rem; font-weight:600; margin-bottom:1.25rem;">'
        + '✓ Selected Appointment: <strong>' + selectedTimeLabel + '</strong>'
        + '</div>';
    }

    container.innerHTML = '<div style="max-width:850px; margin:0 auto; padding:1rem 0;">'
      // Card 1: Event Summary
      + '<div class="card" style="margin-bottom:1.5rem;">'
      + '<div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.75rem;">'
      + '<h1 style="font-size:1.75rem; font-weight:700; margin:0;">' + event.name + '</h1>'
      + passcodeStatusBadge
      + '</div>'
      + '<p style="color:var(--text-muted); margin-top:0.5rem; line-height:1.5;">' + (event.description || 'Complete the registration form and choose your timeslot below.') + '</p>'
      + '<div style="display:flex; gap:1.25rem; margin-top:1rem; flex-wrap:wrap; font-size:0.875rem; color:var(--text-muted);">'
      + '<div style="display:flex; align-items:center; gap:0.35rem;">' + formatLocationHtml(event.location_details, 'Online') + '</div>'
      + '<div style="display:flex; align-items:center; gap:0.35rem;"><span>⏱️</span> ' + durationLabel + '</div>'
      + '</div>'
      + '</div>'

      // Card 2: Step 1 - Participant Details & Questions (Prominently First)
      + '<div class="card" id="booking-form-card" style="margin-bottom:1.5rem;">'
      + '<h2 style="font-size:1.25rem; font-weight:700; margin-bottom:0.5rem;">1. Participant Information</h2>'
      + '<p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:1.25rem;">Please provide your attendee contact details and answer any required questions.</p>'
      + '<form id="booking-submit-form" novalidate>'
      + '<div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">'
      + '<div class="form-group">'
      + '<label class="form-label" style="font-weight:600;">Full Name <span style="color:#ef4444;">*</span></label>'
      + '<input type="text" id="p-fullname" class="form-control" placeholder="John Doe" required style="background:#fff;" />'
      + '</div>'
      + '<div class="form-group">'
      + '<label class="form-label" style="font-weight:600;">Email Address <span style="color:#ef4444;">*</span></label>'
      + '<input type="email" id="p-email" class="form-control" placeholder="john@example.com" required style="background:#fff;" />'
      + '</div>'
      + '</div>'
      + '<div class="form-group">'
      + '<label class="form-label">Phone Number <span style="color:var(--text-muted); font-size:0.8rem;">(Optional)</span></label>'
      + '<input type="tel" id="p-phone" class="form-control" placeholder="+1 555-0199" style="background:#fff;" />'
      + '</div>'
      + customFieldsHtml
      + '</div>'

      // Card 3: Step 2 - Choose Appointment Slot
      + '<div class="card" id="slots-card" style="margin-bottom:2rem;">'
      + '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">'
      + '<h2 style="font-size:1.25rem; font-weight:700; margin:0;">2. Select Appointment Timeslot</h2>'
      + '<span style="font-size:0.85rem; color:var(--text-muted); font-weight:600;">' + currentSlots.length + ' Slots Available</span>'
      + '</div>'
      + slotNoticeHtml
      + datesTabsHtml
      + tracksTabsHtml
      + slotsDisplayHtml
      + '<div style="margin-top:2rem; padding-top:1.25rem; border-top:1px solid var(--border-color); display:flex; justify-content:flex-end;">'
      + '<button type="submit" id="btn-submit-booking" class="btn btn-primary" style="padding:0.85rem 2.25rem; font-size:1rem; font-weight:700;">'
      + (selectedSlot ? 'Confirm Booking &rarr;' : 'Select a Slot & Confirm')
      + '</button>'
      + '</div>'
      + '</form>'
      + '</div>'

      + '</div>';

    bindActions(currentSlots, activeDateObj);
  }

  function bindActions(currentSlots, activeDateObj) {
    const relockBtn = document.getElementById('btn-relock-event');
    if (relockBtn) {
      relockBtn.onclick = () => {
        sessionStorage.removeItem('passcode_unlocked_' + event.id);
        toast('Event locked.', 'info');
        renderBookingPage(container, { param: event.slug, query: new URLSearchParams() });
      };
    }

    document.querySelectorAll('.btn-filter-date').forEach(btn => {
      btn.onclick = () => {
        activeDateId = btn.dataset.id;
        selectedSlot = null;
        render();
      };
    });

    document.querySelectorAll('.btn-filter-track').forEach(btn => {
      btn.onclick = () => {
        activeTrack = btn.dataset.track;
        selectedSlot = null;
        render();
      };
    });

    const fullDayBtn = document.getElementById('btn-select-fullday');
    if (fullDayBtn) {
      fullDayBtn.onclick = () => {
        selectedSlot = currentSlots[0] || {
          id: null,
          event_id: event.id,
          start_time: (activeDateObj && activeDateObj.event_date ? activeDateObj.event_date : new Date().toISOString().split('T')[0]) + 'T09:00:00'
        };
        render();
      };
    }

    document.querySelectorAll('.btn-slot:not([disabled])').forEach(btn => {
      btn.onclick = () => {
        const slotId = btn.dataset.slotId;
        selectedSlot = timeslots.find(s => s.id === slotId);
        render();
      };
    });

    const form = document.getElementById('booking-submit-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('btn-submit-booking');

        const nameEl = document.getElementById('p-fullname');
        const emailEl = document.getElementById('p-email');
        const phoneEl = document.getElementById('p-phone');

        const fullName = nameEl?.value.trim() || '';
        const email = emailEl?.value.trim() || '';
        const phone = phoneEl?.value.trim() || '';

        // 1. Validate Base Fields
        if (!fullName) {
          toast('Please enter your full name.', 'danger');
          if (nameEl) {
            nameEl.style.border = '2px solid #ef4444';
            nameEl.focus();
            nameEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return;
        }
        if (nameEl) nameEl.style.border = '';

        if (!email || !email.includes('@')) {
          toast('Please enter a valid email address.', 'danger');
          if (emailEl) {
            emailEl.style.border = '2px solid #ef4444';
            emailEl.focus();
            emailEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return;
        }
        if (emailEl) emailEl.style.border = '';

        // 2. Strict Custom Questions Validation (e.g. "ID")
        const customInputs = document.querySelectorAll('.custom-field-input');
        const customResponses = {};

        for (let i = 0; i < customInputs.length; i++) {
          const inp = customInputs[i];
          const isReq = (inp.dataset.required === 'true');
          const label = inp.dataset.label || 'Question';
          const val = inp.value.trim();

          if (isReq && !val) {
            toast('You are missing required information: ' + label, 'danger');
            inp.style.border = '2px solid #ef4444';
            inp.focus();
            inp.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
          }

          inp.style.border = '';
          if (val) {
            customResponses[label] = val;
          }
        }

        // 3. Ensure a Slot Is Picked
        if (!selectedSlot && !isFullDayEvent) {
          toast('Please select an appointment timeslot.', 'warning');
          const slotsBox = document.getElementById('slots-card');
          if (slotsBox) slotsBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }

        // 4. Save Booking
        submitBtn.disabled = true;
        submitBtn.innerText = 'Securing Booking...';

        try {
          const sysId = 'EB-' + Math.random().toString(36).substring(2, 8).toUpperCase();
          const { data: participant, error: partErr } = await supabase
            .from('participant_profiles')
            .upsert({
              email,
              full_name: fullName,
              phone,
              system_participant_id: sysId
            }, { onConflict: 'email' })
            .select()
            .single();

          if (partErr) throw partErr;

          let targetSlotId = (selectedSlot && selectedSlot.id && selectedSlot.id !== 'fullday-virtual') 
            ? selectedSlot.id 
            : (currentSlots[0] ? currentSlots[0].id : null);

          const bookingRef = 'EB-' + Math.random().toString(36).substring(2, 8).toUpperCase();
          
          const bookingPayload = {
            event_id: event.id,
            participant_id: participant.id,
            booking_reference: bookingRef,
            status: 'confirmed',
            custom_responses: customResponses
          };

          if (targetSlotId) {
            bookingPayload.timeslot_id = targetSlotId;
          }

          const { data: insertedBooking, error: bookErr } = await supabase
            .from('bookings')
            .insert(bookingPayload)
            .select()
            .single();

          if (bookErr) throw bookErr;

          if (targetSlotId) {
            await supabase.from('timeslots').update({ status: 'booked' }).eq('id', targetSlotId);
          }

          sendBookingConfirmationEmail(
            insertedBooking || bookingPayload,
            event,
            participant,
            selectedSlot
          );

          renderConfirmationScreen(container, event, selectedSlot, bookingRef, fullName, activeDateObj);
        } catch (err) {
          toast('Booking failed: ' + err.message, 'danger');
          submitBtn.disabled = false;
          submitBtn.innerText = 'Confirm Booking';
        }
      };
    }
  }

  render();
}

function renderConfirmationScreen(container, event, slot, bookingRef, participantName, activeDateObj) {
  let startStr = 'Whole Day Session';
  if (slot && slot.start_time) {
    startStr = new Date(slot.start_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  } else if (activeDateObj && activeDateObj.event_date) {
    startStr = new Date(activeDateObj.event_date + 'T00:00:00').toLocaleDateString(undefined, { dateStyle: 'medium' });
  }

  const basePath = window.location.pathname.endsWith('/') 
    ? window.location.pathname 
    : window.location.pathname + '/';
  const ticketLiveUrl = window.location.origin + basePath + '#/ticket/' + bookingRef;
  const qrCodeData = generateQRCodeDataURI(ticketLiveUrl);

  container.innerHTML = '<div style="max-width:550px; margin:2rem auto; padding:0 1rem;">'
    + '<div class="card" style="border:2px solid var(--success); text-align:center; padding:2.5rem 1.5rem;">'
    + '<div style="display:inline-flex; align-items:center; justify-content:center; width:64px; height:64px; border-radius:50%; background:#dcfce7; color:var(--success); margin-bottom:1rem;">'
    + '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>'
    + '</div>'
    + '<h1 style="font-size:1.75rem; font-weight:700; margin-bottom:0.25rem;">Booking Confirmed!</h1>'
    + '<p style="color:var(--text-muted); font-size:0.9rem;">Thank you, ' + participantName + '. A confirmation email has been dispatched.</p>'
    + '<div style="background:#f8fafc; border-radius:12px; padding:1.25rem; margin:1.5rem 0; border:1px solid var(--border-color); text-align:left;">'
    + '<div style="display:flex; justify-content:space-between; margin-bottom:0.75rem;">'
    + '<span style="color:var(--text-muted); font-size:0.85rem;">Booking Ref</span>'
    + '<span style="font-family:monospace; font-weight:700; font-size:1rem; color:var(--primary);">' + bookingRef + '</span>'
    + '</div>'
    + '<div style="display:flex; justify-content:space-between; margin-bottom:0.75rem;">'
    + '<span style="color:var(--text-muted); font-size:0.85rem;">Event</span>'
    + '<span style="font-weight:600;">' + event.name + '</span>'
    + '</div>'
    + '<div style="display:flex; justify-content:space-between; margin-bottom:0.75rem;">'
    + '<span style="color:var(--text-muted); font-size:0.85rem;">Date & Time</span>'
    + '<span style="font-weight:600;">' + startStr + '</span>'
    + '</div>'
    + '<div style="display:flex; justify-content:space-between; align-items:center;">'
    + '<span style="color:var(--text-muted); font-size:0.85rem;">Location</span>'
    + '<span style="font-weight:600;">' + formatLocationHtml(event.location_details, 'Online') + '</span>'
    + '</div>'
    + '</div>'
    + '<div style="margin:1.5rem 0;">'
    + '<img src="' + qrCodeData + '" alt="Ticket QR Code" style="width:120px; height:120px; border:1px solid var(--border-color); border-radius:8px; padding:4px;" />'
    + '<div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.35rem;">Scan this QR code to view live digital ticket</div>'
    + '</div>'
    + '<button onclick="window.print()" class="btn btn-secondary btn-sm" style="margin-top:0.5rem;">'
    + '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>'
    + ' Print Confirmation'
    + '</button>'
    + '</div>'
    + '</div>';
}

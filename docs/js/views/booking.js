import { supabase } from '../supabaseClient.js';
import { toast, generateQRCodeDataURI } from '../utils/ui.js';

export async function renderBookingPage(container, { param: slug }) {
  if (!slug) {
    container.innerHTML = '<div class="card"><p style="color:var(--danger);">Invalid booking link.</p></div>';
    return;
  }

  container.innerHTML = '<div class="loader-center"><div class="spinner"></div></div>';

  // 1. Fetch Event by Slug
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

  // 2. Passcode Gate Check
  const passcodeStorageKey = 'passcode_unlocked_' + event.id;
  const isUnlocked = !event.passcode_plain || sessionStorage.getItem(passcodeStorageKey) === 'true';

  if (!isUnlocked) {
    renderPasscodeGate(container, event, () => renderBookingPage(container, { param: slug }));
    return;
  }

  // 3. Render Workspace
  await renderBookingWorkspace(container, event);
}

function renderPasscodeGate(container, event, onUnlock) {
  container.innerHTML = '<div style="max-width:420px; margin:3rem auto; padding:0 1rem;">'
    + '<div class="card" style="text-align:center; padding:2rem;">'
    + '<div style="display:inline-flex; align-items:center; justify-content:center; width:52px; height:52px; border-radius:14px; background:var(--primary-light); color:var(--primary); margin-bottom:1rem;">'
    + '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>'
    + '</div>'
    + '<h1 style="font-size:1.5rem; font-weight:700; margin-bottom:0.25rem;">' + event.name + '</h1>'
    + '<p style="color:var(--text-muted); font-size:0.875rem; margin-bottom:1.5rem;">This event requires a passcode to view and book.</p>'
    + '<form id="passcode-form">'
    + '<div class="form-group" style="text-align:left;">'
    + '<label class="form-label">Event Passcode</label>'
    + '<input type="password" id="input-event-passcode" class="form-control" placeholder="Enter passcode" required autofocus />'
    + '</div>'
    + '<button type="submit" class="btn btn-primary" style="width:100%; margin-top:0.5rem;">Unlock Booking</button>'
    + '</form>'
    + '</div>'
    + '</div>';

  document.getElementById('passcode-form').onsubmit = (e) => {
    e.preventDefault();
    const entered = document.getElementById('input-event-passcode').value.trim();
    if (entered === event.passcode_plain) {
      sessionStorage.setItem('passcode_unlocked_' + event.id, 'true');
      toast('Passcode accepted!', 'success');
      onUnlock();
    } else {
      toast('Incorrect passcode. Please try again.', 'danger');
    }
  };
}

async function renderBookingWorkspace(container, event) {
  let selectedSlot = null;
  let activeDateId = event.event_dates && event.event_dates[0] ? event.event_dates[0].id : null;
  let activeTrack = 'all'; // Default shows all slots across all tracks

  const isFullDayEvent = (event.event_dates && event.event_dates.some(d => d.is_full_day)) || (event.slot_duration_minutes >= 480);

  // Self-Healing Timeslot Loader
  async function loadTimeslots() {
    let { data: slots, error } = await supabase
      .from('timeslots')
      .select('*')
      .eq('event_id', event.id)
      .order('start_time', { ascending: true })
      .order('track_number', { ascending: true });

    // If 0 slots found in database, automatically generate and save them
    if (!slots || slots.length === 0) {
      slots = await generateMissingSlotsClient(event);
    }
    return slots || [];
  }

  // Client-Side Generator Fallback
  async function generateMissingSlotsClient(evt) {
    const duration = evt.slot_duration_minutes || 15;
    const buffer = evt.buffer_minutes || 0;
    const tracks = Math.max(1, evt.parallel_tracks || 1);
    const dates = (evt.event_dates && evt.event_dates.length > 0)
      ? evt.event_dates
      : [{ id: null, event_date: new Date().toISOString().split('T')[0], start_time: '09:00:00', end_time: '17:00:00' }];

    const generated = [];

    dates.forEach(d => {
      const dateStr = d.event_date || new Date().toISOString().split('T')[0];
      const sTime = (d.start_time || '09:00:00').slice(0, 5);
      const eTime = (d.end_time || '17:00:00').slice(0, 5);

      for (let tr = 1; tr <= tracks; tr++) {
        if (isFullDayEvent) {
          generated.push({
            event_id: evt.id,
            event_date_id: d.id || null,
            track_number: tr,
            start_time: dateStr + 'T' + sTime + ':00',
            end_time: dateStr + 'T' + eTime + ':00',
            status: 'available'
          });
        } else {
          let [sH, sM] = sTime.split(':').map(Number);
          let [eH, eM] = eTime.split(':').map(Number);
          let curr = sH * 60 + sM;
          let end = eH * 60 + eM;
          if (end <= curr) end = curr + 480;

          while (curr + duration <= end) {
            const sh = String(Math.floor(curr / 60)).padStart(2, '0');
            const sm = String(curr % 60).padStart(2, '0');
            const eh = String(Math.floor((curr + duration) / 60)).padStart(2, '0');
            const em = String((curr + duration) % 60).padStart(2, '0');

            generated.push({
              event_id: evt.id,
              event_date_id: d.id || null,
              track_number: tr,
              start_time: dateStr + 'T' + sh + ':' + sm + ':00',
              end_time: dateStr + 'T' + eh + ':' + em + ':00',
              status: 'available'
            });

            curr += duration + buffer;
          }
        }
      }
    });

    if (generated.length > 0) {
      const { data: saved } = await supabase.from('timeslots').insert(generated).select();
      if (saved && saved.length > 0) return saved;
    }
    return generated;
  }

  let timeslots = await loadTimeslots();

  function render() {
    // Filter slots by selected date and optional track
    const currentSlots = timeslots.filter(s => {
      const matchDate = (!activeDateId || !s.event_date_id || event.event_dates?.length <= 1) 
        ? true 
        : (s.event_date_id === activeDateId);
      const matchTrack = (activeTrack === 'all') 
        ? true 
        : (s.track_number === Number(activeTrack));
      return matchDate && matchTrack;
    });

    // Sort chronologically by start time, then track number
    currentSlots.sort((a, b) => {
      const diff = new Date(a.start_time) - new Date(b.start_time);
      return diff !== 0 ? diff : (a.track_number - b.track_number);
    });

    const customFields = event.event_custom_fields || [];
    const activeDateObj = (event.event_dates && event.event_dates.find(d => d.id === activeDateId)) || (event.event_dates && event.event_dates[0]);

    // Build Date Filter Tabs (if event spans multiple days)
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

    // Build Track Filter Tabs (with "All Tracks" as default)
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

    // Slots Presentation
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

      let actionBtn = '';
      if (isBooked) {
        actionBtn = '<span class="badge badge-warning" style="padding:0.6rem 1rem; font-size:0.9rem;">Fully Booked</span>';
      } else {
        actionBtn = '<button type="button" id="btn-select-fullday" class="btn ' + buttonClass + '" style="padding:0.65rem 1.25rem; font-weight:600;">' + buttonText + '</button>';
      }

      slotsDisplayHtml = '<div style="background:#f8fafc; border:2px dashed var(--border-color); border-radius:12px; padding:1.5rem; margin-top:0.5rem;">'
        + '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">'
        + '<div>'
        + '<div style="display:inline-block; background:#e0e7ff; color:#3730a3; font-weight:700; font-size:0.75rem; padding:2px 8px; border-radius:4px; text-transform:uppercase; margin-bottom:0.4rem;">Full Day Session</div>'
        + '<h3 style="font-size:1.15rem; font-weight:700; margin:0;">' + dateLabel + '</h3>'
        + '<p style="color:var(--text-muted); font-size:0.875rem; margin-top:0.25rem;">Open session attendance from ' + startTimeLabel + ' to ' + endTimeLabel + '.</p>'
        + '</div>'
        + '<div>' + actionBtn + '</div>'
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
        const cursor = isBooked ? 'not-allowed' : 'pointer';
        const opacity = isBooked ? '0.5' : '1';
        const disabledAttr = isBooked ? 'disabled' : '';
        const trackTag = (event.parallel_tracks > 1 && slot.track_number) ? (' • Track ' + slot.track_number) : '';
        const subText = isBooked ? 'Booked' : (endTimeStr + trackTag);

        slotButtons += '<button type="button" class="btn btn-slot ' + btnClass + '" data-slot-id="' + slot.id + '" ' + disabledAttr
          + ' style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:0.65rem 0.5rem; border-radius:8px; font-size:0.85rem; font-weight:600; cursor:' + cursor + '; opacity:' + opacity + ';">'
          + '<span>' + startTimeStr + '</span>'
          + '<span style="font-size:0.75rem; opacity:0.85; font-weight:normal;">' + subText + '</span>'
          + '</button>';
      }
      slotsDisplayHtml = '<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(145px, 1fr)); gap:0.65rem; margin-top:0.5rem;">' + slotButtons + '</div>';
    }

    // Custom Questions
    let customFieldsHtml = '';
    for (let i = 0; i < customFields.length; i++) {
      const cf = customFields[i];
      const reqStar = cf.required ? ' *' : '';
      const reqAttr = cf.required ? 'required' : '';
      const fType = cf.field_type || 'text';
      customFieldsHtml += '<div class="form-group">'
        + '<label class="form-label">' + cf.label + reqStar + '</label>'
        + '<input type="' + fType + '" class="form-control custom-field-input" data-label="' + cf.label + '" ' + reqAttr + ' />'
        + '</div>';
    }

    const formDisplay = selectedSlot ? 'block' : 'none';
    const durationLabel = isFullDayEvent ? 'Whole Day Event' : (event.slot_duration_minutes + ' Mins Duration');
    const passcodeBadge = event.passcode_plain ? '<div style="display:flex; align-items:center; gap:0.35rem;"><span>🔒</span> Passcode Protected</div>' : '';

    container.innerHTML = '<div style="max-width:850px; margin:0 auto; padding:1rem 0;">'
      + '<div class="card" style="margin-bottom:1.5rem;">'
      + '<h1 style="font-size:1.75rem; font-weight:700;">' + event.name + '</h1>'
      + '<p style="color:var(--text-muted); margin-top:0.35rem; line-height:1.5;">' + (event.description || 'Secure your reservation below.') + '</p>'
      + '<div style="display:flex; gap:1.25rem; margin-top:1rem; flex-wrap:wrap; font-size:0.875rem; color:var(--text-muted);">'
      + '<div style="display:flex; align-items:center; gap:0.35rem;"><span>📍</span> ' + (event.location_details || 'Online') + '</div>'
      + '<div style="display:flex; align-items:center; gap:0.35rem;"><span>⏱️</span> ' + durationLabel + '</div>'
      + passcodeBadge
      + '</div>'
      + '</div>'
      + '<div class="card" style="margin-bottom:1.5rem;">'
      + '<h2 style="font-size:1.25rem; font-weight:600; margin-bottom:1rem;">Select Appointment Slot</h2>'
      + datesTabsHtml
      + tracksTabsHtml
      + slotsDisplayHtml
      + '</div>'
      + '<div class="card" id="booking-form-card" style="display:' + formDisplay + ';">'
      + '<h2 style="font-size:1.25rem; font-weight:600; margin-bottom:1.25rem;">Participant Information</h2>'
      + '<form id="booking-submit-form">'
      + '<div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">'
      + '<div class="form-group">'
      + '<label class="form-label">Full Name *</label>'
      + '<input type="text" id="p-fullname" class="form-control" placeholder="John Doe" required />'
      + '</div>'
      + '<div class="form-group">'
      + '<label class="form-label">Email Address *</label>'
      + '<input type="email" id="p-email" class="form-control" placeholder="john@example.com" required />'
      + '</div>'
      + '</div>'
      + '<div class="form-group">'
      + '<label class="form-label">Phone Number</label>'
      + '<input type="tel" id="p-phone" class="form-control" placeholder="+1 555-0199" />'
      + '</div>'
      + customFieldsHtml
      + '<div style="margin-top:1.5rem; display:flex; justify-content:flex-end;">'
      + '<button type="submit" id="btn-submit-booking" class="btn btn-primary" style="padding:0.75rem 1.5rem; font-weight:600;">Confirm Booking</button>'
      + '</div>'
      + '</form>'
      + '</div>'
      + '</div>';

    bindActions(currentSlots, activeDateObj);
  }

  function bindActions(currentSlots, activeDateObj) {
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
        const formCard = document.getElementById('booking-form-card');
        if (formCard) formCard.scrollIntoView({ behavior: 'smooth' });
      };
    }

    document.querySelectorAll('.btn-slot:not([disabled])').forEach(btn => {
      btn.onclick = () => {
        const slotId = btn.dataset.slotId;
        selectedSlot = timeslots.find(s => s.id === slotId);
        render();
        const formCard = document.getElementById('booking-form-card');
        if (formCard) formCard.scrollIntoView({ behavior: 'smooth' });
      };
    });

    const form = document.getElementById('booking-submit-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('btn-submit-booking');
        submitBtn.disabled = true;
        submitBtn.innerText = 'Securing Booking...';

        const fullName = document.getElementById('p-fullname').value.trim();
        const email = document.getElementById('p-email').value.trim();
        const phone = document.getElementById('p-phone').value.trim();

        const customResponses = {};
        document.querySelectorAll('.custom-field-input').forEach(inp => {
          customResponses[inp.dataset.label] = inp.value.trim();
        });

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

          const { error: bookErr } = await supabase
            .from('bookings')
            .insert(bookingPayload);

          if (bookErr) throw bookErr;

          if (targetSlotId) {
            await supabase.from('timeslots').update({ status: 'booked' }).eq('id', targetSlotId);
          }

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

  // Clean real-time subscription
  const channelName = 'realtime_slots_' + event.id + '_' + Date.now();
  supabase.getChannels().forEach(ch => {
    if (ch.topic.includes(event.id)) supabase.removeChannel(ch);
  });

  supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'timeslots',
        filter: 'event_id=eq.' + event.id
      },
      async () => {
        timeslots = await loadTimeslots();
        render();
      }
    )
    .subscribe();
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
    + '<p style="color:var(--text-muted); font-size:0.9rem;">Thank you, ' + participantName + '. Your reservation is confirmed.</p>'
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
    + '<div style="display:flex; justify-content:space-between;">'
    + '<span style="color:var(--text-muted); font-size:0.85rem;">Location</span>'
    + '<span style="font-weight:600;">' + (event.location_details || 'Online') + '</span>'
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

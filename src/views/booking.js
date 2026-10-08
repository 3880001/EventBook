import { supabase } from '../supabaseClient.js';
import { toast } from '../utils/ui.js';
import { 
  formatEventTime, 
  formatEventDate, 
  isEventPast, 
  getCustomFields 
} from '../utils/eventEngine.js';

/**
 * Universal safe date/time formatters with locked timezone fallback
 */
function safeFormatDate(isoStr, tz) {
  if (typeof formatEventDate === 'function') {
    try { return formatEventDate(isoStr, tz); } catch (e) {}
  }
  try {
    return new Date(isoStr).toLocaleDateString([], { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric', 
      timeZone: tz 
    });
  } catch (e) {
    return new Date(isoStr).toLocaleDateString([], { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }
}

function safeFormatTime(isoStr, tz) {
  if (typeof formatEventTime === 'function') {
    try { return formatEventTime(isoStr, tz); } catch (e) {}
  }
  try {
    return new Date(isoStr).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit', 
      timeZone: tz 
    });
  } catch (e) {
    return new Date(isoStr).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
}

/**
 * Atomic Booking Invocation (Prevents double-booking via PostgreSQL row locking)
 */
async function executeAtomicBooking({ eventId, timeslotId, fullName, email, phone, customResponses }) {
  const { data, error } = await supabase.rpc('book_timeslot_atomic', {
    p_event_id: eventId,
    p_timeslot_id: timeslotId || null,
    p_full_name: fullName.trim(),
    p_email: email.trim().toLowerCase(),
    p_phone: phone ? phone.trim() : null,
    p_custom_responses: customResponses || {}
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data || !data.success) {
    if (data?.error === 'SLOT_ALREADY_BOOKED') {
      throw new Error(data.message || 'This timeslot has just been booked by another attendee. Please select a different time.');
    }
    throw new Error(data?.error || 'Booking reservation could not be completed.');
  }

  return data; // Returns { success: true, booking_id, booking_reference, event_name }
}

/**
 * Main View Renderer for #/book/:slug
 */
export async function renderBookingPage(container, context = {}) {
  container.innerHTML = '<div class="loader-center"><div class="spinner"></div></div>';

  // 1. Resolve slug parameter from route context or URL hash
  const rawHash = window.location.hash.slice(1) || '';
  const hashSlug = (rawHash.split('/book/')[1] || '').split('?')[0];
  const slug = context.param || context.params?.slug || hashSlug;

  if (!slug) {
    container.innerHTML = `
      <div class="card" style="max-width:550px; margin:3rem auto; text-align:center; padding:2.5rem;">
        <h2 style="color:var(--danger); margin-bottom:0.5rem;">Invalid Event Link</h2>
        <p style="color:var(--text-muted); margin-bottom:1.5rem;">No event identifier was provided in the booking link.</p>
        <a href="#/dashboard" class="btn btn-primary btn-sm">Return Home</a>
      </div>
    `;
    return;
  }

  // 2. Fetch Master Event Record
  const { data: event, error: eventErr } = await supabase
    .from('events')
    .select('*')
    .eq('slug', slug)
    .single();

  if (eventErr || !event) {
    container.innerHTML = `
      <div class="card" style="max-width:550px; margin:3rem auto; text-align:center; padding:2.5rem;">
        <h2 style="color:var(--danger); margin-bottom:0.5rem;">Event Not Found</h2>
        <p style="color:var(--text-muted); margin-bottom:1.5rem;">This event schedule may have been deleted, unpublished, or the link is incorrect.</p>
        <a href="#/dashboard" class="btn btn-primary btn-sm">Explore Active Events</a>
      </div>
    `;
    return;
  }

  if (event.status !== 'published') {
    container.innerHTML = `
      <div class="card" style="max-width:550px; margin:3rem auto; text-align:center; padding:2.5rem;">
        <div style="font-size:2.5rem; margin-bottom:0.75rem;">🔒</div>
        <h2 style="margin-bottom:0.5rem;">Registration Closed</h2>
        <p style="color:var(--text-muted); margin-bottom:1.5rem;">This event is currently in draft mode and not accepting public reservations.</p>
        <a href="#/dashboard" class="btn btn-secondary btn-sm">Back to Home</a>
      </div>
    `;
    return;
  }

  const tz = event.timezone || 'America/Toronto';

  // 3. Fetch Timeslots for this Event
  let { data: timeslots, error: slotsErr } = await supabase
    .from('timeslots')
    .select('*')
    .eq('event_id', event.id)
    .order('start_time', { ascending: true });

  timeslots = timeslots || [];

  // Check if event is entirely in the past
  const now = new Date();
  const futureSlots = timeslots.filter(s => new Date(s.end_time) > now);
  const isPast = (typeof isEventPast === 'function' && isEventPast(event)) || (timeslots.length > 0 && futureSlots.length === 0);

  if (isPast) {
    container.innerHTML = `
      <div class="card" style="max-width:550px; margin:3rem auto; text-align:center; padding:2.5rem;">
        <div style="font-size:2.5rem; margin-bottom:0.75rem;">⌛</div>
        <h2 style="margin-bottom:0.5rem;">Event Concluded</h2>
        <p style="color:var(--text-muted); margin-bottom:1.5rem;">All appointment dates for <strong>${event.name}</strong> have concluded. Bookings are closed.</p>
        <a href="#/dashboard" class="btn btn-secondary btn-sm">Back to Dashboard</a>
      </div>
    `;
    return;
  }

  // 4. Resolve Custom Questions
  let questions = [];
  if (typeof getCustomFields === 'function') {
    try { questions = getCustomFields(event) || []; } catch (e) { questions = []; }
  }
  if (!questions || questions.length === 0) {
    if (Array.isArray(event.custom_fields)) {
      questions = event.custom_fields;
    } else if (typeof event.custom_fields === 'string') {
      try { questions = JSON.parse(event.custom_fields); } catch (e) { questions = []; }
    }
  }

  // 5. Passcode Protection Gate
  let isPasscodeVerified = !event.passcode_plain || event.passcode_plain.trim() === '';

  // Local state management
  let currentStage = 1; // 1 = Identity & Questions, 2 = Timeslot Selection
  let attendeeData = {
    fullName: '',
    email: '',
    phone: '',
    customResponses: {}
  };
  let selectedSlotId = null;
  let selectedSlotObj = null;

  function renderPasscodeGate() {
    container.innerHTML = `
      <div style="max-width:480px; margin:3.5rem auto; padding:0 1rem;">
        <div class="card" style="padding:2.5rem 2rem; text-align:center; border-radius:16px;">
          <div style="font-size:2.5rem; margin-bottom:0.75rem;">🔑</div>
          <h2 style="font-size:1.4rem; font-weight:800; margin-bottom:0.35rem;">Protected Event</h2>
          <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:1.5rem;">
            <strong>${event.name}</strong> requires an access passcode provided by the organizer.
          </p>
          <form id="form-passcode-gate">
            <div class="form-group" style="text-align:left;">
              <label class="form-label">Enter Event Passcode</label>
              <input type="password" id="input-event-passcode" class="form-control" placeholder="Passcode" required autofocus />
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%; margin-top:0.5rem; font-weight:700;">
              Unlock Schedule &rarr;
            </button>
          </form>
        </div>
      </div>
    `;

    document.getElementById('form-passcode-gate').onsubmit = (e) => {
      e.preventDefault();
      const entered = document.getElementById('input-event-passcode').value.trim();
      if (entered === event.passcode_plain) {
        isPasscodeVerified = true;
        renderMainBookingView();
      } else {
        toast('Incorrect passcode. Please verify with the organizer.', 'danger');
      }
    };
  }

  // Helper to re-fetch slots on race collision
  async function refreshTimeslots() {
    const { data: updated } = await supabase
      .from('timeslots')
      .select('*')
      .eq('event_id', event.id)
      .order('start_time', { ascending: true });
    if (updated) timeslots = updated;
  }

  function renderMainBookingView() {
    // Group slots by calendar date
    const slotsByDate = {};
    timeslots.forEach(s => {
      const dateKey = safeFormatDate(s.start_time, tz);
      if (!slotsByDate[dateKey]) slotsByDate[dateKey] = [];
      slotsByDate[dateKey].push(s);
    });

    const datesList = Object.keys(slotsByDate);

    // Build dynamic custom fields HTML for Stage 1
    let customFieldsHtml = '';
    if (questions && questions.length > 0) {
      questions.forEach((q, idx) => {
        const qId = q.id || 'q_' + idx;
        const qLabel = q.label || q.question || 'Requirement';
        const isReq = q.required !== false;
        const reqMarker = isReq ? '<span style="color:var(--danger);">*</span>' : '<span style="color:var(--text-muted); font-weight:normal;">(optional)</span>';

        if (q.type === 'select' && Array.isArray(q.options) && q.options.length > 0) {
          let opts = '<option value="">-- Select an option --</option>';
          q.options.forEach(opt => {
            opts += `<option value="${opt}">${opt}</option>`;
          });
          customFieldsHtml += `
            <div class="form-group">
              <label class="form-label">${qLabel} ${reqMarker}</label>
              <select class="form-control custom-field-input" data-qid="${qId}" ${isReq ? 'required' : ''}>
                ${opts}
              </select>
            </div>
          `;
        } else {
          customFieldsHtml += `
            <div class="form-group">
              <label class="form-label">${qLabel} ${reqMarker}</label>
              <input type="${q.type === 'number' ? 'number' : 'text'}" 
                     class="form-control custom-field-input" 
                     data-qid="${qId}" 
                     placeholder="Enter your ${qLabel.toLowerCase()}" 
                     ${isReq ? 'required' : ''} />
            </div>
          `;
        }
      });
    }

    // Build Timeslot Selection Grid HTML for Stage 2
    let timeslotsSectionHtml = '';
    if (datesList.length === 0) {
      timeslotsSectionHtml = `
        <div style="padding:2rem; text-align:center; color:var(--text-muted); background:#f8fafc; border-radius:10px; border:1px dashed var(--border-color);">
          No individual appointment timeslots configured for this event. 
          <div style="font-size:0.85rem; margin-top:4px;">You can confirm an open reservation below.</div>
        </div>
      `;
    } else {
      datesList.forEach(dateStr => {
        const daySlots = slotsByDate[dateStr];
        let slotsButtonsHtml = '';

        daySlots.forEach(s => {
          const isSlotPast = new Date(s.end_time) <= now;
          const isBooked = s.status === 'booked' || isSlotPast;
          const isSelected = selectedSlotId === s.id;
          const timeLabel = `${safeFormatTime(s.start_time, tz)} - ${safeFormatTime(s.end_time, tz)}`;

          let btnClass = 'btn-secondary';
          let btnStyle = 'padding:0.6rem 0.85rem; font-size:0.85rem; font-weight:600; border-radius:8px;';
          
          if (isSelected) {
            btnClass = 'btn-primary';
            btnStyle += ' box-shadow:0 0 0 3px rgba(37,99,235,0.25);';
          }

          slotsButtonsHtml += `
            <button type="button" 
                    class="btn ${btnClass} btn-slot-select" 
                    data-slotid="${s.id}" 
                    data-timelabel="${timeLabel}"
                    data-datelabel="${dateStr}"
                    style="${btnStyle}"
                    ${isBooked ? 'disabled' : ''}>
              ${timeLabel}
              ${isBooked ? '<span style="font-size:0.7rem; display:block; opacity:0.75; font-weight:normal;">Unavailable</span>' : ''}
            </button>
          `;
        });

        timeslotsSectionHtml += `
          <div style="margin-bottom:1.5rem;">
            <div style="font-size:0.95rem; font-weight:700; color:var(--text-primary); margin-bottom:0.75rem; display:flex; align-items:center; gap:0.4rem;">
              <span>📅</span> ${dateStr}
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(170px, 1fr)); gap:0.65rem;">
              ${slotsButtonsHtml}
            </div>
          </div>
        `;
      });
    }

    container.innerHTML = `
      <div style="max-width:960px; margin:0 auto; padding-bottom:4rem;">
        
        <!-- Header & Event Overview Card -->
        <div class="card" style="padding:1.75rem; border-radius:14px; margin-bottom:1.5rem;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
            <div>
              <span class="badge badge-success" style="margin-bottom:0.5rem;">Open for Bookings</span>
              <h1 style="font-size:1.75rem; font-weight:800; margin:0 0 0.4rem 0;">${event.name}</h1>
              ${event.description ? `<p style="color:var(--text-muted); font-size:0.95rem; line-height:1.5; margin:0 0 0.75rem 0;">${event.description}</p>` : ''}
            </div>
          </div>

          <div style="display:flex; flex-wrap:wrap; gap:1.25rem; font-size:0.875rem; color:var(--text-muted); padding-top:0.75rem; border-top:1px solid var(--border-color);">
            ${event.location_details ? `<div>📍 <strong>Location:</strong> ${event.location_details}</div>` : ''}
            <div>⏱️ <strong>Slot Duration:</strong> ${event.slot_duration_minutes} minutes</div>
            <div>🌐 <strong>Event Timezone:</strong> <span style="font-weight:700; color:var(--primary);">${tz}</span></div>
          </div>
        </div>

        <!-- Progress Steps -->
        <div style="display:flex; gap:1rem; margin-bottom:1.5rem;">
          <div style="flex:1; padding:0.75rem 1rem; border-radius:10px; background:${currentStage === 1 ? '#eff6ff' : '#f8fafc'}; border:1px solid ${currentStage === 1 ? 'var(--primary)' : 'var(--border-color)'}; display:flex; align-items:center; gap:0.6rem;">
            <div style="width:26px; height:26px; border-radius:50%; background:${currentStage === 1 ? 'var(--primary)' : '#94a3b8'}; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.8rem;">1</div>
            <div style="font-weight:700; font-size:0.9rem; color:${currentStage === 1 ? 'var(--primary)' : 'var(--text-muted)'};">Your Information</div>
          </div>

          <div style="flex:1; padding:0.75rem 1rem; border-radius:10px; background:${currentStage === 2 ? '#eff6ff' : '#f8fafc'}; border:1px solid ${currentStage === 2 ? 'var(--primary)' : 'var(--border-color)'}; display:flex; align-items:center; gap:0.6rem;">
            <div style="width:26px; height:26px; border-radius:50%; background:${currentStage === 2 ? 'var(--primary)' : '#94a3b8'}; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.8rem;">2</div>
            <div style="font-weight:700; font-size:0.9rem; color:${currentStage === 2 ? 'var(--primary)' : 'var(--text-muted)'};">Select Time & Confirm</div>
          </div>
        </div>

        <!-- STAGE 1: PARTICIPANT IDENTITY & QUESTIONS -->
        <div id="section-stage-1" class="card" style="display:${currentStage === 1 ? 'block' : 'none'}; padding:2rem; border-radius:14px;">
          <h2 style="font-size:1.25rem; font-weight:800; margin-bottom:0.25rem;">Participant Information</h2>
          <p style="color:var(--text-muted); font-size:0.875rem; margin-bottom:1.5rem;">Please provide your contact details and required event information.</p>

          <form id="form-attendee-info">
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:1rem;">
              <div class="form-group">
                <label class="form-label">Full Name <span style="color:var(--danger);">*</span></label>
                <input type="text" id="att-fullname" class="form-control" placeholder="John Doe" value="${attendeeData.fullName}" required />
              </div>

              <div class="form-group">
                <label class="form-label">Email Address <span style="color:var(--danger);">*</span></label>
                <input type="email" id="att-email" class="form-control" placeholder="john@example.com" value="${attendeeData.email}" required />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Phone Number <span style="color:var(--text-muted); font-weight:normal;">(optional)</span></label>
              <input type="tel" id="att-phone" class="form-control" placeholder="+1 (555) 000-0000" value="${attendeeData.phone}" />
            </div>

            ${customFieldsHtml ? `
              <div style="margin-top:1.5rem; padding-top:1.25rem; border-top:1px solid var(--border-color);">
                <div style="font-weight:700; font-size:0.95rem; margin-bottom:1rem;">Additional Event Questions</div>
                ${customFieldsHtml}
              </div>
            ` : ''}

            <div style="display:flex; justify-content:flex-end; margin-top:1.5rem;">
              <button type="submit" class="btn btn-primary" style="padding:0.75rem 1.75rem; font-weight:700;">
                Continue to Time Selection &rarr;
              </button>
            </div>
          </form>
        </div>

        <!-- STAGE 2: TIMESLOT PICKER & CONFIRMATION -->
        <div id="section-stage-2" class="card" style="display:${currentStage === 2 ? 'block' : 'none'}; padding:2rem; border-radius:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:0.75rem;">
            <div>
              <h2 style="font-size:1.25rem; font-weight:800; margin:0 0 0.25rem 0;">Choose Your Appointment Slot</h2>
              <p style="color:var(--text-muted); font-size:0.875rem; margin:0;">All slots displayed in organizer local time: <strong>${tz}</strong></p>
            </div>
            <button type="button" id="btn-edit-attendee" class="btn btn-secondary btn-sm">
              &larr; Edit Details
            </button>
          </div>

          <!-- Verified Attendee Badge -->
          <div style="background:#f1f5f9; border-radius:10px; padding:0.85rem 1.25rem; display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <span style="font-size:0.8rem; color:var(--text-muted); font-weight:600; text-transform:uppercase;">Booking For:</span>
              <div style="font-weight:700; color:var(--text-primary);">${attendeeData.fullName || 'Attendee'} (${attendeeData.email})</div>
            </div>
            <span class="badge badge-primary">Details Verified</span>
          </div>

          <!-- Timeslot Grid -->
          ${timeslotsSectionHtml}

          <!-- Confirmation Bar -->
          <div id="bar-booking-confirm" style="margin-top:2rem; padding-top:1.5rem; border-top:2px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
            <div id="selected-slot-summary" style="font-size:0.95rem; color:var(--text-muted);">
              ${selectedSlotObj ? `Selected: <strong>${selectedSlotObj.dateLabel} at${selectedSlotObj.timeLabel}</strong>` : 'Please click a time slot above to proceed.'}
            </div>

            <button type="button" 
                    id="btn-confirm-atomic-booking" 
                    class="btn btn-primary" 
                    style="padding:0.75rem 2rem; font-weight:700;" 
                    ${(datesList.length > 0 && !selectedSlotId) ? 'disabled' : ''}>
              Confirm Reservation &rarr;
            </button>
          </div>
        </div>

      </div>
    `;

    bindBookingEvents();
  }

  function bindBookingEvents() {
    // Stage 1: Attendee Information Submission
    const formStage1 = document.getElementById('form-attendee-info');
    if (formStage1) {
      formStage1.onsubmit = (e) => {
        e.preventDefault();

        attendeeData.fullName = document.getElementById('att-fullname').value.trim();
        attendeeData.email = document.getElementById('att-email').value.trim();
        attendeeData.phone = document.getElementById('att-phone').value.trim();

        // Collect custom responses
        attendeeData.customResponses = {};
        document.querySelectorAll('.custom-field-input').forEach(input => {
          const qId = input.dataset.qid;
          attendeeData.customResponses[qId] = input.value.trim();
        });

        currentStage = 2;
        renderMainBookingView();
        window.scrollTo({ top: 150, behavior: 'smooth' });
      };
    }

    // Stage 2: Return to edit details
    const btnEdit = document.getElementById('btn-edit-attendee');
    if (btnEdit) {
      btnEdit.onclick = () => {
        currentStage = 1;
        renderMainBookingView();
      };
    }

    // Stage 2: Slot selection buttons
    document.querySelectorAll('.btn-slot-select').forEach(btn => {
      btn.onclick = () => {
        selectedSlotId = btn.dataset.slotid;
        selectedSlotObj = {
          slotId: selectedSlotId,
          timeLabel: btn.dataset.timelabel,
          dateLabel: btn.dataset.datelabel
        };

        // Re-render Stage 2 to update active button styles and unlock confirm button
        renderMainBookingView();
      };
    });

    // Stage 2: Final Atomic Booking Confirmation
    const btnConfirm = document.getElementById('btn-confirm-atomic-booking');
    if (btnConfirm) {
      btnConfirm.onclick = async () => {
        btnConfirm.disabled = true;
        btnConfirm.innerHTML = '<span class="spinner" style="width:16px; height:16px; border-width:2px; display:inline-block; vertical-align:middle; margin-right:6px;"></span> Securing Reservation...';

        try {
          const result = await executeAtomicBooking({
            eventId: event.id,
            timeslotId: selectedSlotId,
            fullName: attendeeData.fullName,
            email: attendeeData.email,
            phone: attendeeData.phone,
            customResponses: attendeeData.customResponses
          });

          toast('Reservation confirmed successfully!', 'success');

          // Non-blocking client confirmation trigger if available
          try {
            const { sendBookingConfirmationEmail } = await import('../utils/emailService.js');
            if (typeof sendBookingConfirmationEmail === 'function') {
              sendBookingConfirmationEmail({
                bookingReference: result.booking_reference,
                eventId: event.id,
                eventName: event.name,
                attendeeName: attendeeData.fullName,
                attendeeEmail: attendeeData.email,
                slotTime: selectedSlotObj ? `${selectedSlotObj.dateLabel} at ${selectedSlotObj.timeLabel} (${tz})` : 'Confirmed Pass'
              }).catch(() => {});
            }
          } catch (e) {
            // Background cron / database triggers handle delivery
          }

          // Route immediately to the verified digital ticket pass
          window.location.hash = '#/ticket/' + result.booking_reference;

        } catch (err) {
          toast(err.message, 'danger');
          btnConfirm.disabled = false;
          btnConfirm.innerText = 'Confirm Reservation →';

          // If the slot was snatched by another user in the same millisecond, refresh timeslots
          if (err.message.includes('booked by another attendee') || err.message.includes('SLOT_ALREADY_BOOKED')) {
            await refreshTimeslots();
            selectedSlotId = null;
            selectedSlotObj = null;
            renderMainBookingView();
          }
        }
      };
    }
  }

  // Initial trigger: Passcode gate or Main Booking
  if (!isPasscodeVerified) {
    renderPasscodeGate();
  } else {
    renderMainBookingView();
  }
}

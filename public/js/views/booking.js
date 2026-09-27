import { supabase, subscribeToEventSlots } from '../supabaseClient.js';
import { toast, openModal, closeModal, generateICSFile } from '../utils/ui.js';

export async function renderBookingPage(container, { param: slug }) {
  // 1. Fetch Event Meta
  const { data: event, error } = await supabase
    .from('events')
    .select(`
      *,
      event_custom_fields (*),
      event_dates (*)
    `)
    .eq('slug', slug)
    .single();

  if (error || !event) {
    container.innerHTML = `<div class="card" style="text-align:center;"><h2>Event Not Found</h2><p>This scheduling link may be invalid or expired.</p></div>`;
    return;
  }

  // Session Passcode Storage Key
  const passcodeKey = `eb_passcode_${event.id}`;
  let verifiedPasscode = sessionStorage.getItem(passcodeKey);

  if (!verifiedPasscode) {
    showPasscodeChallengeModal(event, (validCode) => {
      sessionStorage.setItem(passcodeKey, validCode);
      verifiedPasscode = validCode;
      initBookingWorkspace();
    });
  } else {
    initBookingWorkspace();
  }

  function initBookingWorkspace() {
    container.innerHTML = `
      <div style="max-width:960px; margin:0 auto;">
        <!-- Header Profile Banner -->
        <div class="card" style="border-top: 4px solid var(--primary);">
          <h1 style="font-size:1.75rem; font-weight:700;">${event.name}</h1>
          <p style="color:var(--text-muted); margin-top:0.25rem;">${event.description || ''}</p>
          <div style="margin-top:0.75rem; display:flex; gap:1.25rem; font-size:0.875rem; color:var(--neutral-600); flex-wrap:wrap;">
            <span>📍 ${event.location_details || 'Virtual'}</span>
            <span>⏱️ ${event.slot_duration_minutes} Mins Duration</span>
            <span>🔒 Passcode Protected</span>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr; gap:1.5rem;" id="booking-layout">
          <!-- Main Reservation Column -->
          <div>
            <div class="card">
              <h2 style="font-size:1.2rem; font-weight:600; margin-bottom:1rem;">Select Appointment Slot</h2>
              
              <!-- Date Selector Tabs -->
              <div style="display:flex; gap:0.5rem; overflow-x:auto; padding-bottom:0.5rem; margin-bottom:1.25rem;" id="date-tabs">
                ${event.event_dates.map((d, i) => `
                  <button class="btn btn-secondary btn-sm date-tab-btn ${i === 0 ? 'btn-primary' : ''}" data-date-id="${d.id}" data-date-str="${d.event_date}">
                    ${new Date(d.event_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </button>
                `).join('')}
              </div>

              <!-- Live Slots Grid -->
              <div id="slots-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap:0.75rem;">
                <div class="loader-center"><div class="spinner"></div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Load Timeslots for initial date
    if (event.event_dates && event.event_dates.length > 0) {
      loadSlots(event.event_dates[0].id);
    }

    // Subscribe to Realtime Updates
    subscribeToEventSlots(event.id, () => {
      const activeDateBtn = document.querySelector('.date-tab-btn.btn-primary');
      if (activeDateBtn) loadSlots(activeDateBtn.dataset.dateId);
    });

    // Date Switchers
    document.querySelectorAll('.date-tab-btn').forEach(btn => {
      btn.onclick = (e) => {
        document.querySelectorAll('.date-tab-btn').forEach(b => b.classList.remove('btn-primary'));
        e.target.classList.add('btn-primary');
        loadSlots(e.target.dataset.dateId);
      };
    });
  }

  async function loadSlots(dateId) {
    const grid = document.getElementById('slots-grid');
    grid.innerHTML = '<div class="spinner"></div>';

    const { data: slots, error: slotErr } = await supabase
      .from('timeslots')
      .select('*')
      .eq('event_date_id', dateId)
      .order('start_time', { ascending: true });

    if (slotErr || !slots) {
      grid.innerHTML = '<p>Unable to retrieve available slots.</p>';
      return;
    }

    if (slots.length === 0) {
      grid.innerHTML = '<p style="color:var(--text-muted);">No slots generated for this date window.</p>';
      return;
    }

    grid.innerHTML = slots.map(s => {
      const isAvailable = s.status === 'available';
      const timeStr = new Date(s.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `
        <button 
          class="btn ${isAvailable ? 'btn-secondary' : 'btn-neutral'} slot-pill-btn" 
          ${isAvailable ? '' : 'disabled'}
          data-slot-id="${s.id}"
          data-time="${timeStr}"
          style="min-height:54px; flex-direction:column; padding:0.4rem; ${!isAvailable ? 'opacity:0.4; cursor:not-allowed;' : ''}">
          <span style="font-weight:700; font-size:0.95rem;">${timeStr}</span>
          <span style="font-size:0.7rem; text-transform:uppercase;">${isAvailable ? 'Track ' + s.track_number : s.status}</span>
        </button>
      `;
    }).join('');

    // Attach click events
    grid.querySelectorAll('.slot-pill-btn:not([disabled])').forEach(btn => {
      btn.onclick = () => showBookingReservationModal(btn.dataset.slotId, btn.dataset.time);
    });
  }

  function showBookingReservationModal(slotId, timeStr) {
    const modalContent = `
      <div class="modal-content">
        <h2 style="font-size:1.25rem; font-weight:700; margin-bottom:0.5rem;">Confirm Appointment</h2>
        <p style="font-size:0.875rem; color:var(--text-muted); margin-bottom:1.25rem;">Slot: <strong>${timeStr}</strong> &bull; ${event.name}</p>

        <form id="form-complete-booking">
          <div class="form-group">
            <label class="form-label">Full Name *</label>
            <input type="text" id="p-name" class="form-control" required placeholder="Jane Doe" />
          </div>
          <div class="form-group">
            <label class="form-label">Email Address *</label>
            <input type="email" id="p-email" class="form-control" required placeholder="jane@example.com" />
          </div>
          <div class="form-group">
            <label class="form-label">Phone Number</label>
            <input type="tel" id="p-phone" class="form-control" placeholder="+1 (555) 000-0000" />
          </div>

          ${event.participant_id_type === 'physical_verification' ? `
            <div class="form-group">
              <label class="form-label">Badge / Physical Verification ID *</label>
              <input type="text" id="p-phys-id" class="form-control" required placeholder="BADGE-99182" />
            </div>
          ` : ''}

          <!-- Custom Fields Render -->
          ${(event.event_custom_fields || []).map(f => `
            <div class="form-group">
              <label class="form-label">${f.label}${f.required ? '*' : ''}</label>
              <input type="${f.field_type === 'number' ? 'number' : 'text'}" 
                     class="form-control dyn-custom-field" 
                     data-label="${f.label}" 
                     ${f.required ? 'required' : ''} />
            </div>
          `).join('')}

          <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1.5rem;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-modal">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-submit-booking">Lock & Book</button>
          </div>
        </form>
      </div>
    `;

    openModal(modalContent);
    document.getElementById('btn-cancel-modal').onclick = closeModal;

    document.getElementById('form-complete-booking').onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btn-submit-booking');
      submitBtn.disabled = true;
      submitBtn.innerText = 'Locking Slot...';

      // Gather custom fields
      const responses = {};
      document.querySelectorAll('.dyn-custom-field').forEach(input => {
        responses[input.dataset.label] = input.value;
      });

      const payload = {
        p_event_id: event.id,
        p_timeslot_id: slotId,
        p_passcode: verifiedPasscode,
        p_participant_name: document.getElementById('p-name').value.trim(),
        p_participant_email: document.getElementById('p-email').value.trim(),
        p_participant_phone: document.getElementById('p-phone').value.trim(),
        p_physical_id: event.participant_id_type === 'physical_verification' ? document.getElementById('p-phys-id').value.trim() : null,
        p_custom_responses: responses
      };

      // Call Atomic Reservation Function
      const { data, error: rpcErr } = await supabase.rpc('book_slot_atomic', payload);

      if (rpcErr || !data.success) {
        alert(data?.message || rpcErr?.message || 'Slot collision occurred. Please select another slot.');
        submitBtn.disabled = false;
        submitBtn.innerText = 'Lock & Book';
        return;
      }

      // Success Display Popup
      closeModal();
      showConfirmationModal(data, event);
    };
  }

  function showConfirmationModal(bookingResult, eventMeta) {
    const icsContent = generateICSFile({
      title: eventMeta.name,
      description: `Appointment reference: ${bookingResult.booking_reference}`,
      location: eventMeta.location_details || 'Online',
      start: bookingResult.start_time,
      end: bookingResult.end_time
    });

    const modalHTML = `
      <div class="modal-content" style="text-align:center;">
        <div style="width:56px; height:56px; border-radius:50%; background:var(--success-light); color:var(--success); display:inline-flex; align-items:center; justify-content:center; margin-bottom:1rem;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <h2 style="font-size:1.5rem; font-weight:700;">Booking Confirmed!</h2>
        <p style="color:var(--text-muted); font-size:0.9rem; margin-top:0.25rem;">Reference Code: <strong style="color:var(--primary); font-family:monospace;">${bookingResult.booking_reference}</strong></p>
        
        <div class="card" style="background:var(--neutral-50); text-align:left; margin:1.25rem 0; padding:1rem; font-size:0.875rem;">
          <div><strong>Participant ID:</strong> ${bookingResult.participant_system_id}</div>
          <div><strong>Track Assigned:</strong> Track ${bookingResult.track_number}</div>
          <div><strong>Window:</strong> ${new Date(bookingResult.start_time).toLocaleString()}</div>
        </div>

        <div style="display:flex; flex-direction:column; gap:0.5rem;">
          <a href="data:text/calendar;charset=utf8,${encodeURIComponent(icsContent)}" download="event-booking.ics" class="btn btn-secondary">
            📅 Download .ICS Calendar File
          </a>
          <button class="btn btn-primary" id="btn-done-booking">Done</button>
        </div>
      </div>
    `;

    openModal(modalHTML);
    document.getElementById('btn-done-booking').onclick = () => {
      closeModal();
      const activeDateBtn = document.querySelector('.date-tab-btn.btn-primary');
      if (activeDateBtn) loadSlots(activeDateBtn.dataset.dateId);
    };
  }

  function showPasscodeChallengeModal(eventMeta, onSuccess) {
    const modalHTML = `
      <div class="modal-content" style="text-align:center;">
        <h2 style="font-size:1.35rem; font-weight:700;">Enter Passcode</h2>
        <p style="color:var(--text-muted); font-size:0.875rem; margin-top:0.25rem;">This event requires a passcode provided by the organizer.</p>
        <div style="margin:1.5rem 0;">
          <input type="password" id="input-challenge-passcode" class="form-control" placeholder="Enter 6-digit passcode" style="text-align:center; font-size:1.25rem; letter-spacing:0.25rem;" autofocus />
        </div>
        <button id="btn-submit-passcode" class="btn btn-primary" style="width:100%;">Unlock Event</button>
      </div>
    `;
    openModal(modalHTML);

    document.getElementById('btn-submit-passcode').onclick = () => {
      const code = document.getElementById('input-challenge-passcode').value.trim();
      if (!code) return alert('Passcode is required.');
      closeModal();
      onSuccess(code);
    };
  }
}

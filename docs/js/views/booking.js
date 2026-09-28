import { supabase } from '../supabaseClient.js';
import { toast, generateQRCodeDataURI } from '../utils/ui.js';

export async function renderBookingPage(container, { param: slug }) {
  if (!slug) {
    container.innerHTML = `<div class="card"><p style="color:var(--danger);">Invalid booking link.</p></div>`;
    return;
  }

  // 1. Fetch Event by Slug
  const { data: event, error: eventErr } = await supabase
    .from('events')
    .select(`
      *,
      event_dates (*),
      event_custom_fields (*)
    `)
    .eq('slug', slug)
    .single();

  if (eventErr || !event) {
    container.innerHTML = `
      <div class="card" style="text-align:center; padding:3rem 1rem;">
        <h2 style="font-size:1.5rem; font-weight:700;">Event Not Found</h2>
        <p style="color:var(--text-muted); margin-top:0.5rem;">This event may have been deleted or the link is incorrect.</p>
      </div>
    `;
    return;
  }

  if (event.status !== 'published') {
    container.innerHTML = `
      <div class="card" style="text-align:center; padding:3rem 1rem;">
        <h2 style="font-size:1.5rem; font-weight:700;">Event Unavailable</h2>
        <p style="color:var(--text-muted); margin-top:0.5rem;">This event is currently in draft mode or has been unpublished by the organizer.</p>
      </div>
    `;
    return;
  }

  // 2. Check Passcode Protection Gate
  const passcodeStorageKey = `passcode_unlocked_${event.id}`;
  const isUnlocked = !event.passcode_plain || sessionStorage.getItem(passcodeStorageKey) === 'true';

  if (!isUnlocked) {
    renderPasscodeGate(container, event, () => renderBookingPage(container, { param: slug }));
    return;
  }

  // 3. Render Main Booking Interface
  await renderBookingWorkspace(container, event);
}

function renderPasscodeGate(container, event, onUnlock) {
  container.innerHTML = `
    <div style="max-width:420px; margin:3rem auto; padding:0 1rem;">
      <div class="card" style="text-align:center; padding:2rem;">
        <div style="display:inline-flex; align-items:center; justify-content:center; width:52px; height:52px; border-radius:14px; background:var(--primary-light); color:var(--primary); margin-bottom:1rem;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        </div>
        <h1 style="font-size:1.5rem; font-weight:700; margin-bottom:0.25rem;">${event.name}</h1>
        <p style="color:var(--text-muted); font-size:0.875rem; margin-bottom:1.5rem;">This event requires a passcode to view and book.</p>

        <form id="passcode-form">
          <div class="form-group" style="text-align:left;">
            <label class="form-label">Event Passcode</label>
            <input type="password" id="input-event-passcode" class="form-control" placeholder="Enter passcode" required autofocus />
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; margin-top:0.5rem;">Unlock Booking</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('passcode-form').onsubmit = (e) => {
    e.preventDefault();
    const entered = document.getElementById('input-event-passcode').value.trim();
    if (entered === event.passcode_plain) {
      sessionStorage.setItem(`passcode_unlocked_${event.id}`, 'true');
      toast('Passcode accepted!', 'success');
      onUnlock();
    } else {
      toast('Incorrect passcode. Please try again.', 'danger');
    }
  };
}

async function renderBookingWorkspace(container, event) {
  let selectedSlot = null;
  let activeDateId = event.event_dates?.[0]?.id || null;
  let activeTrack = 1;

  const isFullDayEvent = (event.event_dates && event.event_dates.some(d => d.is_full_day)) || (event.slot_duration_minutes >= 480);

  async function loadTimeslots() {
    const { data: slots, error } = await supabase
      .from('timeslots')
      .select('*')
      .eq('event_id', event.id)
      .order('start_time', { ascending: true });
    
    if (error) {
      console.error('Failed to load slots:', error);
      return [];
    }
    return slots || [];
  }

  let timeslots = await loadTimeslots();

  function render() {
    const currentSlots = timeslots.filter(s => {
      const matchDate = activeDateId ? s.event_date_id === activeDateId : true;
      const matchTrack = s.track_number === activeTrack;
      return matchDate && matchTrack;
    });

    const customFields = event.event_custom_fields || [];
    const activeDateObj = event.event_dates?.find(d => d.id === activeDateId) || event.event_dates?.[0];

    container.innerHTML = `
      <div style="max-width:850px; margin:0 auto; padding:1rem 0;">
        <!-- Header Banner -->
        <div class="card" style="margin-bottom:1.5rem;">
          <h1 style="font-size:1.75rem; font-weight:700;">${event.name}</h1>
          <p style="color:var(--text-muted); margin-top:0.35rem; line-height:1.5;">${event.description || 'Secure your reservation below.'}</p>
          <div style="display:flex; gap:1.25rem; margin-top:1rem; flex-wrap:wrap; font-size:0.875rem; color:var(--text-muted);">
            <div style="display:flex; align-items:center; gap:0.35rem;">
              <span>📍</span> ${event.location_details || 'Online'}
            </div>
            <div style="display:flex; align-items:center; gap:0.35rem;">
              <span>⏱️</span> ${isFullDayEvent ? 'Whole Day Event' : `${event.slot_duration_minutes} Mins Duration`}
            </div>
            ${event.passcode_plain ? '<div style="display:flex; align-items:center; gap:0.35rem;"><span>🔒</span> Passcode Protected</div>' : ''}
          </div>
        </div>

        <!-- Appointment / Slot Selection Card -->
        <div class="card" style="margin-bottom:1.5rem;">
          <h2 style="font-size:1.25rem; font-weight:600; margin-bottom:1rem;">Select Appointment Slot</h2>

          <!-- Multi-Date Tabs -->
          ${(event.event_dates?.length > 1) ? `
            <div style="margin-bottom:1.25rem;">
              <label class="form-label">Select Date</label>
              <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                ${event.event_dates.map(d => `
                  <button class="btn ${d.id === activeDateId ? 'btn-primary' : 'btn-secondary'} btn-sm btn-filter-date" data-id="${d.id}">
                    ${new Date(d.event_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </button>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Parallel Tracks Tabs -->
          ${(event.parallel_tracks > 1) ? `
            <div style="margin-bottom:1.25rem;">
              <label class="form-label">Select Track</label>
              <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                ${Array.from({ length: event.parallel_tracks }, (_, i) => i + 1).map(tr => `
                  <button class="btn ${tr === activeTrack ? 'btn-primary' : 'btn-secondary'} btn-sm btn-filter-track" data-track="${tr}">
                    Track ${tr}
                  </button>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- SLOTS DISPLAY -->
          ${isFullDayEvent ? `
            <div style="background:#f8fafc; border:2px dashed var(--border-color); border-radius:12px; padding:1.5rem; margin-top:0.5rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
                <div>
                  <div style="display:inline-block; background:#e0e7ff; color:#3730a3; font-weight:700; font-size:0.75rem; padding:2px 8px; border-radius:4px; text-transform:uppercase; margin-bottom:0.4rem;">
                    Full Day Session
                  </div>
                  <h3 style="font-size:1.15rem; font-weight:700; margin:0;">
                    ${activeDateObj ? new Date(activeDateObj.event_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'Whole Day Pass'}
                  </h3>
                  <p style="color:var(--text-muted); font-size:0.875rem; margin-top:0.25rem;">
                    Open session attendance from ${activeDateObj?.start_time?.slice(0, 5) \vert{}\vert{} '09:00'} to${activeDateObj?.end_time?.slice(0, 5) || '17:00'}.
                  </p>
                </div>

                <div>
                  ${currentSlots.length > 0 && currentSlots[0].status === 'booked' ? `
                    <span class="badge badge-warning" style="padding:0.6rem 1rem; font-size:0.9rem;">Fully Booked</span>
                  ` : `
                    <button 
                      type="button" 
                      id="btn-select-fullday" 
                      class="btn ${selectedSlot ? 'btn-primary' : 'btn-secondary'}"
                      style="padding:0.65rem 1.25rem; font-weight:600;"
                    >
                      ${selectedSlot ? '✓ Full Day Selected' : 'Select Full Day'}
                    </button>
                  `}
                </div>
              </div>
            </div>
          ` : `
            ${currentSlots.length === 0 ? `
              <div style="text-align:center; padding:2rem 1rem; color:var(--text-muted);">
                <p>No available timeslots found for this selection.</p>
              </div>
            ` : `
              <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap:0.6rem; margin-top:0.5rem;">
                ${currentSlots.map(slot => {
                  const isBooked = slot.status === 'booked';
                  const isSelected = selectedSlot?.id === slot.id;
                  const startTimeStr = new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const endTimeStr = new Date(slot.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return `
                    <button 
                      type="button" 
                      class="btn btn-slot ${isSelected ? 'btn-primary' : isBooked ? 'btn-slot-booked' : 'btn-secondary'}" 
                      data-slot-id="${slot.id}"
                      ${isBooked ? 'disabled' : ''}
                      style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:0.6rem 0.4rem; border-radius:8px; font-size:0.825rem; font-weight:600; cursor:${isBooked ? 'not-allowed' : 'pointer'}; opacity:${isBooked ? '0.5' : '1'};"
                    >
                      <span>${startTimeStr}</span>
                      <span style="font-size:0.75rem; opacity:0.85; font-weight:normal;">${isBooked ? 'Booked' : endTimeStr}</span>
                    </button>
                  `;
                }).join('')}
              </div>
            `}
          `}
        </div>

        <!-- Participant Information Form (Revealed when slot is selected) -->
        <div class="card" id="booking-form-card" style="display:${selectedSlot ? 'block' : 'none'};">
          <h2 style="font-size:1.25rem; font-weight:600; margin-bottom:1.25rem;">Participant Information</h2>
          <form id="booking-submit-form">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
              <div class="form-group">
                <label class="form-label">Full Name *</label>
                <input type="text" id="p-fullname" class="form-control" placeholder="John Doe" required />
              </div>
              <div class="form-group">
                <label class="form-label">Email Address *</label>
                <input type="email" id="p-email" class="form-control" placeholder="john@example.com" required />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Phone Number</label>
              <input type="tel" id="p-phone" class="form-control" placeholder="+1 555-0199" />
            </div>

            ${customFields.map((cf) => `
              <div class="form-group">
                <label class="form-label">${cf.label}${cf.required ? '*' : ''}</label>
                <input 
                  type="${cf.field_type || 'text'}" 
                  class="form-control custom-field-input" 
                  data-label="${cf.label}"
                  ${cf.required ? 'required' : ''} 
                />
              </div>
            `).join('')}

            <div style="margin-top:1.5rem; display:flex; justify-content:flex-end;">
              <button type="submit" id="btn-submit-booking" class="btn btn-primary" style="padding:0.75rem 1.5rem; font-weight:600;">
                Confirm Booking
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    bindActions(currentSlots, activeDateObj);
  }

  function bindActions(currentSlots, activeDateObj) {
    // Date filter click
    document.querySelectorAll('.btn-filter-date').forEach(btn => {
      btn.onclick = () => {
        activeDateId = btn.dataset.id;
        selectedSlot = null;
        render();
      };
    });

    // Track filter click
    document.querySelectorAll('.btn-filter-track').forEach(btn => {
      btn.onclick = () => {
        activeTrack = Number(btn.dataset.track);
        selectedSlot = null;
        render();
      };
    });

    // Full Day Selection Button
    const fullDayBtn = document.getElementById('btn-select-fullday');
    if (fullDayBtn) {
      fullDayBtn.onclick = () => {
        selectedSlot = currentSlots[0] || {
          id: 'fullday-virtual',
          event_id: event.id,
          start_time: (activeDateObj?.event_date || new Date().toISOString().split('T')[0]) + 'T09:00:00'
        };
        render();
        const formCard = document.getElementById('booking-form-card');
        if (formCard) formCard.scrollIntoView({ behavior: 'smooth' });
      };
    }

    // Standard slot buttons
    document.querySelectorAll('.btn-slot:not([disabled])').forEach(btn => {
      btn.onclick = () => {
        const slotId = btn.dataset.slotId;
        selectedSlot = timeslots.find(s => s.id === slotId);
        render();
        const formCard = document.getElementById('booking-form-card');
        if (formCard) formCard.scrollIntoView({ behavior: 'smooth' });
      };
    });

    // Form submission
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
          // 1. Upsert participant profile
          const { data: participant, error: partErr } = await supabase
            .from('participant_profiles')
            .upsert({ email, full_name: fullName, phone }, { onConflict: 'email' })
            .select()
            .single();

          if (partErr) throw partErr;

          // 2. Resolve slot ID
          let targetSlotId = selectedSlot.id;
          if (targetSlotId === 'fullday-virtual' || !targetSlotId) {
            const freshSlots = await loadTimeslots();
            targetSlotId = freshSlots[0]?.id;
          }

          // 3. Generate Reference & Insert Booking
          const bookingRef = 'EB-' + Math.random().toString(36).substring(2, 8).toUpperCase();
          const { error: bookErr } = await supabase
            .from('bookings')
            .insert({
              event_id: event.id,
              timeslot_id: targetSlotId,
              participant_id: participant.id,
              booking_reference: bookingRef,
              status: 'confirmed',
              custom_responses: customResponses
            });

          if (bookErr) throw bookErr;

          // 4. Mark slot booked if discrete
          if (targetSlotId && targetSlotId !== 'fullday-virtual') {
            await supabase.from('timeslots').update({ status: 'booked' }).eq('id', targetSlotId);
          }

          renderConfirmationScreen(container, event, selectedSlot, bookingRef, fullName);
        } catch (err) {
          toast('Booking failed: ' + err.message, 'danger');
          submitBtn.disabled = false;
          submitBtn.innerText = 'Confirm Booking';
        }
      };
    }
  }

  // Initial render
  render();

  // Realtime channel listener
  const channelName = `realtime_slots_${event.id}_${Date.now()}`;
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
        filter: `event_id=eq.${event.id}`
      },
      async () => {
        timeslots = await loadTimeslots();
        render();
      }
    )
    .subscribe();
}

function renderConfirmationScreen(container, event, slot, bookingRef, participantName) {
  const startStr = new Date(slot.start_time).toLocaleString([], { dateStyle: 'medium' });
  const qrCodeData = generateQRCodeDataURI(bookingRef);

  container.innerHTML = `
    <div style="max-width:550px; margin:2rem auto; padding:0 1rem;">
      <div class="card" style="border:2px solid var(--success); text-align:center; padding:2.5rem 1.5rem;">
        <div style="display:inline-flex; align-items:center; justify-content:center; width:64px; height:64px; border-radius:50%; background:#dcfce7; color:var(--success); margin-bottom:1rem;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <h1 style="font-size:1.75rem; font-weight:700; margin-bottom:0.25rem;">Booking Confirmed!</h1>
        <p style="color:var(--text-muted); font-size:0.9rem;">Thank you, ${participantName}. Your reservation is confirmed.</p>

        <div style="background:#f8fafc; border-radius:12px; padding:1.25rem; margin:1.5rem 0; border:1px solid var(--border-color); text-align:left;">
          <div style="display:flex; justify-content:space-between; margin-bottom:0.75rem;">
            <span style="color:var(--text-muted); font-size:0.85rem;">Booking Ref</span>
            <span style="font-family:monospace; font-weight:700; font-size:1rem; color:var(--primary);">${bookingRef}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:0.75rem;">
            <span style="color:var(--text-muted); font-size:0.85rem;">Event</span>
            <span style="font-weight:600;">${event.name}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:0.75rem;">
            <span style="color:var(--text-muted); font-size:0.85rem;">Date</span>
            <span style="font-weight:600;">${startStr} (Whole Day)</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="color:var(--text-muted); font-size:0.85rem;">Location</span>
            <span style="font-weight:600;">${event.location_details || 'Online'}</span>
          </div>
        </div>

        <div style="margin:1.5rem 0;">
          <img src="${qrCodeData}" alt="QR" style="width:110px; height:110px; border:1px solid var(--border-color); border-radius:8px; padding:4px;" />
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.35rem;">Show this QR code at check-in</div>
        </div>

        <button onclick="window.print()" class="btn btn-secondary btn-sm" style="margin-top:0.5rem;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          Print Confirmation
        </button>
      </div>
    </div>
  `;
}

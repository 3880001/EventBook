import { supabase } from '../supabaseClient.js';
import { toast } from '../utils/ui.js';

export function renderWizard(container) {
  let step = 1;
  const wizardData = {
    name: '',
    description: '',
    event_type: 'single_day',
    location_type: 'room',
    location_details: '',
    passcode: '',
    allow_flyer_download: true,
    slot_duration_minutes: 15,
    buffer_minutes: 5,
    parallel_tracks: 1,
    max_bookings_per_participant: 1,
    participant_id_type: 'system_generated',
    dates: [{ date: new Date().toISOString().split('T')[0], start_time: '09:00', end_time: '17:00' }],
    custom_fields: []
  };

  function renderCurrentStep() {
    container.innerHTML = `
      <div style="max-width:800px; margin:0 auto;">
        <h1 style="font-size:1.75rem; font-weight:700; margin-bottom:1.5rem;">Create Event</h1>

        <!-- Stepper Indicators matching BRD design -->
        <div class="stepper-header">
          <div class="step-node ${step >= 1 ? 'active' : ''}">
            <div class="step-circle">1</div>
            <span>Basic Info</span>
          </div>
          <div style="flex:1; height:2px; background:${step >= 2 ? 'var(--primary)' : 'var(--neutral-200)'}; margin:0 1rem;"></div>
          <div class="step-node ${step >= 2 ? 'active' : ''}">
            <div class="step-circle">2</div>
            <span>Schedule</span>
          </div>
          <div style="flex:1; height:2px; background:${step >= 3 ? 'var(--primary)' : 'var(--neutral-200)'}; margin:0 1rem;"></div>
          <div class="step-node ${step >= 3 ? 'active' : ''}">
            <div class="step-circle">3</div>
            <span>Participant Fields</span>
          </div>
        </div>

        <div class="card" id="wizard-form-card">
          ${getStepHTML(step, wizardData)}
        </div>
      </div>
    `;

    bindStepEvents();
  }

  function getStepHTML(currentStep, data) {
    if (currentStep === 1) {
      return `
        <h2 style="font-size:1.25rem; font-weight:600; margin-bottom:1.25rem;">Step 1: Basic Information</h2>
        <div class="form-group">
          <label class="form-label">Event Name *</label>
          <input type="text" id="w-name" class="form-control" value="${data.name}" placeholder="e.g. Annual Design Review 2026" required />
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea id="w-desc" class="form-control" rows="3" placeholder="Provide instructions for participants...">${data.description}</textarea>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
          <div class="form-group">
            <label class="form-label">Event Type</label>
            <select id="w-type" class="form-control">
              <option value="single_day" ${data.event_type === 'single_day' ? 'selected' : ''}>Single Day</option>
              <option value="multi_day" ${data.event_type === 'multi_day' ? 'selected' : ''}>Multi Day</option>
              <option value="multi_track" ${data.event_type === 'multi_track' ? 'selected' : ''}>Multi Track</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Location / Link</label>
            <input type="text" id="w-location" class="form-control" value="${data.location_details}" placeholder="Room 402 or Zoom / Meet link" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Passcode Protection *</label>
          <input type="text" id="w-passcode" class="form-control" value="${data.passcode}" placeholder="Leave empty to auto-generate (e.g. 6 digits)" />
          <small style="color:var(--text-muted);">Participants must supply this passcode to unlock booking options.</small>
        </div>
        <div style="display:flex; justify-content:flex-end; margin-top:2rem;">
          <button id="btn-step1-next" class="btn btn-primary">Next: Schedule &rarr;</button>
        </div>
      `;
    }

    if (currentStep === 2) {
      return `
        <h2 style="font-size:1.25rem; font-weight:600; margin-bottom:1.25rem;">Step 2: Schedule & Slots</h2>
        <div id="dates-container">
          ${data.dates.map((d, index) => `
            <div class="card" style="background:var(--neutral-50); border:1px dashed var(--neutral-300); margin-bottom:1rem; padding:1rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                <strong>Date Window #${index + 1}</strong>${data.dates.length > 1 ? `<button class="btn btn-secondary btn-sm btn-remove-date" data-index="${index}">&times; Remove</button>` : ''}
              </div>
              <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:0.75rem;">
                <div>
                  <label class="form-label">Date</label>
                  <input type="date" class="form-control w-date-val" data-index="${index}" value="${d.date}" />
                </div>
                <div>
                  <label class="form-label">Start Time</label>
                  <input type="time" class="form-control w-start-val" data-index="${index}" value="${d.start_time}" />
                </div>
                <div>
                  <label class="form-label">End Time</label>
                  <input type="time" class="form-control w-end-val" data-index="${index}" value="${d.end_time}" />
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        <button id="btn-add-date" class="btn btn-secondary btn-sm" style="margin-bottom:1.5rem;">+ Add Date Window</button>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:1rem;">
          <div class="form-group">
            <label class="form-label">Slot Duration (min)</label>
            <select id="w-slot-duration" class="form-control">
              <option value="10">10 minutes</option>
              <option value="15" selected>15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">60 minutes</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Buffer Time (min)</label>
            <input type="number" id="w-buffer" class="form-control" value="${data.buffer_minutes}" min="0" max="60" />
          </div>
          <div class="form-group">
            <label class="form-label">Parallel Tracks</label>
            <input type="number" id="w-tracks" class="form-control" value="${data.parallel_tracks}" min="1" max="10" />
          </div>
          <div class="form-group">
            <label class="form-label">Max Bookings/User</label>
            <input type="number" id="w-max-bookings" class="form-control" value="${data.max_bookings_per_participant}" min="0" placeholder="0 = unlimited" />
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; margin-top:2rem;">
          <button id="btn-step2-back" class="btn btn-secondary">&larr; Back</button>
          <button id="btn-step2-next" class="btn btn-primary">Next: Custom Fields &rarr;</button>
        </div>
      `;
    }

    if (currentStep === 3) {
      return `
        <h2 style="font-size:1.25rem; font-weight:600; margin-bottom:1.25rem;">Step 3: Participant Fields</h2>
        <div class="form-group">
          <label class="form-label">Identification Method</label>
          <select id="w-id-type" class="form-control">
            <option value="system_generated">System-Generated Participant ID (e.g. EB-8F31B)</option>
            <option value="physical_verification">Physical Verification / Badge Code Required</option>
          </select>
        </div>

        <div style="margin-top:1.5rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
            <label class="form-label" style="margin:0;">Custom Questions (Max 5)</label>
            <button id="btn-add-field" class="btn btn-secondary btn-sm" ${data.custom_fields.length >= 5 ? 'disabled' : ''}>+ Add Field</button>
          </div>
          <div id="custom-fields-container">
            ${data.custom_fields.map((f, i) => `
              <div style="display:flex; gap:0.75rem; align-items:center; margin-bottom:0.75rem;">
                <input type="text" class="form-control cf-label" placeholder="Field Label (e.g. Seat Number)" value="${f.label}" data-index="${i}" required />
                <select class="form-control cf-type" data-index="${i}" style="max-width:130px;">
                  <option value="text" ${f.field_type === 'text' ? 'selected' : ''}>Text</option>
                  <option value="number" ${f.field_type === 'number' ? 'selected' : ''}>Number</option>
                  <option value="email" ${f.field_type === 'email' ? 'selected' : ''}>Email</option>
                </select>
                <label style="display:flex; align-items:center; gap:0.25rem; font-size:0.8rem; white-space:nowrap;">
                  <input type="checkbox" class="cf-req" data-index="${i}" ${f.required ? 'checked' : ''} /> Req
                </label>
                <button class="btn btn-secondary btn-sm btn-del-field" data-index="${i}">&times;</button>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; margin-top:2.5rem; flex-wrap:wrap; gap:1rem;">
          <button id="btn-step3-back" class="btn btn-secondary">&larr; Back</button>
          <div style="display:flex; gap:0.75rem;">
            <button id="btn-save-draft" class="btn btn-secondary">Save Draft</button>
            <button id="btn-publish-final" class="btn btn-primary">Publish Event &rarr;</button>
          </div>
        </div>
      `;
    }
  }

  function bindStepEvents() {
    if (step === 1) {
      document.getElementById('btn-step1-next').onclick = () => {
        const name = document.getElementById('w-name').value.trim();
        if (!name) return alert('Event Name is required.');
        wizardData.name = name;
        wizardData.description = document.getElementById('w-desc').value;
        wizardData.event_type = document.getElementById('w-type').value;
        wizardData.location_details = document.getElementById('w-location').value;
        wizardData.passcode = document.getElementById('w-passcode').value || Math.floor(100000 + Math.random() * 900000).toString();
        step = 2;
        renderCurrentStep();
      };
    } else if (step === 2) {
      document.getElementById('btn-step2-back').onclick = () => { step = 1; renderCurrentStep(); };
      document.getElementById('btn-add-date').onclick = () => {
        wizardData.dates.push({ date: new Date().toISOString().split('T')[0], start_time: '09:00', end_time: '17:00' });
        renderCurrentStep();
      };
      document.querySelectorAll('.btn-remove-date').forEach(b => {
        b.onclick = (e) => {
          wizardData.dates.splice(Number(e.target.dataset.index), 1);
          renderCurrentStep();
        };
      });
      document.getElementById('btn-step2-next').onclick = () => {
        // Collect dates
        document.querySelectorAll('.w-date-val').forEach(el => {
          const idx = el.dataset.index;
          wizardData.dates[idx].date = el.value;
          wizardData.dates[idx].start_time = document.querySelectorAll('.w-start-val')[idx].value;
          wizardData.dates[idx].end_time = document.querySelectorAll('.w-end-val')[idx].value;
        });
        wizardData.slot_duration_minutes = Number(document.getElementById('w-slot-duration').value);
        wizardData.buffer_minutes = Number(document.getElementById('w-buffer').value);
        wizardData.parallel_tracks = Number(document.getElementById('w-tracks').value);
        wizardData.max_bookings_per_participant = Number(document.getElementById('w-max-bookings').value);
        step = 3;
        renderCurrentStep();
      };
    } else if (step === 3) {
      document.getElementById('btn-step3-back').onclick = () => { step = 2; renderCurrentStep(); };
      document.getElementById('btn-add-field').onclick = () => {
        if (wizardData.custom_fields.length < 5) {
          wizardData.custom_fields.push({ label: '', field_type: 'text', required: false });
          renderCurrentStep();
        }
      };
      document.querySelectorAll('.btn-del-field').forEach(b => {
        b.onclick = (e) => {
          wizardData.custom_fields.splice(Number(e.target.dataset.index), 1);
          renderCurrentStep();
        };
      });

      const commitEvent = async (status) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          alert('You must be signed in to commit this event.');
          return;
        }

        // Collect custom fields
        const cfs = [];
        document.querySelectorAll('.cf-label').forEach((el, i) => {
          cfs.push({
            field_order: i + 1,
            label: el.value,
            field_type: document.querySelectorAll('.cf-type')[i].value,
            required: document.querySelectorAll('.cf-req')[i].checked
          });
        });

        // 1. Insert Event
        const slug = wizardData.name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 7);
        const { data: event, error: eventErr } = await supabase.from('events').insert({
          organizer_id: user.id,
          name: wizardData.name,
          slug,
          description: wizardData.description,
          event_type: wizardData.event_type,
          status,
          passcode_plain: wizardData.passcode,
          passcode_hash: wizardData.passcode, // Trigger or RPC hashes via pgcrypto
          slot_duration_minutes: wizardData.slot_duration_minutes,
          buffer_minutes: wizardData.buffer_minutes,
          parallel_tracks: wizardData.parallel_tracks,
          max_bookings_per_participant: wizardData.max_bookings_per_participant,
          location_details: wizardData.location_details
        }).select().single();

        if (eventErr) return alert('Event creation failed: ' + eventErr.message);

        // 2. Insert Custom Fields
        if (cfs.length > 0) {
          await supabase.from('event_custom_fields').insert(cfs.map(f => ({ ...f, event_id: event.id })));
        }

        // 3. Insert Dates
        for (const d of wizardData.dates) {
          await supabase.from('event_dates').insert({
            event_id: event.id,
            event_date: d.date,
            start_time: d.start_time,
            end_time: d.end_time
          });
        }

        // 4. Generate Timeslots RPC
        await supabase.rpc('generate_event_slots', { p_event_id: event.id });

        toast('Event configured successfully!', 'success');
        window.location.hash = `#/publish/${event.id}`;
      };

      document.getElementById('btn-save-draft').onclick = () => commitEvent('draft');
      document.getElementById('btn-publish-final').onclick = () => commitEvent('published');
    }
  }

  renderCurrentStep();
}

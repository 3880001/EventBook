import { supabase } from '../supabaseClient.js';
import { toast } from '../utils/ui.js';

export async function renderWizard(container, ctx = {}) {
  const editEventId = ctx?.param;
  let isEditMode = !!editEventId;
  let step = 1;

  const wizardData = {
    name: '',
    description: '',
    event_type: 'single_day',
    is_full_day: false,
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

  // If in edit mode, fetch existing event data from Supabase
  if (isEditMode) {
    container.innerHTML = '<div class="loader-center"><div class="spinner"></div></div>';
    const { data: event, error } = await supabase
      .from('events')
      .select('*, event_dates(*), event_custom_fields(*)')
      .eq('id', editEventId)
      .single();

    if (error || !event) {
      container.innerHTML = `<div class="card"><p style="color:var(--danger)">Failed to load event for editing: ${error?.message || 'Not found'}</p></div>`;
      return;
    }

    wizardData.name = event.name || '';
    wizardData.description = event.description || '';
    wizardData.event_type = event.event_type || 'single_day';
    wizardData.location_details = event.location_details || '';
    wizardData.passcode = event.passcode_plain || '';
    wizardData.slot_duration_minutes = event.slot_duration_minutes || 15;
    wizardData.buffer_minutes = event.buffer_minutes || 0;
    wizardData.parallel_tracks = event.parallel_tracks || 1;
    wizardData.max_bookings_per_participant = event.max_bookings_per_participant || 1;
    wizardData.participant_id_type = event.participant_id_type || 'system_generated';

    if (event.event_dates && event.event_dates.length > 0) {
      wizardData.dates = event.event_dates.map(d => ({
        date: d.event_date,
        start_time: d.start_time.slice(0, 5),
        end_time: d.end_time.slice(0, 5)
      }));
      wizardData.is_full_day = !!event.event_dates[0].is_full_day;
    }

    if (event.event_custom_fields && event.event_custom_fields.length > 0) {
      wizardData.custom_fields = event.event_custom_fields.map(f => ({
        label: f.label,
        field_type: f.field_type,
        required: f.required
      }));
    }
  }

  function renderCurrentStep() {
    container.innerHTML = `
      <div style="max-width:800px; margin:0 auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:0.5rem;">
          <h1 style="font-size:1.75rem; font-weight:700;">
            ${isEditMode ? 'Edit & Republish Event' : 'Create Event'}
          </h1>
          ${isEditMode ? `<a href="#/publish/${editEventId}" class="btn btn-secondary btn-sm">&larr; Cancel Edit</a>` : ''}
        </div>

        <!-- Stepper Indicators -->
        <div class="stepper-header">
          <div class="step-node ${step >= 1 ? 'active' : ''}">
            <div class="step-circle">1</div>
            <span>Basic Info</span>
          </div>
          <div style="flex:1; height:2px; background:${step >= 2 ? 'var(--primary)' : 'var(--neutral-200)'}; margin:0 1rem;"></div>
          <div class="step-node ${step >= 2 ? 'active' : ''}">
            <div class="step-circle">2</div>
            <span>Schedule Plan</span>
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
            <input type="text" id="w-location" class="form-control" value="${data.location_details}" placeholder="Room 402 or Online meeting link" />
          </div>
        </div>

        <!-- Whole Day Checkbox Option -->
        <div class="form-group" style="background:var(--neutral-50); padding:0.85rem; border-radius:var(--radius-md); border:1px solid var(--border-color); margin-top:0.5rem;">
          <label style="display:flex; align-items:center; gap:0.6rem; cursor:pointer; font-weight:600; font-size:0.925rem;">
            <input type="checkbox" id="w-full-day" ${data.is_full_day ? 'checked' : ''} style="width:18px; height:18px; accent-color:var(--primary);" />
            <span>Full-Day Event (Disable granular timeslots)</span>
          </label>
          <small style="color:var(--text-muted); display:block; margin-left:1.75rem; font-size:0.8rem;">
            Check this if the event runs the entire day as an open session without divided time windows.
          </small>
        </div>

        <div class="form-group" style="margin-top:1rem;">
          <label class="form-label">Passcode Protection *</label>
          <input type="text" id="w-passcode" class="form-control" value="${data.passcode}" placeholder="Leave empty to auto-generate (e.g. 6 digits)" />
          <small style="color:var(--text-muted);">Participants must enter this passcode to unlock booking.</small>
        </div>
        <div style="display:flex; justify-content:flex-end; margin-top:2rem;">
          <button id="btn-step1-next" class="btn btn-primary">Next: Schedule Plan &rarr;</button>
        </div>
      `;
    }

    if (currentStep === 2) {
      return `
        <h2 style="font-size:1.25rem; font-weight:600; margin-bottom:1.25rem;">Schedule Plan</h2>
        <div id="dates-container">
          ${data.dates.map((d, index) => `
            <div class="card" style="background:var(--neutral-50); border:1px dashed var(--neutral-300); margin-bottom:1rem; padding:1rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                <strong>Add Date</strong>
                ${data.dates.length > 1 ? `<button class="btn btn-secondary btn-sm btn-remove-date" data-index="${index}">&times; Remove</button>` : ''}
              </div>
              <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:0.75rem;">
                <div>
                  <label class="form-label">Date</label>
                  <input type="date" class="form-control w-date-val" data-index="${index}" value="${d.date}" />
                </div>
                <div>
                  <label class="form-label">Start Time</label>
                  <input type="time" class="form-control w-start-val" data-index="${index}" value="${d.start_time}" ${data.is_full_day ? 'disabled' : ''} />
                </div>
                <div>
                  <label class="form-label">End Time</label>
                  <input type="time" class="form-control w-end-val" data-index="${index}" value="${d.end_time}" ${data.is_full_day ? 'disabled' : ''} />
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        <button id="btn-add-date" class="btn btn-secondary btn-sm" style="margin-bottom:1.5rem;">+ Add Date</button>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:1rem;">
          <div class="form-group" style="${data.is_full_day ? 'opacity:0.5;' : ''}">
            <label class="form-label">Slot Duration (min)</label>
            <select id="w-slot-duration" class="form-control" ${data.is_full_day ? 'disabled' : ''}>
              <option value="10" ${data.slot_duration_minutes === 10 ? 'selected' : ''}>10 minutes</option>
              <option value="15" ${data.slot_duration_minutes === 15 ? 'selected' : ''}>15 minutes</option>
              <option value="30" ${data.slot_duration_minutes === 30 ? 'selected' : ''}>30 minutes</option>
              <option value="45" ${data.slot_duration_minutes === 45 ? 'selected' : ''}>45 minutes</option>
              <option value="60" ${data.slot_duration_minutes === 60 ? 'selected' : ''}>60 minutes</option>
              <option value="120" ${data.slot_duration_minutes === 120 ? 'selected' : ''}>120 minutes</option>
            </select>
          </div>
          <div class="form-group" style="${data.is_full_day ? 'opacity:0.5;' : ''}">
            <label class="form-label">Buffer Time (min)</label>
            <input type="number" id="w-buffer" class="form-control" value="${data.buffer_minutes}" min="0" max="60" ${data.is_full_day ? 'disabled' : ''} />
          </div>

          <!-- Parallel Tracks Dropdown -->
          <div class="form-group">
            <label class="form-label">Parallel Track</label>
            <select id="w-tracks" class="form-control">
              <option value="1" ${data.parallel_tracks === 1 ? 'selected' : ''}>Track 1</option>
              <option value="2" ${data.parallel_tracks === 2 ? 'selected' : ''}>Track 2</option>
              <option value="3" ${data.parallel_tracks === 3 ? 'selected' : ''}>Track 3</option>
              <option value="4" ${data.parallel_tracks === 4 ? 'selected' : ''}>Track 4</option>
              <option value="5" ${data.parallel_tracks === 5 ? 'selected' : ''}>Track 5</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Max Bookings/User</label>
            <input type="number" id="w-max-bookings" class="form-control" value="${data.max_bookings_per_participant}" min="0" placeholder="0 = unlimited" />
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; margin-top:2rem;">
          <button id="btn-step2-back" class="btn btn-secondary">&larr; Back</button>
          <button id="btn-step2-next" class="btn btn-primary">Next: Participant Fields &rarr;</button>
        </div>
      `;
    }

    if (currentStep === 3) {
      return `
        <h2 style="font-size:1.25rem; font-weight:600; margin-bottom:1.25rem;">Step 3: Participant Fields</h2>
        <div class="form-group">
          <label class="form-label">Identification Method</label>
          <select id="w-id-type" class="form-control">
            <option value="system_generated" ${data.participant_id_type === 'system_generated' ? 'selected' : ''}>System-Generated Participant ID (e.g. EB-8F31B)</option>
            <option value="physical_verification" ${data.participant_id_type === 'physical_verification' ? 'selected' : ''}>Physical Verification / Badge Code Required</option>
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
            <button id="btn-save-draft" class="btn btn-secondary">
              ${isEditMode ? 'Save as Draft' : 'Save Draft'}
            </button>
            <button id="btn-publish-final" class="btn btn-primary">
              ${isEditMode ? 'Update & Republish &rarr;' : 'Publish Event &rarr;'}
            </button>
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
        wizardData.is_full_day = document.getElementById('w-full-day').checked;
        wizardData.passcode = document.getElementById('w-passcode').value || Math.floor(100000 + Math.random() * 900000).toString();
        
        if (wizardData.is_full_day) {
          wizardData.slot_duration_minutes = 480;
          wizardData.buffer_minutes = 0;
          wizardData.dates.forEach(d => {
            d.start_time = '09:00';
            d.end_time = '17:00';
          });
        }
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
        document.querySelectorAll('.w-date-val').forEach(el => {
          const idx = el.dataset.index;
          wizardData.dates[idx].date = el.value;
          if (!wizardData.is_full_day) {
            wizardData.dates[idx].start_time = document.querySelectorAll('.w-start-val')[idx].value;
            wizardData.dates[idx].end_time = document.querySelectorAll('.w-end-val')[idx].value;
          }
        });
        if (!wizardData.is_full_day) {
          wizardData.slot_duration_minutes = Number(document.getElementById('w-slot-duration').value);
          wizardData.buffer_minutes = Number(document.getElementById('w-buffer').value);
        }
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
        if (!user) return alert('You must be signed in to commit this event.');

        const cfs = [];
        document.querySelectorAll('.cf-label').forEach((el, i) => {
          cfs.push({
            field_order: i + 1,
            label: el.value,
            field_type: document.querySelectorAll('.cf-type')[i].value,
            required: document.querySelectorAll('.cf-req')[i].checked
          });
        });

        let targetEventId = editEventId;

        if (isEditMode) {
          // --- UPDATE FLOW ---
          const { error: updateErr } = await supabase
            .from('events')
            .update({
              name: wizardData.name,
              description: wizardData.description,
              event_type: wizardData.event_type,
              status,
              passcode_plain: wizardData.passcode,
              passcode_hash: wizardData.passcode,
              slot_duration_minutes: wizardData.slot_duration_minutes,
              buffer_minutes: wizardData.buffer_minutes,
              parallel_tracks: wizardData.parallel_tracks,
              max_bookings_per_participant: wizardData.max_bookings_per_participant,
              participant_id_type: wizardData.participant_id_type,
              location_details: wizardData.location_details,
              updated_at: new Date().toISOString()
            })
            .eq('id', editEventId);

          if (updateErr) return alert('Event update failed: ' + updateErr.message);

          // Refresh custom fields
          await supabase.from('event_custom_fields').delete().eq('event_id', editEventId);
          if (cfs.length > 0) {
            await supabase.from('event_custom_fields').insert(cfs.map(f => ({ ...f, event_id: editEventId })));
          }

          // Refresh dates
          await supabase.from('event_dates').delete().eq('event_id', editEventId);
          for (const d of wizardData.dates) {
            await supabase.from('event_dates').insert({
              event_id: editEventId,
              event_date: d.date,
              start_time: d.start_time,
              end_time: d.end_time,
              is_full_day: wizardData.is_full_day
            });
          }

          // Rebuild available slots safely without erasing booked slots
          await supabase.rpc('rebuild_event_slots', { p_event_id: editEventId });

          toast('Event updated and republished successfully!', 'success');
          window.location.hash = `#/publish/${editEventId}`;
        } else {
          // --- CREATE FLOW ---
          const slug = wizardData.name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 7);
          const { data: event, error: eventErr } = await supabase.from('events').insert({
            organizer_id: user.id,
            name: wizardData.name,
            slug,
            description: wizardData.description,
            event_type: wizardData.event_type,
            status,
            passcode_plain: wizardData.passcode,
            passcode_hash: wizardData.passcode,
            slot_duration_minutes: wizardData.slot_duration_minutes,
            buffer_minutes: wizardData.buffer_minutes,
            parallel_tracks: wizardData.parallel_tracks,
            max_bookings_per_participant: wizardData.max_bookings_per_participant,
            participant_id_type: wizardData.participant_id_type,
            location_details: wizardData.location_details
          }).select().single();

          if (eventErr) return alert('Event creation failed: ' + eventErr.message);

          if (cfs.length > 0) {
            await supabase.from('event_custom_fields').insert(cfs.map(f => ({ ...f, event_id: event.id })));
          }

          for (const d of wizardData.dates) {
            await supabase.from('event_dates').insert({
              event_id: event.id,
              event_date: d.date,
              start_time: d.start_time,
              end_time: d.end_time,
              is_full_day: wizardData.is_full_day
            });
          }

          await supabase.rpc('generate_event_slots', { p_event_id: event.id });
          toast('Event created successfully!', 'success');
          window.location.hash = `#/publish/${event.id}`;
        }
      };

      document.getElementById('btn-save-draft').onclick = () => commitEvent('draft');
      document.getElementById('btn-publish-final').onclick = () => commitEvent('published');
    }
  }

  renderCurrentStep();
}

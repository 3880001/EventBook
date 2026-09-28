import { supabase } from '../supabaseClient.js';
import { toast } from '../utils/ui.js';

export async function renderWizard(container, { param: eventId }) {
  container.innerHTML = '<div class="loader-center"><div class="spinner"></div></div>';

  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    window.location.hash = '#/auth';
    return;
  }

  let isEdit = !!eventId;
  let currentStep = 1;

  let formData = {
    name: '',
    slug: '',
    description: '',
    location_details: '',
    event_date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '17:00',
    is_full_day: false,
    slot_duration_minutes: 15,
    buffer_minutes: 0,
    parallel_tracks: 1,
    passcode_plain: '',
    reminder_enabled: true,
    reminder_count: 1,
    reminder_frequency: '24h',
    custom_fields: []
  };

  // If in edit mode, fetch existing event data
  if (isEdit) {
    const { data: ev, error } = await supabase
      .from('events')
      .select('*, event_dates (*), event_custom_fields (*)')
      .eq('id', eventId)
      .single();

    if (error || !ev) {
      container.innerHTML = '<div class="card"><p style="color:var(--danger)">Failed to load event for editing.</p></div>';
      return;
    }

    const ed = (ev.event_dates && ev.event_dates[0]) || {};
    formData = {
      name: ev.name || '',
      slug: ev.slug || '',
      description: ev.description || '',
      location_details: ev.location_details || '',
      event_date: ed.event_date || new Date().toISOString().split('T')[0],
      start_time: (ed.start_time || '09:00:00').slice(0, 5),
      end_time: (ed.end_time || '17:00:00').slice(0, 5),
      is_full_day: !!ed.is_full_day || ev.slot_duration_minutes >= 480,
      slot_duration_minutes: ev.slot_duration_minutes || 15,
      buffer_minutes: ev.buffer_minutes || 0,
      parallel_tracks: ev.parallel_tracks || 1,
      passcode_plain: ev.passcode_plain || '',
      reminder_enabled: ev.reminder_enabled !== false,
      reminder_count: ev.reminder_count || 1,
      reminder_frequency: ev.reminder_frequency || '24h',
      custom_fields: ev.event_custom_fields ? ev.event_custom_fields.map(c => ({ label: c.label, required: c.required })) : []
    };
  }

  function render() {
    let stepContent = '';

    if (currentStep === 1) {
      // STEP 1: Basic Information
      stepContent = '<div class="card">'
        + '<h2 style="font-size:1.25rem; font-weight:700; margin-bottom:1.25rem;">Step 1: Event Details</h2>'
        + '<div class="form-group">'
        + '<label class="form-label">Event Name *</label>'
        + '<input type="text" id="w-name" class="form-control" placeholder="e.g. Parent Teacher Conference" value="' + (formData.name || '') + '" required />'
        + '</div>'
        + '<div class="form-group">'
        + '<label class="form-label">Custom URL Slug *</label>'
        + '<input type="text" id="w-slug" class="form-control" placeholder="parent-teacher-meeting" value="' + (formData.slug || '') + '" required />'
        + '<small style="color:var(--text-muted);">Unique URL identifier for your public booking link</small>'
        + '</div>'
        + '<div class="form-group">'
        + '<label class="form-label">Description</label>'
        + '<textarea id="w-description" class="form-control" rows="3" placeholder="Provide event instructions or details...">' + (formData.description || '') + '</textarea>'
        + '</div>'
        + '<div class="form-group">'
        + '<label class="form-label">Location / Online Meeting Link</label>'
        + '<input type="text" id="w-location" class="form-control" placeholder="e.g. Room 204 or Google Meet link" value="' + (formData.location_details || '') + '" />'
        + '</div>'
        + '<div style="display:flex; justify-content:flex-end; margin-top:1.5rem;">'
        + '<button type="button" id="btn-next-step" class="btn btn-primary">Next: Timing & Capacity &rarr;</button>'
        + '</div>'
        + '</div>';

    } else if (currentStep === 2) {
      // STEP 2: Date, Time & Tracks
      stepContent = '<div class="card">'
        + '<h2 style="font-size:1.25rem; font-weight:700; margin-bottom:1.25rem;">Step 2: Timing & Capacity</h2>'
        + '<div class="form-group">'
        + '<label class="form-label">Event Date *</label>'
        + '<input type="date" id="w-date" class="form-control" value="' + formData.event_date + '" required />'
        + '</div>'
        + '<div style="margin-bottom:1.25rem;">'
        + '<label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; font-weight:600;">'
        + '<input type="checkbox" id="w-full-day" ' + (formData.is_full_day ? 'checked' : '') + ' />'
        + 'Full Day Session (Open session without fixed 15-minute slot intervals)'
        + '</label>'
        + '</div>'
        + '<div id="timed-slots-config" style="display:' + (formData.is_full_day ? 'none' : 'block') + ';">'
        + '<div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">'
        + '<div class="form-group">'
        + '<label class="form-label">Start Time</label>'
        + '<input type="time" id="w-start-time" class="form-control" value="' + formData.start_time + '" />'
        + '</div>'
        + '<div class="form-group">'
        + '<label class="form-label">End Time</label>'
        + '<input type="time" id="w-end-time" class="form-control" value="' + formData.end_time + '" />'
        + '</div>'
        + '</div>'
        + '<div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">'
        + '<div class="form-group">'
        + '<label class="form-label">Slot Duration (Minutes)</label>'
        + '<input type="number" id="w-duration" class="form-control" value="' + formData.slot_duration_minutes + '" min="5" step="5" />'
        + '</div>'
        + '<div class="form-group">'
        + '<label class="form-label">Buffer Between Slots (Minutes)</label>'
        + '<input type="number" id="w-buffer" class="form-control" value="' + formData.buffer_minutes + '" min="0" step="5" />'
        + '</div>'
        + '</div>'
        + '</div>'
        + '<div class="form-group" style="margin-top:0.75rem;">'
        + '<label class="form-label">Parallel Tracks / Rooms (Concurrent Capacity)</label>'
        + '<input type="number" id="w-tracks" class="form-control" value="' + formData.parallel_tracks + '" min="1" max="10" />'
        + '<small style="color:var(--text-muted);">Set to 2 or more if multiple hosts or rooms accept simultaneous bookings</small>'
        + '</div>'
        + '<div style="display:flex; justify-content:space-between; margin-top:1.5rem;">'
        + '<button type="button" id="btn-prev-step" class="btn btn-secondary">&larr; Back</button>'
        + '<button type="button" id="btn-next-step" class="btn btn-primary">Next: Access & Reminders &rarr;</button>'
        + '</div>'
        + '</div>';

    } else if (currentStep === 3) {
      // STEP 3: Passcode, Reminders & Custom Questions
      let customFieldsHtml = '';
      for (let i = 0; i < formData.custom_fields.length; i++) {
        const cf = formData.custom_fields[i];
        customFieldsHtml += '<div style="display:flex; gap:0.5rem; align-items:center; margin-bottom:0.5rem;">'
          + '<input type="text" class="form-control input-cf-label" value="' + cf.label + '" placeholder="Question / Field Name" />'
          + '<label style="display:flex; align-items:center; gap:0.25rem; font-size:0.85rem; white-space:nowrap;">'
          + '<input type="checkbox" class="input-cf-req" ' + (cf.required ? 'checked' : '') + ' /> Required'
          + '</label>'
          + '<button type="button" class="btn btn-secondary btn-sm btn-remove-cf" data-index="' + i + '" style="color:var(--danger); border-color:#fca5a5;">✕</button>'
          + '</div>';
      }

      stepContent = '<div class="card">'
        + '<h2 style="font-size:1.25rem; font-weight:700; margin-bottom:1.25rem;">Step 3: Access, Reminders & Questions</h2>'
        
        // Passcode Protection
        + '<div class="form-group">'
        + '<label class="form-label">Passcode Protection (Optional)</label>'
        + '<input type="text" id="w-passcode" class="form-control" placeholder="Leave empty for public access" value="' + (formData.passcode_plain || '') + '" />'
        + '<small style="color:var(--text-muted);">Participants must enter this passcode before choosing a slot</small>'
        + '</div>'

        // Reminder Management Card
        + '<div class="card" style="background:#f8fafc; border:1px solid var(--border-color); padding:1.25rem; margin:1.5rem 0; border-radius:10px;">'
        + '<h3 style="font-size:1.05rem; font-weight:700; margin:0 0 0.5rem 0;">🔔 Email Reminder Management</h3>'
        + '<p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:1rem;">Automate attendee reminders and enable quick one-click RSVP options.</p>'
        + '<div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">'
        + '<div class="form-group" style="margin-bottom:0;">'
        + '<label class="form-label">Reminder Count</label>'
        + '<select id="w-reminder-count" class="form-control">'
        + '<option value="1"' + (formData.reminder_count === 1 ? ' selected' : '') + '>1 Reminder (Final with Quick RSVP)</option>'
        + '<option value="2"' + (formData.reminder_count === 2 ? ' selected' : '') + '>2 Reminders</option>'
        + '<option value="3"' + (formData.reminder_count === 3 ? ' selected' : '') + '>3 Reminders</option>'
        + '</select>'
        + '</div>'
        + '<div class="form-group" style="margin-bottom:0;">'
        + '<label class="form-label">Frequency / Schedule</label>'
        + '<select id="w-reminder-frequency" class="form-control">'
        + '<option value="24h"' + (formData.reminder_frequency === '24h' ? ' selected' : '') + '>24 Hours Before Session</option>'
        + '<option value="2h"' + (formData.reminder_frequency === '2h' ? ' selected' : '') + '>2 Hours Before Session</option>'
        + '<option value="30m"' + (formData.reminder_frequency === '30m' ? ' selected' : '') + '>30 Minutes Before Session</option>'
        + '</select>'
        + '</div>'
        + '</div>'
        + '<div style="background:#eff6ff; padding:10px 12px; border-radius:8px; font-size:0.8rem; color:#1e40af; margin-top:1rem;">'
        + '💡 The final reminder automatically includes one-click action buttons: <strong>"I\'m running late"</strong>, <strong>"I\'m here"</strong>, and <strong>"Unable to make it today"</strong>.'
        + '</div>'
        + '</div>'

        // Custom Questionnaire
        + '<div class="form-group">'
        + '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">'
        + '<label class="form-label" style="margin:0;">Custom Registration Questions</label>'
        + '<button type="button" id="btn-add-cf" class="btn btn-secondary btn-sm">+ Add Question</button>'
        + '</div>'
        + '<div id="cf-container">' + customFieldsHtml + '</div>'
        + '</div>'

        + '<div style="display:flex; justify-content:space-between; margin-top:2rem;">'
        + '<button type="button" id="btn-prev-step" class="btn btn-secondary">&larr; Back</button>'
        + '<button type="button" id="btn-save-event" class="btn btn-primary">' + (isEdit ? 'Update Event' : 'Save & Publish Event') + '</button>'
        + '</div>'
        + '</div>';
    }

    container.innerHTML = '<div style="max-width:700px; margin:1rem auto; padding-bottom:3rem;">'
      + '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">'
      + '<h1 style="font-size:1.75rem; font-weight:700; margin:0;">' + (isEdit ? 'Edit Event' : 'Create New Event') + '</h1>'
      + '<span style="font-size:0.85rem; font-weight:600; color:var(--text-muted);">Step ' + currentStep + ' of 3</span>'
      + '</div>'
      + stepContent
      + '</div>';

    bindStepEvents();
  }

  function bindStepEvents() {
    // Slug auto-generation from title
    const nameInput = document.getElementById('w-name');
    if (nameInput) {
      nameInput.oninput = () => {
        formData.name = nameInput.value;
        if (!isEdit && !formData.slugEdited) {
          const generated = nameInput.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          const slugInput = document.getElementById('w-slug');
          if (slugInput) {
            slugInput.value = generated;
            formData.slug = generated;
          }
        }
      };
    }

    const slugInput = document.getElementById('w-slug');
    if (slugInput) {
      slugInput.oninput = () => {
        formData.slugEdited = true;
        formData.slug = slugInput.value.trim();
      };
    }

    const fullDayCheckbox = document.getElementById('w-full-day');
    if (fullDayCheckbox) {
      fullDayCheckbox.onchange = () => {
        formData.is_full_day = fullDayCheckbox.checked;
        const configBox = document.getElementById('timed-slots-config');
        if (configBox) configBox.style.display = fullDayCheckbox.checked ? 'none' : 'block';
      };
    }

    const btnNext = document.getElementById('btn-next-step');
    if (btnNext) {
      btnNext.onclick = () => {
        if (currentStep === 1) {
          const nameVal = document.getElementById('w-name')?.value.trim();
          let slugVal = document.getElementById('w-slug')?.value.trim();
          if (!nameVal) return toast('Please enter an event name', 'danger');
          if (!slugVal) slugVal = nameVal.toLowerCase().replace(/[^a-z0-9]+/g, '-');

          formData.name = nameVal;
          formData.slug = slugVal;
          formData.description = document.getElementById('w-description')?.value.trim() || '';
          formData.location_details = document.getElementById('w-location')?.value.trim() || '';
          currentStep = 2;
          render();
        } else if (currentStep === 2) {
          formData.event_date = document.getElementById('w-date')?.value || formData.event_date;
          formData.is_full_day = !!document.getElementById('w-full-day')?.checked;
          formData.start_time = document.getElementById('w-start-time')?.value || '09:00';
          formData.end_time = document.getElementById('w-end-time')?.value || '17:00';
          formData.slot_duration_minutes = Number(document.getElementById('w-duration')?.value || 15);
          formData.buffer_minutes = Number(document.getElementById('w-buffer')?.value || 0);
          formData.parallel_tracks = Number(document.getElementById('w-tracks')?.value || 1);
          currentStep = 3;
          render();
        }
      };
    }

    const btnPrev = document.getElementById('btn-prev-step');
    if (btnPrev) {
      btnPrev.onclick = () => {
        currentStep = Math.max(1, currentStep - 1);
        render();
      };
    }

    const btnAddCf = document.getElementById('btn-add-cf');
    if (btnAddCf) {
      btnAddCf.onclick = () => {
        formData.custom_fields.push({ label: '', required: false });
        render();
      };
    }

    document.querySelectorAll('.btn-remove-cf').forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.index);
        formData.custom_fields.splice(idx, 1);
        render();
      };
    });

    const btnSave = document.getElementById('btn-save-event');
    if (btnSave) {
      btnSave.onclick = async () => {
        btnSave.disabled = true;
        btnSave.innerText = 'Saving Event...';

        // Read Custom Fields
        const labels = document.querySelectorAll('.input-cf-label');
        const reqs = document.querySelectorAll('.input-cf-req');
        const collectedFields = [];
        labels.forEach((lbl, i) => {
          const val = lbl.value.trim();
          if (val) collectedFields.push({ label: val, required: reqs[i]?.checked || false });
        });
        formData.custom_fields = collectedFields;

        // Read Passcode & Reminders
        formData.passcode_plain = document.getElementById('w-passcode')?.value.trim() || null;
        formData.reminder_enabled = true;
        formData.reminder_count = Number(document.getElementById('w-reminder-count')?.value || 1);
        formData.reminder_frequency = document.getElementById('w-reminder-frequency')?.value || '24h';

        try {
          let savedEventId = eventId;

          const eventPayload = {
            organizer_id: user.id,
            name: formData.name,
            slug: formData.slug,
            description: formData.description,
            location_details: formData.location_details,
            slot_duration_minutes: formData.is_full_day ? 480 : formData.slot_duration_minutes,
            buffer_minutes: formData.is_full_day ? 0 : formData.buffer_minutes,
            parallel_tracks: formData.parallel_tracks,
            passcode_plain: formData.passcode_plain,
            reminder_enabled: formData.reminder_enabled,
            reminder_count: formData.reminder_count,
            reminder_frequency: formData.reminder_frequency,
            status: 'published'
          };

          if (isEdit) {
            const { error: updErr } = await supabase.from('events').update(eventPayload).eq('id', eventId);
            if (updErr) throw updErr;
          } else {
            const { data: newEv, error: insErr } = await supabase.from('events').insert(eventPayload).select().single();
            if (insErr) throw insErr;
            savedEventId = newEv.id;
          }

          // Upsert event_dates
          await supabase.from('event_dates').delete().eq('event_id', savedEventId);
          const { error: dateErr } = await supabase.from('event_dates').insert({
            event_id: savedEventId,
            event_date: formData.event_date,
            start_time: formData.is_full_day ? '09:00:00' : (formData.start_time + ':00'),
            end_time: formData.is_full_day ? '17:00:00' : (formData.end_time + ':00'),
            is_full_day: formData.is_full_day
          });
          if (dateErr) throw dateErr;

          // Upsert custom_fields
          await supabase.from('event_custom_fields').delete().eq('event_id', savedEventId);
          if (formData.custom_fields.length > 0) {
            const cfInserts = formData.custom_fields.map((c, i) => ({
              event_id: savedEventId,
              label: c.label,
              field_type: 'text',
              required: c.required,
              sort_order: i
            }));
            await supabase.from('event_custom_fields').insert(cfInserts);
          }

          toast('Event saved successfully!', 'success');
          window.location.hash = '#/publish/' + savedEventId;

        } catch (err) {
          toast('Error saving event: ' + err.message, 'danger');
          btnSave.disabled = false;
          btnSave.innerText = isEdit ? 'Update Event' : 'Save & Publish Event';
        }
      };
    }
  }

  render();
}

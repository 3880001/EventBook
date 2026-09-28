import { supabase } from '../supabaseClient.js';
import { toast } from '../utils/ui.js';
import { attachLocationAutocomplete } from '../utils/location.js';

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
    reminders: [
      { stage: 1, schedule: '24h' }
    ],
    custom_fields: []
  };

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
      reminders: (ev.reminders_config && Array.isArray(ev.reminders_config) && ev.reminders_config.length > 0) 
        ? ev.reminders_config 
        : [{ stage: 1, schedule: '24h' }],
      custom_fields: ev.event_custom_fields ? ev.event_custom_fields.map(c => ({ label: c.label, required: c.required })) : []
    };
  }

  function render() {
    let stepContent = '';

    if (currentStep === 1) {
      stepContent = '<div class="card">'
        + '<h2 style="font-size:1.25rem; font-weight:700; margin-bottom:1.25rem;">Step 1: Event Details</h2>'
        + '<div class="form-group">'
        + '<label class="form-label">Event Name *</label>'
        + '<input type="text" id="w-name" class="form-control" placeholder="e.g. Parent Teacher Conference" value="' + (formData.name || '') + '" required />'
        + '</div>'
        + '<div class="form-group">'
        + '<label class="form-label">Custom URL Slug *</label>'
        + '<input type="text" id="w-slug" class="form-control" placeholder="parent-teacher-meeting" value="' + (formData.slug || '') + '" required />'
        + '<small style="color:var(--text-muted);">Unique identifier for your public booking link</small>'
        + '</div>'
        + '<div class="form-group">'
        + '<label class="form-label">Description</label>'
        + '<textarea id="w-description" class="form-control" rows="3" placeholder="Provide event instructions or details...">' + (formData.description || '') + '</textarea>'
        + '</div>'
        + '<div class="form-group" style="position:relative;">'
        + '<label class="form-label">Location / Online Meeting Link</label>'
        + '<input type="text" id="w-location" class="form-control" autocomplete="off" placeholder="e.g. Tim Hortons, Ebenezer Rd or Google Meet link" value="' + (formData.location_details || '') + '" />'
        + '<div id="location-suggestions" style="display:none; position:absolute; left:0; right:0; top:100%; background:#ffffff; border:1px solid var(--border-color); border-radius:8px; box-shadow:0 10px 25px rgba(0,0,0,0.12); z-index:1000; max-height:220px; overflow-y:auto; margin-top:4px;"></div>'
        + '<div id="location-preview" style="margin-top:0.45rem; font-size:0.85rem;"></div>'
        + '<small style="color:var(--text-muted);">Type an address for instant suggestions, or enter an online meeting link</small>'
        + '</div>'
        + '<div style="display:flex; justify-content:flex-end; margin-top:1.5rem;">'
        + '<button type="button" id="btn-next-step" class="btn btn-primary">Next: Timing & Capacity &rarr;</button>'
        + '</div>'
        + '</div>';

    } else if (currentStep === 2) {
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
      let remindersListHtml = '';
      const totalReminders = formData.reminders.length;

      for (let i = 0; i < totalReminders; i++) {
        const rem = formData.reminders[i];
        const isLast = (i === totalReminders - 1);
        const stageLabel = 'Reminder ' + (i + 1) + (isLast ? ' (Final with Quick RSVP)' : '');

        remindersListHtml += '<div style="background:#ffffff; border:1px solid var(--border-color); border-radius:8px; padding:0.85rem 1rem; margin-bottom:0.75rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">'
          + '<div>'
          + '<div style="font-weight:700; font-size:0.9rem; color:var(--text-primary);">' + stageLabel + '</div>'
          + (isLast ? '<div style="font-size:0.75rem; color:#1e40af; margin-top:2px;">Includes one-click buttons: <em>"I\'m running late"</em>, <em>"I\'m here"</em>, <em>"Unable to make it"</em></div>' : '')
          + '</div>'
          + '<div style="display:flex; align-items:center; gap:0.5rem;">'
          + '<select class="form-control form-control-sm select-reminder-sched" data-index="' + i + '" style="width:180px; font-weight:600;">'
          + '<option value="24h"' + (rem.schedule === '24h' ? ' selected' : '') + '>24 Hours Before</option>'
          + '<option value="12h"' + (rem.schedule === '12h' ? ' selected' : '') + '>12 Hours Before</option>'
          + '<option value="2h"' + (rem.schedule === '2h' ? ' selected' : '') + '>2 Hours Before</option>'
          + '<option value="1h"' + (rem.schedule === '1h' ? ' selected' : '') + '>1 Hour Before</option>'
          + '<option value="30m"' + (rem.schedule === '30m' ? ' selected' : '') + '>30 Minutes Before</option>'
          + '<option value="15m"' + (rem.schedule === '15m' ? ' selected' : '') + '>15 Minutes Before</option>'
          + '</select>'
          + (totalReminders > 1 ? '<button type="button" class="btn btn-secondary btn-sm btn-delete-reminder" data-index="' + i + '" style="color:var(--danger); border-color:#fca5a5;" title="Remove reminder">✕</button>' : '')
          + '</div>'
          + '</div>';
      }

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
        + '<div class="form-group">'
        + '<label class="form-label">Passcode Protection (Optional)</label>'
        + '<input type="text" id="w-passcode" class="form-control" placeholder="Leave empty for public access" value="' + (formData.passcode_plain || '') + '" />'
        + '<small style="color:var(--text-muted);">Participants must enter this passcode before choosing a slot</small>'
        + '</div>'
        + '<div class="card" style="background:#f8fafc; border:1px solid var(--border-color); padding:1.25rem; margin:1.5rem 0; border-radius:10px;">'
        + '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; flex-wrap:wrap; gap:0.5rem;">'
        + '<div>'
        + '<h3 style="font-size:1.05rem; font-weight:700; margin:0;">🔔 Email Reminder Management</h3>'
        + '<p style="color:var(--text-muted); font-size:0.825rem; margin-top:2px;">Select and configure up to 3 individual scheduled reminders.</p>'
        + '</div>'
        + (totalReminders < 3 ? '<button type="button" id="btn-add-reminder" class="btn btn-secondary btn-sm" style="font-weight:600;">+ Add Reminder</button>' : '<span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">Maximum 3 reminders</span>')
        + '</div>'
        + '<div id="reminders-list-box">' + remindersListHtml + '</div>'
        + '</div>'
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
    if (currentStep === 1) {
      const locInput = document.getElementById('w-location');
      const suggBox = document.getElementById('location-suggestions');
      const prevBox = document.getElementById('location-preview');
      if (locInput && suggBox) {
        attachLocationAutocomplete(locInput, suggBox, prevBox, (selectedAddress) => {
          formData.location_details = selectedAddress;
        });
      }
    }

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

    const btnAddReminder = document.getElementById('btn-add-reminder');
    if (btnAddReminder) {
      btnAddReminder.onclick = () => {
        if (formData.reminders.length >= 3) return;
        const defaultSchedules = ['24h', '2h', '30m'];
        const nextSchedule = defaultSchedules[formData.reminders.length] || '30m';
        formData.reminders.push({ stage: formData.reminders.length + 1, schedule: nextSchedule });
        render();
      };
    }

    document.querySelectorAll('.btn-delete-reminder').forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.index);
        formData.reminders.splice(idx, 1);
        formData.reminders.forEach((r, i) => { r.stage = i + 1; });
        render();
      };
    });

    document.querySelectorAll('.select-reminder-sched').forEach(sel => {
      sel.onchange = () => {
        const idx = Number(sel.dataset.index);
        if (formData.reminders[idx]) {
          formData.reminders[idx].schedule = sel.value;
        }
      };
    });

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

        const labels = document.querySelectorAll('.input-cf-label');
        const reqs = document.querySelectorAll('.input-cf-req');
        const collectedFields = [];
        labels.forEach((lbl, i) => {
          const val = lbl.value.trim();
          if (val) collectedFields.push({ label: val, required: reqs[i]?.checked || false });
        });
        formData.custom_fields = collectedFields;

        formData.passcode_plain = document.getElementById('w-passcode')?.value.trim() || null;

        try {
          let savedEventId = eventId;

          // Include passcode_hash safeguard
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
            passcode_hash: formData.passcode_plain || '',
            reminder_enabled: formData.reminders.length > 0,
            reminder_count: formData.reminders.length,
            reminder_frequency: formData.reminders[0]?.schedule || '24h',
            reminders_config: formData.reminders,
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

          await supabase.from('event_dates').delete().eq('event_id', savedEventId);
          const { error: dateErr } = await supabase.from('event_dates').insert({
            event_id: savedEventId,
            event_date: formData.event_date,
            start_time: formData.is_full_day ? '09:00:00' : (formData.start_time + ':00'),
            end_time: formData.is_full_day ? '17:00:00' : (formData.end_time + ':00'),
            is_full_day: formData.is_full_day
          });
          if (dateErr) throw dateErr;

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

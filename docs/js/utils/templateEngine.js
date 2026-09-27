import { supabase } from '../supabaseClient.js';

export async function saveEventAsTemplate(eventId, templateName, accessType = 'private') {
  const { data: event } = await supabase
    .from('events')
    .select('*, event_custom_fields(*)')
    .eq('id', eventId)
    .single();

  const config = {
    slot_duration_minutes: event.slot_duration_minutes,
    buffer_minutes: event.buffer_minutes,
    parallel_tracks: event.parallel_tracks,
    max_bookings_per_participant: event.max_bookings_per_participant,
    participant_id_type: event.participant_id_type,
    location_type: event.location_type,
    custom_fields: event.event_custom_fields
  };

  const { data: user } = await supabase.auth.getUser();

  return await supabase.from('templates').insert({
    organizer_id: user.user.id,
    source_event_id: eventId,
    name: templateName,
    description: `Blueprint generated from ${event.name}`,
    access_type: accessType,
    configuration: config
  }).select().single();
}

export async function instantiateEventFromTemplate(templateId, newEventName, targetDate) {
  const { data: template } = await supabase
    .from('templates')
    .select('*')
    .eq('id', templateId)
    .single();

  const { data: user } = await supabase.auth.getUser();
  const cfg = template.configuration;
  const slug = newEventName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 6);

  // 1. Create Event
  const { data: newEvent } = await supabase.from('events').insert({
    organizer_id: user.user.id,
    name: newEventName,
    slug,
    event_type: 'single_day',
    status: 'draft',
    passcode_hash: '123456',
    passcode_plain: '123456',
    slot_duration_minutes: cfg.slot_duration_minutes,
    buffer_minutes: cfg.buffer_minutes,
    parallel_tracks: cfg.parallel_tracks,
    max_bookings_per_participant: cfg.max_bookings_per_participant,
    participant_id_type: cfg.participant_id_type,
    location_type: cfg.location_type
  }).select().single();

  // 2. Clone Custom Fields
  if (cfg.custom_fields && cfg.custom_fields.length > 0) {
    const fieldsToInsert = cfg.custom_fields.map(f => ({
      event_id: newEvent.id,
      field_order: f.field_order,
      label: f.label,
      field_type: f.field_type,
      required: f.required
    }));
    await supabase.from('event_custom_fields').insert(fieldsToInsert);
  }

  // 3. Increment Template Counter
  await supabase.from('templates').update({ clone_count: template.clone_count + 1 }).eq('id', templateId);

  return newEvent;
}

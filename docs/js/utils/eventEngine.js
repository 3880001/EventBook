// Universal Event Engine - Single Source of Truth for all event states

// 1. Calculate the definitive start and end Date objects for any event/slot
export function getSessionTimes(event, slot) {
  let startTime = null;
  let endTime = null;

  if (slot && slot.start_time) {
    startTime = new Date(slot.start_time);
    if (slot.end_time) {
      endTime = new Date(slot.end_time);
    } else {
      const duration = event?.slot_duration_minutes || 15;
      endTime = new Date(startTime.getTime() + duration * 60 * 1000);
    }
  } else if (event?.event_dates && event.event_dates.length > 0) {
    const ed = event.event_dates[0];
    const sStr = ed.start_time || '09:00:00';
    const eStr = ed.end_time || '17:00:00';
    startTime = new Date(ed.event_date + 'T' + sStr);
    endTime = new Date(ed.event_date + 'T' + eStr);
  }

  return { startTime, endTime };
}

// 2. Determine if an event or session has concluded (strictly past)
export function isEventPast(event, slot = null) {
  const now = new Date();

  // If a specific slot is passed in
  if (slot) {
    const { endTime } = getSessionTimes(event, slot);
    if (endTime) return now > endTime;
  }

  // If checking the entire event as a whole (all dates)
  if (event?.event_dates && event.event_dates.length > 0) {
    const hasAnyUpcoming = event.event_dates.some(ed => {
      const eStr = ed.end_time || '23:59:59';
      return new Date(ed.event_date + 'T' + eStr) >= now;
    });
    return !hasAnyUpcoming;
  }

  return false;
}

// 3. Determine if attendee self check-in is currently open (window: 1 hour before start until end)
export function isCheckinAllowed(event, slot) {
  const now = new Date();
  const { startTime, endTime } = getSessionTimes(event, slot);

  if (!startTime || !endTime) return { allowed: false, reason: 'unknown' };

  if (now > endTime) {
    return { allowed: false, reason: 'past' }; // Event concluded
  }

  const checkinOpensAt = new Date(startTime.getTime() - 60 * 60 * 1000); // 1 hour prior
  if (now < checkinOpensAt) {
    return { allowed: false, reason: 'early', opensAt: checkinOpensAt }; // Too early
  }

  return { allowed: true, reason: 'open' };
}

// 4. Resolve custom fields list reliably from any event record
export function getCustomFields(event) {
  if (!event) return [];
  
  if (Array.isArray(event.custom_fields) && event.custom_fields.length > 0) {
    return event.custom_fields;
  }
  if (Array.isArray(event.custom_fields_config) && event.custom_fields_config.length > 0) {
    return event.custom_fields_config;
  }
  if (Array.isArray(event.event_custom_fields) && event.event_custom_fields.length > 0) {
    return event.event_custom_fields.map(c => ({
      label: c.label,
      required: !!c.required,
      field_type: c.field_type || 'text'
    }));
  }

  return [];
}

// 5. Passcode resolution
export function getEventPasscode(event) {
  if (!event) return '';
  return (event.passcode_plain || event.passcode_hash || '').trim();
}

export function hasEventPasscode(event) {
  return getEventPasscode(event).length > 0;
}

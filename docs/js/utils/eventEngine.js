// Universal Event Engine - Single Source of Truth for all event states & timezones

// 1. Convert local date & time strings into exact UTC ISO timestamp for any timezone
export function createZonedISO(dateStr, timeStr, timeZone) {
  const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  // Parse as UTC first
  const tempDate = new Date(`${dateStr}T${timeStr}:00Z`);
  // Format tempDate inside target timezone to calculate exact hour difference
  const invDate = new Date(tempDate.toLocaleString('en-US', { timeZone: tz }));
  const diff = tempDate.getTime() - invDate.getTime();
  // Adjust timestamp so that inside the target timezone, it matches dateStr + timeStr
  return new Date(tempDate.getTime() + diff).toISOString();
}

// 2. Format ISO timestamp using event's locked timezone
export function formatEventTime(isoString, timeZone, options = {}) {
  if (!isoString) return '';
  const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const defaultOpts = {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: tz
  };
  return new Date(isoString).toLocaleTimeString([], { ...defaultOpts, ...options });
}

export function formatEventDate(isoString, timeZone, options = {}) {
  if (!isoString) return '';
  const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const defaultOpts = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: tz
  };
  return new Date(isoString).toLocaleDateString(undefined, { ...defaultOpts, ...options });
}

// 3. Calculate start and end Date objects for any event/slot
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

// 4. Determine if an event or session has concluded (strictly past)
export function isEventPast(event, slot = null) {
  const now = new Date();

  if (slot) {
    const { endTime } = getSessionTimes(event, slot);
    if (endTime) return now > endTime;
  }

  if (event?.event_dates && event.event_dates.length > 0) {
    const hasAnyUpcoming = event.event_dates.some(ed => {
      const eStr = ed.end_time || '23:59:59';
      return new Date(ed.event_date + 'T' + eStr) >= now;
    });
    return !hasAnyUpcoming;
  }

  return false;
}

// 5. Determine if attendee self check-in is allowed (1 hour before session until end)
export function isCheckinAllowed(event, slot) {
  const now = new Date();
  const { startTime, endTime } = getSessionTimes(event, slot);

  if (!startTime || !endTime) return { allowed: false, reason: 'unknown' };

  if (now > endTime) {
    return { allowed: false, reason: 'past' };
  }

  const checkinOpensAt = new Date(startTime.getTime() - 60 * 60 * 1000);
  if (now < checkinOpensAt) {
    return { allowed: false, reason: 'early', opensAt: checkinOpensAt };
  }

  return { allowed: true, reason: 'open' };
}

// 6. Resolve custom fields list resiliently across all storage variations
export function getCustomFields(event) {
  if (!event) return [];
  
  let fields = event.custom_fields;
  if (typeof fields === 'string') {
    try { fields = JSON.parse(fields); } catch(e) { fields = []; }
  }
  if (Array.isArray(fields) && fields.length > 0) {
    return fields.map(c => ({
      label: c.label,
      required: (c.required === true || c.required === 'true' || c.required === 1),
      field_type: c.field_type || 'text'
    }));
  }

  let config = event.custom_fields_config;
  if (typeof config === 'string') {
    try { config = JSON.parse(config); } catch(e) { config = []; }
  }
  if (Array.isArray(config) && config.length > 0) {
    return config.map(c => ({
      label: c.label,
      required: (c.required === true || c.required === 'true' || c.required === 1),
      field_type: c.field_type || 'text'
    }));
  }

  if (Array.isArray(event.event_custom_fields) && event.event_custom_fields.length > 0) {
    return event.event_custom_fields.map(c => ({
      label: c.label,
      required: (c.required === true || c.required === 'true' || c.required === 1),
      field_type: c.field_type || 'text'
    }));
  }

  return [];
}

// 7. Passcode resolution
export function getEventPasscode(event) {
  if (!event) return '';
  return (event.passcode_plain || event.passcode_hash || '').trim();
}

export function hasEventPasscode(event) {
  return getEventPasscode(event).length > 0;
}

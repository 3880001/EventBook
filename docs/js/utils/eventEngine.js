// Universal Event Engine - Platform-wide Single Source of Truth

// 1. Universal Local-to-UTC Converter (Works for all 400+ IANA timezones)
export function getUtcIsoFromLocal(dateStr, timeStr, timeZone) {
  const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const sample = new Date(`${dateStr}T12:00:00Z`);

  // Determine timezone offset for the specified date
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });

  const parts = dtf.formatToParts(sample);
  const map = {};
  parts.forEach(p => { if (p.type !== 'literal') map[p.type] = p.value; });

  let tzHour = parseInt(map.hour, 10);
  if (tzHour === 24) tzHour = 0;

  const targetAsUtc = Date.UTC(
    parseInt(map.year, 10),
    parseInt(map.month, 10) - 1,
    parseInt(map.day, 10),
    tzHour,
    parseInt(map.minute, 10),
    parseInt(map.second, 10)
  );

  const offsetMs = targetAsUtc - sample.getTime();

  // Apply inverse offset to target wall-clock time
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  const desiredWallClockUtc = Date.UTC(year, month - 1, day, hour, minute, 0);

  const actualUtcMs = desiredWallClockUtc - offsetMs;
  return new Date(actualUtcMs).toISOString();
}

// 2. Universal Time & Date Formatters (Locked to Event Timezone)
export function formatEventTime(isoString, timeZone, options = {}) {
  if (!isoString) return '';
  const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  return new Date(isoString).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: tz,
    ...options
  });
}

export function formatEventDate(isoString, timeZone, options = {}) {
  if (!isoString) return '';
  const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  return new Date(isoString).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: tz,
    ...options
  });
}

// 3. Universal Session Timing
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

// 4. Past Event Detection
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

// 5. Check-in Window Calculation (1 hour before session until end)
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

// 6. Custom Fields Resolver
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

// 7. Passcode Resolution
export function getEventPasscode(event) {
  if (!event) return '';
  return (event.passcode_plain || event.passcode_hash || '').trim();
}

export function hasEventPasscode(event) {
  return getEventPasscode(event).length > 0;
}

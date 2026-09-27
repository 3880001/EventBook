export function calculateSlotMatrix({ date, startTime, endTime, durationMinutes, bufferMinutes, tracks = 1 }) {
  const slots = [];
  const start = new Date(`${date}T${startTime}:00`);
  const end = new Date(`${date}T${endTime}:00`);

  const stepMs = (durationMinutes + bufferMinutes) * 60 * 1000;
  const slotDurationMs = durationMinutes * 60 * 1000;

  for (let track = 1; track <= tracks; track++) {
    let currentStartMs = start.getTime();

    while (currentStartMs + slotDurationMs <= end.getTime()) {
      const slotStart = new Date(currentStartMs);
      const slotEnd = new Date(currentStartMs + slotDurationMs);

      slots.push({
        track_number: track,
        start_time: slotStart.toISOString(),
        end_time: slotEnd.toISOString(),
        status: 'available'
      });

      currentStartMs += stepMs;
    }
  }

  return slots;
}

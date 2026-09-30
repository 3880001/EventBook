// ATOMIC BOOKING INVOCATION (Replaces client-side race conditions)
async function executeAtomicBooking({ eventId, timeslotId, fullName, email, phone, customResponses }) {
  const { data, error } = await supabase.rpc('book_timeslot_atomic', {
    p_event_id: eventId,
    p_timeslot_id: timeslotId || null,
    p_full_name: fullName.trim(),
    p_email: email.trim().toLowerCase(),
    p_phone: phone ? phone.trim() : null,
    p_custom_responses: customResponses || {}
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data || !data.success) {
    if (data?.error === 'SLOT_ALREADY_BOOKED') {
      throw new Error(data.message || 'This timeslot was just claimed by another attendee. Please pick another slot.');
    }
    throw new Error(data?.error || 'Booking reservation could not be completed.');
  }

  return data; // Returns { success: true, booking_id, booking_reference, event_name }
}

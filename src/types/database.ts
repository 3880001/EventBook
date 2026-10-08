export type EventStatus = 'draft' | 'published' | 'concluded';
export type SlotStatus = 'available' | 'booked';
export type BookingStatus = 'confirmed' | 'cancelled' | 'attended';

export interface EventCustomField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select';
  required: boolean;
  options?: string[];
}

export interface MasterEvent {
  id: string;
  organizer_id: string;
  name: string;
  slug: string;
  description: string | null;
  location_details: string | null;
  timezone: string;
  slot_duration_minutes: number;
  status: EventStatus;
  passcode_plain: string | null;
  custom_fields: EventCustomField[] | null;
  created_at: string;
  updated_at: string;
}

export interface Timeslot {
  id: string;
  event_id: string;
  start_time: string; // ISO RFC3339
  end_time: string;   // ISO RFC3339
  status: SlotStatus;
  created_at: string;
}

export interface ParticipantProfile {
  id: string;
  system_participant_id: string; // EB-XXXXXX
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
}

export interface Booking {
  id: string;
  event_id: string;
  participant_id: string;
  timeslot_id: string | null;
  booking_reference: string; // EB-XXXXXX
  status: BookingStatus;
  attendance_confirmed: boolean;
  custom_responses: Record<string, string>;
  created_at: string;
}

export interface AtomicBookingResponse {
  success: boolean;
  booking_id?: string;
  booking_reference?: string;
  event_name?: string;
  error?: string;
  message?: string;
}

export interface AdminMetrics {
  success: boolean;
  error?: string;
  overview?: {
    total_users: number;
    total_events: number;
    published_events: number;
    total_bookings: number;
    attended_bookings: number;
    cancelled_bookings: number;
    attendance_rate_pct: number;
  };
  users?: Array<{
    id: string;
    email: string;
    created_at: string;
    last_sign_in_at: string | null;
    total_events_created: number;
    total_attendees_received: number;
  }>;
  events?: Array<{
    id: string;
    name: string;
    slug: string;
    timezone: string;
    status: EventStatus;
    organizer_email: string;
    booking_count: number;
    created_at: string;
  }>;
}

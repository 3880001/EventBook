-- ============================================================================
-- UNIVERSAL PLATFORM SCHEMA UPGRADE (Applies to all current & future events)
-- ============================================================================

-- 1. Ensure events table stores timezone, custom questions, and plain passcode
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS custom_fields_config JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS passcode_plain TEXT,
ADD COLUMN IF NOT EXISTS passcode_hash TEXT DEFAULT '';

-- Set default timezone to local device time for existing records that lack one
UPDATE public.events 
SET timezone = 'America/Toronto' 
WHERE timezone IS NULL OR timezone = '' OR timezone = 'UTC';

-- 2. Foreign Key Configuration: Allow timeslot regeneration without deleting bookings
-- When an organizer reschedules or edits timeslots, past booking records have their 
-- timeslot_id safely set to NULL rather than aborting the update.
ALTER TABLE public.bookings 
DROP CONSTRAINT IF EXISTS bookings_timeslot_id_fkey;

ALTER TABLE public.bookings 
ADD CONSTRAINT bookings_timeslot_id_fkey 
    FOREIGN KEY (timeslot_id) REFERENCES public.timeslots(id) ON DELETE SET NULL;

-- Timeslots -> Events (Cascade delete when event deleted)
ALTER TABLE public.timeslots 
DROP CONSTRAINT IF EXISTS timeslots_event_id_fkey;
ALTER TABLE public.timeslots 
ADD CONSTRAINT timeslots_event_id_fkey 
    FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

-- Timeslots -> Event Dates (Cascade delete)
ALTER TABLE public.timeslots 
DROP CONSTRAINT IF EXISTS timeslots_event_date_id_fkey;
ALTER TABLE public.timeslots 
ADD CONSTRAINT timeslots_event_date_id_fkey 
    FOREIGN KEY (event_date_id) REFERENCES public.event_dates(id) ON DELETE CASCADE;

-- Reload Supabase API cache
NOTIFY pgrst, 'reload schema';

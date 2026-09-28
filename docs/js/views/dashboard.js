import { supabase } from '../supabaseClient.js';
import { toast } from '../utils/ui.js';

// ============================================================================
// 1. DASHBOARD VIEW: ANALYTICS & METRICS ONLY
// ============================================================================
export async function renderDashboard(container) {
  // Fallback: If user navigates to #/events, route to My Events view
  if (window.location.hash.startsWith('#/events')) {
    return renderMyEvents(container);
  }

  container.innerHTML = '<div class="loader-center"><div class="spinner"></div></div>';

  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    window.location.hash = '#/auth';
    return;
  }

  const userEmail = user.email.toLowerCase().trim();

  // 1. Fetch Participant Bookings
  let userBookings = [];
  try {
    const { data: participantData } = await supabase
      .from('participant_profiles')
      .select('id')
      .ilike('email', userEmail);

    const participantIds = participantData ? participantData.map(p => p.id) : [];

    if (participantIds.length > 0) {
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select(`
          id,
          status,
          attendance_confirmed,
          created_at,
          timeslots ( start_time ),
          events (
            event_dates ( event_date, end_time )
          )
        `)
        .in('participant_id', participantIds);

      userBookings = bookingsData || [];
    }
  } catch (err) {
    console.error('Error fetching bookings metrics:', err);
  }

  // 2. Fetch Organizer Events
  let organizedEvents = [];
  try {
    const { data: eventsData } = await supabase
      .from('events')
      .select('id, status')
      .or(`organizer_id.eq.${user.id},organizer_id.is.null`);

    organizedEvents = eventsData || [];
  } catch (err) {
    console.error('Error fetching organized events metrics:', err);
  }

  // Compute Personal Metrics
  const now = new Date();
  const totalCreated = organizedEvents.length;
  const publishedCreated = organizedEvents.filter(e => e.status === 'published').length;
  const draftCreated = organizedEvents.filter(e => e.status === 'draft').length;

  const totalParticipated = userBookings.length;
  const attendedCount = userBookings.filter(b => b.attendance_confirmed || b.status === 'attended').length;
  const cancelledCount = userBookings.filter(b => b.status === 'cancelled').length;
  const noShowCount = userBookings.filter(b => b.status === 'no_show').length;

  // Upcoming Active Bookings
  const upcomingCount = userBookings.filter(b => {
    if (b.status === 'cancelled') return false;
    let bDate = null;
    if (b.timeslots && b.timeslots.start_time) {
      bDate = new Date(b.timeslots.start_time);
    } else if (b.events?.event_dates && b.events.event_dates[0]) {
      const ed = b.events.event_dates[0];
      bDate = new Date(ed.event_date + 'T' + (ed.end_time || '23:59:59'));
    } else {
      bDate = new Date(b.created_at);
    }
    return bDate >= now;
  }).length;

  container.innerHTML = `
    <div style="max-width:1050px; margin:0 auto; padding-bottom:3rem;">
      <!-- Dashboard Header -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem; flex-wrap:wrap; gap:1rem;">
        <div>
          <h1 style="font-size:2rem; font-weight:700; margin:0;">Dashboard Analytics</h1>
          <p style="color:var(--text-muted); font-size:0.95rem; margin-top:0.35rem;">
            Activity and performance overview for <strong>${userEmail}</strong>
          </p>
        </div>
        <div style="display:flex; gap:0.75rem; flex-wrap:wrap;">
          <a href="#/events" class="btn btn-secondary" style="display:inline-flex; align-items:center; gap:0.4rem; font-weight:600; text-decoration:none;">
            <span>🎟️</span> View My Events
          </a>
          <a href="#/create" class="btn btn-primary" style="display:inline-flex; align-items:center; gap:0.4rem; font-weight:600; text-decoration:none;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Create Event
          </a>
        </div>
      </div>

      <!-- Primary Analytics KPI Cards Grid -->
      <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:1.25rem; margin-bottom:2rem;">
        
        <!-- Events Created -->
        <div class="card" style="margin-bottom:0; padding:1.5rem; border:1px solid var(--border-color); border-radius:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.8rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">EVENTS CREATED</span>
            <span style="font-size:1.25rem;">📋</span>
          </div>
          <div style="font-size:2.5rem; font-weight:800; color:var(--primary); margin:0.5rem 0 0.25rem 0;">${totalCreated}</div>
          <div style="font-size:0.825rem; color:var(--text-muted);">
            <strong style="color:var(--success);">${publishedCreated}</strong> Published &bull; <strong>${draftCreated}</strong> Drafts
          </div>
        </div>

        <!-- Events Booked / Participated -->
        <div class="card" style="margin-bottom:0; padding:1.5rem; border:1px solid var(--border-color); border-radius:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.8rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">PARTICIPATED / BOOKED</span>
            <span style="font-size:1.25rem;">🎟️</span>
          </div>
          <div style="font-size:2.5rem; font-weight:800; color:#3b82f6; margin:0.5rem 0 0.25rem 0;">${totalParticipated}</div>
          <div style="font-size:0.825rem; color:var(--text-muted);">
            Total sessions registered
          </div>
        </div>

        <!-- Upcoming Sessions -->
        <div class="card" style="margin-bottom:0; padding:1.5rem; border:1px solid var(--border-color); border-radius:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.8rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">UPCOMING SESSIONS</span>
            <span style="font-size:1.25rem;">⏳</span>
          </div>
          <div style="font-size:2.5rem; font-weight:800; color:#8b5cf6; margin:0.5rem 0 0.25rem 0;">${upcomingCount}</div>
          <div style="font-size:0.825rem; color:var(--text-muted);">
            Active future appointments
          </div>
        </div>

        <!-- Attended -->
        <div class="card" style="margin-bottom:0; padding:1.5rem; border:1px solid var(--border-color); border-radius:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.8rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">ATTENDED</span>
            <span style="font-size:1.25rem;">✅</span>
          </div>
          <div style="font-size:2.5rem; font-weight:800; color:var(--success); margin:0.5rem 0 0.25rem 0;">${attendedCount}</div>
          <div style="font-size:0.825rem; color:var(--text-muted);">
            Verified attendances
          </div>
        </div>

        <!-- Cancelled -->
        <div class="card" style="margin-bottom:0; padding:1.5rem; border:1px solid var(--border-color); border-radius:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.8rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">CANCELLED</span>
            <span style="font-size:1.25rem;">🚫</span>
          </div>
          <div style="font-size:2.5rem; font-weight:800; color:var(--warning); margin:0.5rem 0 0.25rem 0;">${cancelledCount}</div>
          <div style="font-size:0.825rem; color:var(--text-muted);">
            Cancelled bookings
          </div>
        </div>

        <!-- No Show -->
        <div class="card" style="margin-bottom:0; padding:1.5rem; border:1px solid var(--border-color); border-radius:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.8rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">NO SHOW</span>
            <span style="font-size:1.25rem;">⚠️</span>
          </div>
          <div style="font-size:2.5rem; font-weight:800; color:var(--danger); margin:0.5rem 0 0.25rem 0;">${noShowCount}</div>
          <div style="font-size:0.825rem; color:var(--text-muted);">
            Unattended reservations
          </div>
        </div>

      </div>

      <!-- Quick Action Navigation Card -->
      <div class="card" style="background:#f8fafc; border:1px solid var(--border-color); padding:1.75rem; border-radius:14px;">
        <h2 style="font-size:1.15rem; font-weight:700; margin-bottom:0.5rem;">Quick Management</h2>
        <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:1.25rem;">Access your booking passes or organized events directly:</p>
        <div style="display:flex; gap:1rem; flex-wrap:wrap;">
          <a href="#/events" class="btn btn-primary" style="text-decoration:none; padding:0.65rem 1.25rem; font-weight:600;">
            🎟️ Go to My Bookings (${totalParticipated})
          </a>
          <a href="#/events" class="btn btn-secondary" style="text-decoration:none; padding:0.65rem 1.25rem; font-weight:600;">
            📋 Manage Created Events (${totalCreated})
          </a>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// 2. MY EVENTS VIEW: DETAILED BOOKING CARDS & ORGANIZER WORKSPACE
// ============================================================================
export async function renderMyEvents(container) {
  container.innerHTML = '<div class="loader-center"><div class="spinner"></div></div>';

  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    window.location.hash = '#/auth';
    return;
  }

  const userEmail = user.email.toLowerCase().trim();

  // Fetch Participant Bookings
  let userBookings = [];
  try {
    const { data: participantData } = await supabase
      .from('participant_profiles')
      .select('id')
      .ilike('email', userEmail);

    const participantIds = participantData ? participantData.map(p => p.id) : [];

    if (participantIds.length > 0) {
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select(`
          id,
          booking_reference,
          status,
          attendance_confirmed,
          created_at,
          custom_responses,
          events (
            id,
            name,
            slug,
            location_details,
            slot_duration_minutes,
            event_dates (*)
          ),
          timeslots (
            id,
            start_time,
            end_time,
            track_number
          )
        `)
        .in('participant_id', participantIds)
        .order('created_at', { ascending: false });

      userBookings = bookingsData || [];
    }
  } catch (err) {
    console.error('Error fetching participant bookings:', err);
  }

  // Fetch Organized Events
  let organizedEvents = [];
  try {
    const { data: eventsData } = await supabase
      .from('events')
      .select(`
        *,
        event_dates (*),
        timeslots ( id, status ),
        bookings ( id, status )
      `)
      .or(`organizer_id.eq.${user.id},organizer_id.is.null`)
      .order('created_at', { ascending: false });

    organizedEvents = eventsData || [];
  } catch (err) {
    console.error('Error fetching organized events:', err);
  }

  // Split into Upcoming vs Past History
  const now = new Date();
  const upcomingBookings = [];
  const pastBookings = [];

  userBookings.forEach(b => {
    let bookingDate = null;
    if (b.timeslots && b.timeslots.start_time) {
      bookingDate = new Date(b.timeslots.start_time);
    } else if (b.events?.event_dates && b.events.event_dates.length > 0) {
      const ed = b.events.event_dates[0];
      const timePart = ed.end_time || '23:59:59';
      bookingDate = new Date(ed.event_date + 'T' + timePart);
    } else {
      bookingDate = new Date(b.created_at);
    }

    if (bookingDate >= now && b.status !== 'cancelled') {
      upcomingBookings.push(b);
    } else {
      pastBookings.push(b);
    }
  });

  let activeMainTab = 'bookings'; // 'bookings' | 'organized'
  let activeBookingsSubTab = 'upcoming'; // 'upcoming' | 'past'

  function renderView() {
    function renderBookingCards(list, isPast = false) {
      if (!list || list.length === 0) {
        return `
          <div style="text-align:center; padding:3rem 1rem; color:var(--text-muted); background:#f8fafc; border-radius:12px; border:1px dashed var(--border-color);">
            <p style="font-weight:500; font-size:1rem;">No ${isPast ? 'past events or booking history' : 'upcoming booked events'} found.</p>
            <p style="font-size:0.85rem; margin-top:0.25rem;">Bookings made with <code>${userEmail}</code> will appear here automatically.</p>
          </div>
        `;
      }

      let cardsHtml = '<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap:1.25rem;">';
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        const evt = b.events || {};
        
        let dateDisplay = 'Scheduled Date';
        if (b.timeslots && b.timeslots.start_time) {
          dateDisplay = new Date(b.timeslots.start_time).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        } else if (evt.event_dates && evt.event_dates[0]) {
          dateDisplay = new Date(evt.event_dates[0].event_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) + ' (Whole Day)';
        }

        const trackBadge = (b.timeslots?.track_number && b.timeslots.track_number > 1) 
          ? `<span class="badge badge-neutral" style="font-size:0.75rem;">Track ${b.timeslots.track_number}</span>` 
          : '';

        const statusBadge = b.attendance_confirmed 
          ? '<span class="badge badge-success">✓ Attended</span>'
          : (b.status === 'cancelled' 
              ? '<span class="badge badge-danger">Cancelled</span>' 
              : '<span class="badge badge-primary">Confirmed</span>');

        cardsHtml += `
          <div class="card" style="display:flex; flex-direction:column; justify-content:space-between; margin-bottom:0; border:1px solid var(--border-color); border-radius:14px; padding:1.25rem; background:#ffffff;">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem; gap:0.5rem;">
                <span style="font-family:monospace; font-weight:700; font-size:0.85rem; color:var(--primary); background:var(--primary-light); padding:2px 8px; border-radius:4px;">
                  ${b.booking_reference}
                </span>
                <div style="display:flex; gap:0.35rem; align-items:center;">
                  ${trackBadge}
                  ${statusBadge}
                </div>
              </div>

              <h3 style="font-size:1.15rem; font-weight:700; margin:0.35rem 0 0.25rem 0;">${evt.name || 'Event Reservation'}</h3>
              
              <div style="color:var(--text-muted); font-size:0.875rem; margin-top:0.6rem; display:grid; gap:0.35rem;">
                <div style="display:flex; align-items:center; gap:0.4rem;">
                  <span>📅</span>
                  <span style="font-weight:600; color:var(--text-primary);">${dateDisplay}</span>
                </div>
                <div style="display:flex; align-items:center; gap:0.4rem;">
                  <span>📍</span>
                  <span>${evt.location_details || 'Online'}</span>
                </div>
              </div>
            </div>

            <div style="margin-top:1.25rem; padding-top:0.85rem; border-top:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
              <a href="#/ticket/${b.booking_reference}" class="btn btn-primary btn-sm" style="display:inline-flex; align-items:center; gap:0.35rem; font-weight:600; text-decoration:none;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                View Ticket & QR
              </a>
              ${evt.slug ? `
                <a href="#/book/${evt.slug}" class="btn btn-secondary btn-sm" style="text-decoration:none; font-size:0.8rem;">
                  Event Page &rarr;
                </a>
              ` : ''}
            </div>
          </div>
        `;
      }
      cardsHtml += '</div>';
      return cardsHtml;
    }

    function renderOrganizerTable() {
      if (organizedEvents.length === 0) {
        return `
          <div style="text-align:center; padding:3rem 1rem; color:var(--text-muted);">
            <p style="font-size:1rem;">No events found under your organizer account.</p>
            <a href="#/create" class="btn btn-primary" style="margin-top:1rem; display:inline-block;">+ Create New Event</a>
          </div>
        `;
      }

      return `
        <div class="table-responsive">
          <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.9rem;">
            <thead>
              <tr style="border-bottom:1px solid var(--border-color); color:var(--text-muted); font-size:0.8rem;">
                <th style="padding:0.75rem 0.5rem;">EVENT</th>
                <th style="padding:0.75rem 0.5rem;">STATUS</th>
                <th style="padding:0.75rem 0.5rem;">TYPE</th>
                <th style="padding:0.75rem 0.5rem;">BOOKINGS</th>
                <th style="padding:0.75rem 0.5rem; text-align:right;">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              ${organizedEvents.map(evt => {
                const isFullDay = (evt.event_dates && evt.event_dates.some(d => d.is_full_day)) || (evt.slot_duration_minutes >= 480);
                const bookCount = evt.bookings ? evt.bookings.filter(b => b.status === 'confirmed' || b.status === 'attended').length : 0;
                return `
                  <tr style="border-bottom:1px solid var(--border-color);">
                    <td style="padding:0.85rem 0.5rem;">
                      <a href="#/publish/${evt.id}" style="font-weight:700; text-decoration:none; color:var(--primary); font-size:0.95rem;">${evt.name}</a>
                      <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">${evt.location_details || 'Online'}</div>
                    </td>
                    <td style="padding:0.85rem 0.5rem;">
                      <span class="badge ${evt.status === 'published' ? 'badge-success' : 'badge-neutral'}">${evt.status}</span>
                    </td>
                    <td style="padding:0.85rem 0.5rem; color:var(--text-muted); font-size:0.85rem;">
                      ${isFullDay ? 'Whole Day' : `${evt.slot_duration_minutes}m Slots`}
                    </td>
                    <td style="padding:0.85rem 0.5rem; font-weight:600;">
                      ${bookCount}
                    </td>
                    <td style="padding:0.85rem 0.5rem; text-align:right;">
                      <div style="display:inline-flex; gap:0.35rem;">
                        <a href="#/publish/${evt.id}" class="btn btn-secondary btn-sm" style="text-decoration:none;">Manage</a>
                        <a href="#/edit/${evt.id}" class="btn btn-secondary btn-sm" style="text-decoration:none;">Edit</a>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    container.innerHTML = `
      <div style="max-width:1050px; margin:0 auto; padding-bottom:3rem;">
        
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
          <div>
            <h1 style="font-size:1.75rem; font-weight:700; margin:0;">My Events & Bookings</h1>
            <p style="color:var(--text-muted); font-size:0.9rem; margin-top:0.25rem;">
              Manage your registrations and organized events
            </p>
          </div>
          <a href="#/create" class="btn btn-primary" style="display:inline-flex; align-items:center; gap:0.4rem; font-weight:600;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Create Event
          </a>
        </div>

        <!-- Navigation Tabs: My Bookings vs Events I'm Organizing -->
        <div style="display:flex; gap:0.75rem; border-bottom:2px solid var(--border-color); margin-bottom:1.5rem;">
          <button id="tab-btn-bookings" class="btn" style="border:none; border-bottom:3px solid ${activeMainTab === 'bookings' ? 'var(--primary)' : 'transparent'}; border-radius:0; padding:0.75rem 1.25rem; font-weight:700; color:${activeMainTab === 'bookings' ? 'var(--primary)' : 'var(--text-muted)'}; background:none; font-size:1rem; cursor:pointer;">
            🎟️ My Bookings (${userBookings.length})
          </button>
          <button id="tab-btn-organized" class="btn" style="border:none; border-bottom:3px solid ${activeMainTab === 'organized' ? 'var(--primary)' : 'transparent'}; border-radius:0; padding:0.75rem 1.25rem; font-weight:700; color:${activeMainTab === 'organized' ? 'var(--primary)' : 'var(--text-muted)'}; background:none; font-size:1rem; cursor:pointer;">
            📋 Events I'm Organizing (${organizedEvents.length})
          </button>
        </div>

        <!-- MY BOOKINGS SECTION -->
        <div id="section-bookings" style="display:${activeMainTab === 'bookings' ? 'block' : 'none'};">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:0.75rem;">
            <div style="display:flex; gap:0.5rem; background:#f1f5f9; padding:4px; border-radius:8px;">
              <button id="subtab-btn-upcoming" class="btn btn-sm ${activeBookingsSubTab === 'upcoming' ? 'btn-primary' : 'btn-secondary'}" style="font-weight:600;">
                Upcoming (${upcomingBookings.length})
              </button>
              <button id="subtab-btn-past" class="btn btn-sm ${activeBookingsSubTab === 'past' ? 'btn-primary' : 'btn-secondary'}" style="font-weight:600;">
                Past Events / History (${pastBookings.length})
              </button>
            </div>
            <span style="font-size:0.85rem; color:var(--text-muted);">
              ${activeBookingsSubTab === 'upcoming' ? `${upcomingBookings.length} upcoming reservations` : `${pastBookings.length} completed/past sessions`}
            </span>
          </div>

          ${activeBookingsSubTab === 'upcoming' ? renderBookingCards(upcomingBookings, false) : renderBookingCards(pastBookings, true)}
        </div>

        <!-- ORGANIZED EVENTS SECTION -->
        <div id="section-organized" style="display:${activeMainTab === 'organized' ? 'block' : 'none'};">
          <div class="card">
            <h2 style="font-size:1.2rem; font-weight:700; margin-bottom:1rem;">Your Created Events</h2>
            ${renderOrganizerTable()}
          </div>
        </div>

      </div>
    `;

    bindTabActions();
  }

  function bindTabActions() {
    const btnBookings = document.getElementById('tab-btn-bookings');
    const btnOrganized = document.getElementById('tab-btn-organized');
    const subUpcoming = document.getElementById('subtab-btn-upcoming');
    const subPast = document.getElementById('subtab-btn-past');

    if (btnBookings) {
      btnBookings.onclick = () => {
        activeMainTab = 'bookings';
        renderView();
      };
    }

    if (btnOrganized) {
      btnOrganized.onclick = () => {
        activeMainTab = 'organized';
        renderView();
      };
    }

    if (subUpcoming) {
      subUpcoming.onclick = () => {
        activeBookingsSubTab = 'upcoming';
        renderView();
      };
    }

    if (subPast) {
      subPast.onclick = () => {
        activeBookingsSubTab = 'past';
        renderView();
      };
    }
  }

  renderView();
}

import { supabase } from '../supabaseClient.js';
import { toast } from '../utils/ui.js';

export async function renderDashboard(container) {
  container.innerHTML = '<div class="loader-center"><div class="spinner"></div></div>';

  // 1. Get current logged-in user session
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    window.location.hash = '#/auth';
    return;
  }

  const userEmail = user.email.toLowerCase().trim();

  // 2. Fetch User's Bookings (Participant Role)
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

  // 3. Fetch Events Organized by this user (Organizer Role)
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

  // 4. Split Bookings into Upcoming vs Past History
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

    b.computedDate = bookingDate;

    // Upcoming: Date is now or future, and not cancelled
    if (bookingDate >= now && b.status !== 'cancelled') {
      upcomingBookings.push(b);
    } else {
      pastBookings.push(b);
    }
  });

  // Default active tab: If user has bookings and 0 organized events, open "My Bookings"
  let activeMainTab = (userBookings.length > 0 && organizedEvents.length === 0) ? 'bookings' : 'bookings';
  let activeBookingsSubTab = 'upcoming'; // 'upcoming' | 'past'

  function renderView() {
    // Participant Booking Cards Generator
    function renderBookingCards(list, isPast = false) {
      if (!list || list.length === 0) {
        return `
          <div style="text-align:center; padding:3rem 1rem; color:var(--text-muted); background:#f8fafc; border-radius:12px; border:1px dashed var(--border-color);">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.4; margin-bottom:0.75rem;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            <p style="font-weight:500; font-size:1rem;">No ${isPast ? 'past events or booking history' : 'upcoming booked events'} found.</p>
            <p style="font-size:0.85rem; margin-top:0.25rem;">Bookings made with <code>${userEmail}</code> will appear here automatically.</p>
          </div>
        `;
      }

      let cardsHtml = '<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap:1.25rem;">';
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        const evt = b.events || {};
        const isFullDay = (evt.event_dates && evt.event_dates.some(d => d.is_full_day)) || (evt.slot_duration_minutes >= 480);
        
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

            <!-- Card Bottom Buttons -->
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

    // Organizer Events Table Generator
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
        
        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
          <div>
            <h1 style="font-size:1.75rem; font-weight:700; margin:0;">Dashboard</h1>
            <p style="color:var(--text-muted); font-size:0.9rem; margin-top:0.25rem;">
              Signed in as <strong>${userEmail}</strong>
            </p>
          </div>
          <a href="#/create" class="btn btn-primary" style="display:inline-flex; align-items:center; gap:0.4rem; font-weight:600;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Create Event
          </a>
        </div>

        <!-- High-Level Navigation Tabs: My Bookings vs Events I'm Organizing -->
        <div style="display:flex; gap:0.75rem; border-bottom:2px solid var(--border-color); margin-bottom:1.5rem;">
          <button id="tab-btn-bookings" class="btn" style="border:none; border-bottom:3px solid ${activeMainTab === 'bookings' ? 'var(--primary)' : 'transparent'}; border-radius:0; padding:0.75rem 1.25rem; font-weight:700; color:${activeMainTab === 'bookings' ? 'var(--primary)' : 'var(--text-muted)'}; background:none; font-size:1rem; cursor:pointer;">
            🎟️ My Bookings (${userBookings.length})
          </button>
          <button id="tab-btn-organized" class="btn" style="border:none; border-bottom:3px solid ${activeMainTab === 'organized' ? 'var(--primary)' : 'transparent'}; border-radius:0; padding:0.75rem 1.25rem; font-weight:700; color:${activeMainTab === 'organized' ? 'var(--primary)' : 'var(--text-muted)'}; background:none; font-size:1rem; cursor:pointer;">
            📋 Events I'm Organizing (${organizedEvents.length})
          </button>
        </div>

        <!-- TAB CONTENT: MY BOOKINGS (PARTICIPANT) -->
        <div id="section-bookings" style="display:${activeMainTab === 'bookings' ? 'block' : 'none'};">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:0.75rem;">
            <!-- Sub-tabs: Upcoming vs Past History -->
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

          <!-- Active Subtab Content -->
          ${activeBookingsSubTab === 'upcoming' ? renderBookingCards(upcomingBookings, false) : renderBookingCards(pastBookings, true)}
        </div>

        <!-- TAB CONTENT: ORGANIZED EVENTS (ORGANIZER) -->
        <div id="section-organized" style="display:${activeMainTab === 'organized' ? 'block' : 'none'};">
          <!-- Summary Metrics -->
          <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-bottom:1.5rem;">
            <div class="card" style="margin-bottom:0; text-align:center;">
              <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">TOTAL EVENTS</span>
              <div style="font-size:2rem; font-weight:700; margin-top:0.25rem;">${organizedEvents.length}</div>
            </div>
            <div class="card" style="margin-bottom:0; text-align:center;">
              <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">PUBLISHED</span>
              <div style="font-size:2rem; font-weight:700; color:var(--success); margin-top:0.25rem;">
                ${organizedEvents.filter(e => e.status === 'published').length}
              </div>
            </div>
            <div class="card" style="margin-bottom:0; text-align:center;">
              <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">DRAFT</span>
              <div style="font-size:2rem; font-weight:700; color:var(--warning); margin-top:0.25rem;">
                ${organizedEvents.filter(e => e.status === 'draft').length}
              </div>
            </div>
          </div>

          <!-- Organized Events List -->
          <div class="card">
            <h2 style="font-size:1.2rem; font-weight:700; margin-bottom:1rem;">Your Events</h2>
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

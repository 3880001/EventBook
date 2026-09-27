import { supabase } from '../supabaseClient.js';
import { toast } from '../utils/ui.js';

export async function renderFeedbackPage(container, { param: eventId }) {
  const { data: form } = await supabase
    .from('feedback_forms')
    .select('*, events(name)')
    .eq('event_id', eventId)
    .single();

  container.innerHTML = `
    <div style="max-width:640px; margin:0 auto;">
      <div class="card">
        <h1 style="font-size:1.5rem; font-weight:700;">Participant Feedback</h1>
        <p style="color:var(--text-muted); margin-bottom:1.5rem;">Event: <strong>${form?.events?.name || 'Appointment'}</strong></p>

        <form id="feedback-form">
          <div class="form-group">
            <label class="form-label">Overall Experience Rating</label>
            <div style="display:flex; gap:0.5rem; font-size:1.5rem; cursor:pointer;" id="star-rating">
              <span data-val="1">⭐</span><span data-val="2">⭐</span><span data-val="3">⭐</span><span data-val="4">⭐</span><span data-val="5">⭐</span>
            </div>
            <input type="hidden" id="selected-rating" value="5" />
          </div>

          <div class="form-group">
            <label class="form-label">Your Booking Reference</label>
            <input type="text" id="fb-ref" class="form-control" placeholder="BK-XXXX-XXXX" required />
          </div>

          <div class="form-group">
            <label class="form-label">What went well? Any suggestions?</label>
            <textarea id="fb-comments" class="form-control" rows="4" placeholder="Share your experience..."></textarea>
          </div>

          <button type="submit" class="btn btn-primary" style="width:100%;">Submit Feedback</button>
        </form>
      </div>
    </div>
  `;

  // Star selector
  document.querySelectorAll('#star-rating span').forEach(star => {
    star.onclick = (e) => {
      const val = e.target.dataset.val;
      document.getElementById('selected-rating').value = val;
      toast(`Selected ${val} Stars`, 'info');
    };
  });

  document.getElementById('feedback-form').onsubmit = async (e) => {
    e.preventDefault();
    const ref = document.getElementById('fb-ref').value.trim();
    const rating = Number(document.getElementById('selected-rating').value);
    const comments = document.getElementById('fb-comments').value.trim();

    // Verify booking
    const { data: booking } = await supabase.from('bookings').select('id').eq('booking_reference', ref).single();
    if (!booking) return alert('Invalid booking reference.');

    const { error } = await supabase.from('feedback_responses').insert({
      feedback_form_id: form.id,
      booking_id: booking.id,
      rating,
      answers: { comments }
    });

    if (error) return alert('Feedback error: ' + error.message);

    container.innerHTML = `
      <div class="card" style="text-align:center; padding:3rem 1rem;">
        <h2 style="color:var(--success); font-weight:700;">Thank You!</h2>
        <p style="color:var(--text-muted); margin-top:0.5rem;">Your response has been recorded.</p>
      </div>
    `;
  };
}

import { supabase } from '../supabaseClient';
import { toast } from '../utils/ui';
import { triggerHaptic } from '../utils/mobileBridge';

export async function renderSettingsPage(container: HTMLElement): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    window.location.hash = '#/auth';
    return;
  }

  container.innerHTML = `
    <div style="max-width:600px; margin:2rem auto; padding:0 1rem;">
      <div class="card" style="padding:2rem; border-radius:14px;">
        <h2 style="font-size:1.4rem; font-weight:800; margin-bottom:0.5rem;">Account Settings</h2>
        <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:1.5rem;">
          Signed in as <strong>${session.user.email}</strong>
        </p>

        <div style="border-top:1px solid var(--border-color); padding-top:1.5rem; margin-top:1.5rem;">
          <h3 style="color:var(--danger); font-size:1.1rem; font-weight:700; margin-bottom:0.35rem;">Danger Zone</h3>
          <p style="color:var(--text-muted); font-size:0.85rem; line-height:1.5; margin-bottom:1rem;">
            Permanently delete your organizer account, active events, attendee records, and scheduled timeslots. This action is irreversible.
          </p>
          <button type="button" id="btn-delete-account" class="btn btn-danger" style="font-weight:700;">
            Delete My Account Permanently
          </button>
        </div>
      </div>
    </div>
  `;

  const btnDelete = document.getElementById('btn-delete-account');
  if (btnDelete) {
    btnDelete.onclick = async () => {
      const confirmation = prompt('To confirm permanent deletion, type "DELETE" below:');
      if (confirmation !== 'DELETE') {
        toast('Account deletion canceled.', 'info');
        return;
      }

      await triggerHaptic('warning');
      btnDelete.setAttribute('disabled', 'true');
      btnDelete.textContent = 'Purging account data...';

      const { data, error } = await supabase.rpc('delete_user_account_self');
      if (error || !data?.success) {
        toast('Failed to delete account: ' + (error?.message || data?.error), 'danger');
        btnDelete.removeAttribute('disabled');
        btnDelete.textContent = 'Delete My Account Permanently';
        return;
      }

      await triggerHaptic('success');
      await supabase.auth.signOut();
      alert('Your account and all associated events have been deleted.');
      window.location.hash = '#/auth';
    };
  }
}

import { supabase } from '../supabaseClient.js';
import { toast } from '../utils/ui.js';

export function renderAuthPage(container) {
  let isRegisterMode = false;

  function render() {
    container.innerHTML = `
      <div style="max-width: 420px; margin: 3rem auto; padding: 0 1rem;">
        <div class="card" style="box-shadow: var(--shadow-lg); border-radius: var(--radius-lg); padding: 2rem;">
          <div style="text-align: center; margin-bottom: 1.5rem;">
            <div style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 12px; background: var(--primary-light); color: var(--primary); margin-bottom: 0.75rem;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            </div>
            <h1 style="font-size: 1.5rem; font-weight: 700;">${isRegisterMode ? 'Create Organizer Account' : 'Welcome Back'}</h1>
            <p style="color: var(--text-muted); font-size: 0.875rem; margin-top: 0.25rem;">
              ${isRegisterMode ? 'Sign up to create and manage appointment events' : 'Sign in to access your organizer workspace'}
            </p>
          </div>

          <!-- Inline Error Banner -->
          <div id="auth-error-box" style="display: none; background: #fee2e2; border: 1px solid #ef4444; color: #b91c1c; padding: 0.75rem; border-radius: 8px; font-size: 0.85rem; margin-bottom: 1.25rem; word-break: break-word;"></div>

          <form id="auth-form">
            ${isRegisterMode ? `
              <div class="form-group">
                <label class="form-label">Full Name</label>
                <input type="text" id="auth-name" class="form-control" placeholder="Jane Doe" required />
              </div>
            ` : ''}

            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input type="email" id="auth-email" class="form-control" placeholder="admin@eventbook.dev" required />
            </div>

            <div class="form-group">
              <label class="form-label">Password</label>
              <input type="password" id="auth-password" class="form-control" placeholder="••••••••" required minlength="6" />
            </div>

            <button type="submit" id="btn-auth-submit" class="btn btn-primary" style="width: 100%; margin-top: 0.5rem;">
              ${isRegisterMode ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div style="text-align: center; margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--border-color); font-size: 0.875rem;">
            <span style="color: var(--text-muted);">
              ${isRegisterMode ? 'Already have an account?' : "Don't have an account?"}
            </span>
            <button id="btn-toggle-auth" style="background: none; border: none; color: var(--primary); font-weight: 600; cursor: pointer; margin-left: 0.35rem; font-size: 0.875rem;">
              ${isRegisterMode ? 'Sign In' : 'Register'}
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-toggle-auth').onclick = () => {
      isRegisterMode = !isRegisterMode;
      render();
    };

    document.getElementById('auth-form').onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btn-auth-submit');
      const errBox = document.getElementById('auth-error-box');
      const email = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;

      errBox.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.innerText = isRegisterMode ? 'Creating account...' : 'Signing in...';

      try {
        if (isRegisterMode) {
          const fullName = document.getElementById('auth-name').value.trim();
          const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } }
          });
          if (error) throw error;
          toast('Account created! Please sign in.', 'success');
          isRegisterMode = false;
          render();
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          toast('Signed in successfully!', 'success');
          window.location.hash = '#/dashboard';
        }
      } catch (err) {
        errBox.innerText = err.message || 'Authentication failed. Please verify credentials.';
        errBox.style.display = 'block';
        toast(err.message, 'danger');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = isRegisterMode ? 'Create Account' : 'Sign In';
      }
    };
  }

  render();
}

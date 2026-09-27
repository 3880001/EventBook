import { supabase } from './supabaseClient.js';

export class Router {
  constructor(routes, rootElement) {
    this.routes = routes;
    this.root = rootElement;
    window.addEventListener('hashchange', () => this.handleRoute());
    window.addEventListener('load', () => this.handleRoute());
  }

  async handleRoute() {
    const rawHash = window.location.hash.slice(1);
    const [path, queryString] = rawHash.split('?');
    const params = new URLSearchParams(queryString || '');

    // Check auth status
    const { data: { session } } = await supabase.auth.getSession();
    const isAuthenticated = !!session;

    // Public routes that don't require organizer sign-in
    const isPublicRoute = path.startsWith('/book') || path.startsWith('/feedback') || path === '/auth';

    // If user is at root with no hash, send to dashboard if logged in, or /auth if logged out
    if (!path || path === '/') {
      window.location.hash = isAuthenticated ? '#/dashboard' : '#/auth';
      return;
    }

    // Protect organizer routes
    if (!isAuthenticated && !isPublicRoute) {
      window.location.hash = '#/auth';
      return;
    }

    // Redirect away from auth if already logged in
    if (isAuthenticated && path === '/auth') {
      window.location.hash = '#/dashboard';
      return;
    }

    // Match route
    let matchedHandler = this.routes[path];
    let routeParam = null;

    if (!matchedHandler) {
      for (const pattern in this.routes) {
        if (pattern.includes(':')) {
          const regex = new RegExp('^' + pattern.replace(/:[^\s/]+/g, '([\\w-]+)') + '$');
          const match = path.match(regex);
          if (match) {
            matchedHandler = this.routes[pattern];
            routeParam = match[1];
            break;
          }
        }
      }
    }

    if (matchedHandler) {
      this.updateActiveNav(path);
      this.root.innerHTML = '<div class="loader-center"><div class="spinner"></div></div>';
      try {
        await matchedHandler(this.root, { param: routeParam, query: params });
      } catch (err) {
        console.error('Route render error:', err);
        this.root.innerHTML = `<div class="card"><h2 style="color:var(--danger)">Rendering Error</h2><p>${err.message}</p></div>`;
      }
    } else {
      this.root.innerHTML = '<div class="card"><h2>404 - Page Not Found</h2><p>The requested view does not exist.</p><a href="#/dashboard" class="btn btn-primary" style="margin-top:1rem;">Back to Home</a></div>';
    }
  }

  updateActiveNav(currentPath) {
    document.querySelectorAll('[data-page]').forEach((el) => {
      const page = el.getAttribute('data-page');
      if (currentPath.includes(page)) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
  }
}

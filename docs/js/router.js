import { supabase } from './supabaseClient.js';

export class Router {
  constructor(routes, container) {
    this.routes = routes;
    this.container = container;
    this.init();
  }

  init() {
    window.addEventListener('hashchange', () => this.handleRoute());
    window.addEventListener('load', () => this.handleRoute());
    if (!window.location.hash) {
      window.location.hash = '#/dashboard';
    }
  }

  async handleRoute() {
    const fullHash = window.location.hash.slice(1) || '/dashboard';
    const [path, queryString] = fullHash.split('?');
    const queryParams = new URLSearchParams(queryString || '');

    // Public routes that don't require organizer sign-in
    const isPublicRoute = path.startsWith('/book') || path.startsWith('/ticket') || path.startsWith('/rsvp') || path.startsWith('/feedback') || path === '/auth';

    const { data: { session } } = await supabase.auth.getSession();

    if (!session && !isPublicRoute) {
      window.location.hash = '#/auth';
      return;
    }

    if (session && path === '/auth') {
      window.location.hash = '#/dashboard';
      return;
    }

    // Dynamic Route Matching
    for (const [routePattern, handler] of Object.entries(this.routes)) {
      const patternParts = routePattern.split('/').filter(Boolean);
      const pathParts = path.split('/').filter(Boolean);

      if (patternParts.length === pathParts.length) {
        let match = true;
        let param = null;
        let params = {};

        for (let i = 0; i < patternParts.length; i++) {
          if (patternParts[i].startsWith(':')) {
            const paramName = patternParts[i].slice(1);
            params[paramName] = decodeURIComponent(pathParts[i]);
            if (!param) param = decodeURIComponent(pathParts[i]);
          } else if (patternParts[i] !== pathParts[i]) {
            match = false;
            break;
          }
        }

        if (match) {
          handler(this.container, { param, params, query: queryParams });
          return;
        }
      }
    }

    // Default route fallback
    if (this.routes['/dashboard']) {
      this.routes['/dashboard'](this.container, { query: queryParams });
    }
  }
}

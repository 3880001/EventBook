// Lightweight Client-Side Hash Router
export class Router {
  constructor(routes, rootElement) {
    this.routes = routes;
    this.root = rootElement;
    window.addEventListener('hashchange', () => this.handleRoute());
    window.addEventListener('load', () => this.handleRoute());
  }

  async handleRoute() {
    const hash = window.location.hash.slice(1) || '/dashboard';
    const [path, queryString] = hash.split('?');
    const params = new URLSearchParams(queryString || '');

    // Match route
    let matchedHandler = this.routes[path];
    let routeParam = null;

    if (!matchedHandler) {
      // Test dynamic segments e.g. /book/:slug or /publish/:id
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

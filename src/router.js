export class Router {
  constructor(routes = {}) {
    this.routes = routes || {};
    this.init();
  }

  add(pattern, handler) {
    if (!this.routes) this.routes = {};
    this.routes[pattern] = handler;
  }

  init() {
    window.addEventListener('hashchange', () => this.handleRoute());
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      this.handleRoute();
    } else {
      window.addEventListener('DOMContentLoaded', () => this.handleRoute());
    }
  }

  async handleRoute() {
    const rawHash = window.location.hash.slice(1) || '/';
    const [pathPart, queryString] = rawHash.split('?');
    const path = pathPart.startsWith('/') ? pathPart : '/' + pathPart;
    const query = new URLSearchParams(queryString || '');

    if (!this.routes || typeof this.routes !== 'object') {
      this.routes = {};
    }

    if (typeof this.routes[path] === 'function') {
      try {
        await this.routes[path]({ path, query, param: null, params: {} });
        return;
      } catch (err) {
        console.error('Route error on ' + path + ':', err);
        return;
      }
    }

    for (const [pattern, handler] of Object.entries(this.routes)) {
      if (!pattern.includes(':')) continue;

      const paramNames = [];
      const regexPattern = '^' + pattern.replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
        paramNames.push(name);
        return '([^/]+)';
      }) + '$';

      const match = path.match(new RegExp(regexPattern));
      if (match) {
        const params = {};
        paramNames.forEach((name, i) => {
          params[name] = decodeURIComponent(match[i + 1]);
        });
        const param = paramNames.length > 0 ? params[paramNames[0]] : null;

        try {
          await handler({ path, query, param, params });
          return;
        } catch (err) {
          console.error('Route error on ' + pattern + ':', err);
          return;
        }
      }
    }

    if (typeof this.routes['/'] === 'function') {
      try {
        await this.routes['/']({ path, query, param: null, params: {} });
      } catch (err) {
        console.error('Fallback route error:', err);
      }
    }
  }
}

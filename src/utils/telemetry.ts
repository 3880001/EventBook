import * as Sentry from '@sentry/browser';

export function initTelemetry(): void {
  // Replace with your free Sentry DSN (from sentry.io) or leave active for safe local interception
  const SENTRY_DSN = 'https://public@sentry.io/placeholder'; 

  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      integrations: [Sentry.browserTracingIntegration()],
      tracesSampleRate: 0.2, // Capture 20% of sessions for performance monitoring
      environment: window.location.hostname === 'localhost' ? 'development' : 'production',
      beforeSend(event) {
        // Strip sensitive attendee passwords or tokens before sending
        if (event.request?.headers) {
          delete event.request.headers['Authorization'];
        }
        return event;
      }
    });
    console.log('[Telemetry] Initialized enterprise crash reporting.');
  } catch (err) {
    console.warn('[Telemetry] Running in fallback mode without remote DSN.');
  }
}

export function logError(error: unknown, context: Record<string, unknown> = {}): void {
  console.error('[EventBook Error]', error, context);
  Sentry.captureException(error, { extra: context });
}
